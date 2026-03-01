from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pathlib import Path
from pydantic import BaseModel
from groq import Groq
from tavily import TavilyClient
import json, os, re, httpx, logging

BASE_DIR = Path(__file__).parent

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
from typing import Optional
from jose import jwt

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ── Supabase client (lazy init) ───────────────────────────────────────────────

def get_supabase():
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not url or not key:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    from supabase import create_client
    return create_client(url, key)


# ── Auth dependency ───────────────────────────────────────────────────────────

def get_current_user(authorization: str = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(
            token,
            os.environ.get("SUPABASE_JWT_SECRET", ""),
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        return payload
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# ── Pydantic models ───────────────────────────────────────────────────────────

class AnalyseRequest(BaseModel):
    text: str = ""
    url: str = ""

class ClaimResult(BaseModel):
    claim: str
    verdict: str
    score: int
    explanation: str
    sources: list[str] = []
    nuance: str = ""

class LanguageFlag(BaseModel):
    phrase: str
    issue: str

class AnalysisResult(BaseModel):
    overall_score: int
    verdict: str
    summary: str
    claims: list[ClaimResult]
    bias_score: int = 50
    bias_label: str = "Centre"
    bias_summary: str = ""
    language_flags: list[LanguageFlag] = []

class ModuleCreate(BaseModel):
    title: str
    description: str = ""
    focus_point: str = ""

class AssignmentCreate(BaseModel):
    module_id: str
    article_url: str
    article_title: str = ""

class StudentResultCreate(BaseModel):
    assignment_id: str
    analysis_json: dict


# ── URL type detection ────────────────────────────────────────────────────────

def is_youtube_url(url: str) -> bool:
    return bool(re.search(r'(youtube\.com/watch|youtu\.be/)', url))

def is_twitter_url(url: str) -> bool:
    return bool(re.search(r'(twitter\.com|x\.com)/\w+/status/', url))

def is_tiktok_url(url: str) -> bool:
    return "tiktok.com" in url

def is_reddit_url(url: str) -> bool:
    return "reddit.com/r/" in url

def is_instagram_url(url: str) -> bool:
    return "instagram.com" in url


# ── Content extractors ────────────────────────────────────────────────────────

async def _fetch_youtube_metadata(video_id: str, api_key: str) -> dict:
    """Fetch video snippet (title, description, tags, channelTitle) via YouTube Data API v3."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            "https://www.googleapis.com/youtube/v3/videos",
            params={"id": video_id, "part": "snippet", "key": api_key},
        )
    resp.raise_for_status()
    data = resp.json()
    items = data.get("items", [])
    if not items:
        raise ValueError(f"No video found for id={video_id}")
    return items[0]["snippet"]


async def _list_youtube_captions(video_id: str, api_key: str) -> list:
    """List available caption tracks via YouTube Data API v3 (metadata only — download requires OAuth)."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            "https://www.googleapis.com/youtube/v3/captions",
            params={"videoId": video_id, "part": "snippet", "key": api_key},
        )
    if resp.status_code == 403:
        logger.warning(f"captions.list 403 for {video_id} — captions may be disabled or private")
        return []
    resp.raise_for_status()
    return resp.json().get("items", [])


async def extract_youtube_transcript(url: str) -> str:
    """Extract content from a YouTube video.

    Strategy:
      1. youtube-transcript-api — preferred langs → generated EN → first available
      2. If all transcript attempts fail and YOUTUBE_API_KEY is set:
         a. captions.list to log available tracks
         b. videos.list to fetch title + description + tags for analysis
    """
    match = re.search(r'(?:v=|youtu\.be/)([a-zA-Z0-9_-]{11})', url)
    if not match:
        raise HTTPException(status_code=400, detail="Could not parse YouTube video ID from URL")

    video_id = match.group(1)
    api_key = os.environ.get("YOUTUBE_API_KEY")
    logger.info(f"Fetching YouTube content for video_id={video_id}, api_key_set={bool(api_key)}")

    # ── Attempt transcript via youtube-transcript-api ─────────────────────────
    entries = None
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
    except ImportError:
        logger.warning("youtube-transcript-api not installed; skipping transcript attempts")
        YouTubeTranscriptApi = None  # noqa: N806

    if YouTubeTranscriptApi is not None:
        try:
            http_client = httpx.Client(timeout=30.0)
            ytt_api = YouTubeTranscriptApi(http_client=http_client)
        except TypeError:
            ytt_api = YouTubeTranscriptApi()

        # Attempt 1: preferred English variants
        try:
            entries = ytt_api.fetch(video_id, languages=["en", "en-US", "en-GB"])
            logger.info(f"Transcript (preferred langs) fetched for {video_id}: {len(entries)} entries")
        except Exception as e1:
            logger.warning(f"Preferred-lang transcript failed for {video_id}: {type(e1).__name__}: {e1}")

        # Attempt 2: generated English transcript
        if entries is None:
            try:
                tlist = ytt_api.list(video_id)
                available = [t.language_code for t in tlist]
                logger.info(f"Available transcript tracks for {video_id}: {available}")
                entries = tlist.find_generated_transcript(["en"]).fetch()
                logger.info(f"Generated EN transcript fetched for {video_id}: {len(entries)} entries")
            except Exception as e2:
                logger.warning(f"Generated transcript failed for {video_id}: {type(e2).__name__}: {e2}")

        # Attempt 3: first available language
        if entries is None:
            try:
                tlist = ytt_api.list(video_id)
                first = next(iter(tlist))
                logger.info(f"Falling back to first available track: language={first.language_code}")
                entries = first.fetch()
                logger.info(f"First-available transcript fetched for {video_id}: {len(entries)} entries")
            except Exception as e3:
                logger.warning(f"First-available transcript failed for {video_id}: {type(e3).__name__}: {e3}")

    if entries is not None:
        text = " ".join(entry["text"] for entry in entries)
        logger.info(f"Transcript text for {video_id}: {len(text)} chars")
        if len(text) >= 50:
            return text
        logger.warning(f"Transcript too short ({len(text)} chars) for {video_id}, trying metadata fallback")

    # ── Fallback: YouTube Data API v3 metadata ────────────────────────────────
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail=(
                f"No transcript available for video {video_id} and YOUTUBE_API_KEY is not set "
                "— cannot fall back to metadata analysis."
            ),
        )

    logger.info(f"Falling back to YouTube Data API v3 metadata for {video_id}")

    # Check what caption tracks exist (metadata only; actual download requires OAuth)
    try:
        caption_tracks = await _list_youtube_captions(video_id, api_key)
        if caption_tracks:
            track_info = [
                f"{t['snippet'].get('language','?')} ({t['snippet'].get('trackKind','?')})"
                for t in caption_tracks
            ]
            logger.info(f"Caption tracks available for {video_id}: {track_info}")
        else:
            logger.info(f"No caption tracks found for {video_id} via Data API")
    except Exception as ce:
        logger.warning(f"captions.list failed for {video_id}: {type(ce).__name__}: {ce}")

    # Fetch video metadata for analysis
    try:
        snippet = await _fetch_youtube_metadata(video_id, api_key)
    except Exception as me:
        logger.error(f"videos.list failed for {video_id}: {type(me).__name__}: {me}")
        raise HTTPException(
            status_code=400,
            detail=f"No transcript and metadata fetch also failed for {video_id}: {me}",
        )

    title = snippet.get("title", "")
    description = snippet.get("description", "")
    tags = snippet.get("tags", [])
    channel = snippet.get("channelTitle", "")

    logger.info(f"Metadata fallback for {video_id}: title='{title}', desc_len={len(description)}, tags={len(tags)}")

    parts = [f"Video title: {title}"]
    if channel:
        parts.append(f"Channel: {channel}")
    if description:
        parts.append(f"Description: {description}")
    if tags:
        parts.append(f"Tags: {', '.join(tags)}")

    text = "\n\n".join(parts)
    if len(text) < 50:
        raise HTTPException(
            status_code=400,
            detail=f"Video {video_id} has no transcript and insufficient metadata for analysis.",
        )

    logger.info(f"Returning metadata fallback text for {video_id}: {len(text)} chars")
    return text


async def extract_twitter_text(url: str) -> str:
    """Extract tweet text via the oEmbed endpoint (no auth required)."""
    oembed_url = f"https://publish.twitter.com/oembed?url={url}&omit_script=true"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(oembed_url)
            resp.raise_for_status()
            data = resp.json()
        html = data.get("html", "")
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")
        p_tag = soup.find("p")
        tweet_text = p_tag.get_text(separator=" ", strip=True) if p_tag else ""
        author = data.get("author_name", "")
        if not tweet_text:
            raise HTTPException(status_code=400, detail="Could not extract tweet text")
        return f"{author}: {tweet_text}" if author else tweet_text
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not fetch tweet: {e}")


async def extract_tiktok_text(url: str) -> str:
    """Extract TikTok video caption via oEmbed endpoint (no auth required)."""
    oembed_url = f"https://www.tiktok.com/oembed?url={url}"
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(oembed_url)
            resp.raise_for_status()
            data = resp.json()
        title = data.get("title", "")
        author = data.get("author_name", "")
        if not title:
            raise HTTPException(status_code=400, detail="Could not extract TikTok description")
        return f"{author}: {title}" if author else title
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not fetch TikTok data: {e}")


async def extract_reddit_text(url: str) -> str:
    """Extract Reddit post title, body, and top comments via the JSON API."""
    clean_url = url.split("?")[0].rstrip("/")
    json_url = clean_url + ".json"
    headers = {"User-Agent": "Cronkite-FactChecker/1.0"}
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(json_url, headers=headers)
            resp.raise_for_status()
            data = resp.json()
        post = data[0]["data"]["children"][0]["data"]
        parts = [post.get("title", "")]
        if post.get("selftext"):
            parts.append(post["selftext"])
        for comment in data[1]["data"]["children"][:5]:
            body = comment.get("data", {}).get("body", "")
            if body and body not in ("[deleted]", "[removed]"):
                parts.append(body)
        text = "\n\n".join(p for p in parts if p)
        if len(text) < 20:
            raise HTTPException(status_code=400, detail="Reddit post appears to be empty or deleted")
        return text
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not fetch Reddit post: {e}")


async def extract_instagram_text(url: str) -> str:
    """Best-effort Instagram caption extraction via Open Graph meta tags."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(resp.text, "html.parser")
        for prop in ("og:description", "og:title", "description"):
            meta = soup.find("meta", {"property": prop}) or soup.find("meta", {"name": prop})
            if meta and meta.get("content"):
                return meta["content"]
        raise HTTPException(status_code=400, detail="Could not extract Instagram content. Post may be private or login-gated.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not fetch Instagram post: {e}")


# ── Generic article scraper (with social/YouTube routing) ────────────────────

async def fetch_article_text(url: str) -> str:
    """Route to the right extractor based on URL type."""
    if is_youtube_url(url):
        return await extract_youtube_transcript(url)
    if is_twitter_url(url):
        return await extract_twitter_text(url)
    if is_tiktok_url(url):
        return await extract_tiktok_text(url)
    if is_reddit_url(url):
        return await extract_reddit_text(url)
    if is_instagram_url(url):
        return await extract_instagram_text(url)

    # Generic article scraping
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            html = resp.text
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not fetch URL: {e}")

    # newspaper3k (best for news articles)
    try:
        from newspaper import Article
        article = Article(url)
        article.set_html(html)
        article.parse()
        if article.text and len(article.text) >= 100:
            return article.text
    except Exception:
        pass

    # BeautifulSoup fallback
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "nav", "header", "footer", "aside", "form"]):
            tag.decompose()
        article_tag = soup.find("article")
        paragraphs = article_tag.find_all("p") if article_tag else soup.find_all("p")
        text = "\n".join(p.get_text(strip=True) for p in paragraphs if len(p.get_text(strip=True)) > 20)
        if len(text) >= 100:
            return text
    except Exception:
        pass

    raise HTTPException(status_code=400, detail="Could not extract text from URL. Try pasting the text directly.")


# ── Tavily search ─────────────────────────────────────────────────────────────

def search_claim(tavily: TavilyClient, claim: str) -> list[dict]:
    results = []
    try:
        response = tavily.search(query=claim, search_depth="basic", max_results=5, include_answer=True)
        if response.get("answer"):
            results.append({"text": response["answer"], "source": "Tavily Web Search"})
        for r in response.get("results", []):
            if r.get("content") and len(r["content"]) > 50:
                domain = r.get("url", "").split("/")[2] if r.get("url") else "Web"
                results.append({"text": r["content"][:400], "source": domain})
    except Exception:
        pass
    return results[:5]


# ── Static HTML pages ─────────────────────────────────────────────────────────

@app.get("/teacher")
async def serve_teacher():
    return FileResponse(BASE_DIR / "teacher.html")

@app.get("/student")
async def serve_student():
    return FileResponse(BASE_DIR / "student.html")

@app.get("/app")
async def serve_app():
    return FileResponse(BASE_DIR / "cronkite-edu.html")


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}


# ── Analyse endpoint ──────────────────────────────────────────────────────────

@app.post("/analyse")
async def analyse(req: AnalyseRequest):
    article_text = req.text
    article_url = req.url

    if not article_text and article_url:
        article_text = await fetch_article_text(article_url)

    if not article_text or len(article_text) < 100:
        raise HTTPException(status_code=400, detail="Too short. Please provide more text or a valid article URL.")

    try:
        groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
        tavily_client = TavilyClient(api_key=os.environ.get("TAVILY_API_KEY"))

        # Step 1: Extract claims
        extract_response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": (
                "Extract 4-6 important verifiable factual claims from this article. "
                "Ignore opinions. Return ONLY a JSON array of short claim strings.\n"
                f"ARTICLE:\n{article_text[:6000]}\n"
                'Format: ["Claim 1", "Claim 2"]'
            )}],
            temperature=0.1
        )
        raw_claims = extract_response.choices[0].message.content.strip()
        start = raw_claims.find("[")
        end = raw_claims.rfind("]") + 1
        claims_list = json.loads(raw_claims[start:end])

        # Step 2: Search internet for each claim
        search_context = ""
        for claim in claims_list:
            results = search_claim(tavily_client, claim)
            search_context += f"\nCLAIM: {claim}\n"
            if results:
                search_context += "WEB EVIDENCE:\n"
                for r in results:
                    search_context += f"  [{r['source']}]: {r['text']}\n"
            else:
                search_context += "WEB EVIDENCE: None found\n"

        # Step 3: Full analysis including language flagging
        judge_response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": (
                "You are an expert fact-checker, media bias analyst, and linguist.\n\n"

                "FACT-CHECKING RULES:\n"
                "- Give a CONFIDENT verdict for every claim using web evidence AND your knowledge\n"
                "- Only use 'Unverified' if evidence is truly absent\n"
                "- Cite actual source domains. Aim for 2-3 sources per claim\n\n"

                "BIAS ANALYSIS RULES:\n"
                "- Assess the article's overall political/ideological bias\n"
                "- bias_score: 0=Far Left, 25=Left, 50=Centre, 75=Right, 100=Far Right\n"
                "- bias_label: Far Left | Left-Leaning | Centre-Left | Centre | Centre-Right | Right-Leaning | Far Right\n"
                "- Look for: loaded language, selective sourcing, framing, omissions, emotional tone\n\n"

                "LANGUAGE FLAGGING RULES — this is critical:\n"
                "Scan the article for biased or loaded language patterns including:\n"
                "1. IDENTITY + CRIME LINKING: Phrases that connect nationality, ethnicity, religion or immigration status with criminal acts\n"
                "   Examples: 'Afghan knifeman', 'Muslim attacker', 'illegal immigrant criminal', 'Romanian gang'\n"
                "   Why it matters: Implies a group's identity caused or is linked to their crime\n"
                "2. DEHUMANISING LANGUAGE: Words that reduce people to objects or animals\n"
                "   Examples: 'swarms of migrants', 'flooding our borders', 'cockroaches'\n"
                "3. LOADED ADJECTIVES: Emotionally charged words that imply judgement beyond the facts\n"
                "   Examples: 'thugs', 'savages', 'radical', 'extremist' used without evidence\n"
                "4. SELECTIVE IDENTITY LABELLING: Mentioning someone's nationality/religion only when they commit crimes, not in positive stories\n"
                "5. EUPHEMISMS FOR BIAS: Language that softens or normalises discriminatory views\n"
                "6. GENERALISATION FROM INDIVIDUAL: Using one person's actions to imply group behaviour\n\n"
                "For each flagged phrase, explain clearly why it is problematic.\n\n"

                "For each claim also assess:\n"
                "- False conclusions, overgeneralisations, assumptions, missing context\n\n"

                f"ARTICLE URL: {article_url}\n"
                f"ARTICLE TEXT:\n{article_text[:4000]}\n"
                f"{search_context}\n\n"

                "Return ONLY valid JSON:\n"
                '{"overall_score": <0-100>, "verdict": "<verdict>", "summary": "<2-3 sentences>", '
                '"bias_score": <0-100>, '
                '"bias_label": "<label>", '
                '"bias_summary": "<2-3 sentences explaining bias>", '
                '"language_flags": [{"phrase": "<exact phrase from article>", "issue": "<clear explanation of why this is problematic>"}], '
                '"claims": [{'
                '"claim": "<claim>", '
                '"verdict": "<Verified|Likely True|Mostly True|Misleading|False Conclusion|Overgeneralisation|Missing Context|Contradicted|Likely False|False|Unverified>", '
                '"score": <0-100>, '
                '"explanation": "<2-3 sentences>", '
                '"nuance": "<issues with conclusions/assumptions/context — empty string if none>", '
                '"sources": ["<source domain>"]}]}'
            )}],
            temperature=0.2
        )

        raw = judge_response.choices[0].message.content.strip()
        if "```" in raw:
            parts = raw.split("```")
            for part in parts:
                p = part.strip()
                if p.startswith("json"):
                    p = p[4:].strip()
                if p.startswith("{"):
                    raw = p
                    break

        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start != -1 and end > start:
            raw = raw[start:end]

        data = json.loads(raw)
        claims = [ClaimResult(**c) for c in data.get("claims", [])]
        language_flags = [LanguageFlag(**f) for f in data.get("language_flags", [])]

        return AnalysisResult(
            overall_score=data.get("overall_score", 50),
            verdict=data.get("verdict", "Unknown"),
            summary=data.get("summary", ""),
            bias_score=data.get("bias_score", 50),
            bias_label=data.get("bias_label", "Centre"),
            bias_summary=data.get("bias_summary", ""),
            language_flags=language_flags,
            claims=claims,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── YouTube transcript endpoint ───────────────────────────────────────────────

@app.get("/youtube/transcript")
async def get_youtube_transcript(url: str):
    """Extract and return a transcript for a YouTube video URL."""
    logger.info(f"GET /youtube/transcript url={url}")
    if not is_youtube_url(url):
        raise HTTPException(status_code=400, detail="Not a valid YouTube URL")
    try:
        text = await extract_youtube_transcript(url)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in /youtube/transcript: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {type(e).__name__}: {e}")
    return {"transcript": text, "length": len(text)}


# ── Education endpoints ───────────────────────────────────────────────────────

@app.get("/modules")
async def list_modules(user: dict = Depends(get_current_user)):
    """List all modules owned by the authenticated teacher."""
    sb = get_supabase()
    result = sb.table("modules").select("*").eq("teacher_id", user["sub"]).order("created_at", desc=True).execute()
    return result.data


@app.post("/modules", status_code=201)
async def create_module(body: ModuleCreate, user: dict = Depends(get_current_user)):
    """Create a new module (teacher only)."""
    sb = get_supabase()
    result = sb.table("modules").insert({
        "teacher_id": user["sub"],
        "title": body.title,
        "description": body.description,
        "focus_point": body.focus_point,
    }).execute()
    return result.data[0]


@app.get("/modules/{module_id}")
async def get_module(module_id: str, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    result = sb.table("modules").select("*").eq("id", module_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Module not found")
    return result.data[0]


@app.get("/modules/{module_id}/assignments")
async def list_assignments(module_id: str, user: dict = Depends(get_current_user)):
    """List all assignments in a module."""
    sb = get_supabase()
    result = sb.table("assignments").select("*").eq("module_id", module_id).order("created_at").execute()
    return result.data


@app.post("/assignments", status_code=201)
async def create_assignment(body: AssignmentCreate, user: dict = Depends(get_current_user)):
    """Add an article assignment to a module (teacher only)."""
    sb = get_supabase()
    result = sb.table("assignments").insert({
        "module_id": body.module_id,
        "article_url": body.article_url,
        "article_title": body.article_title,
    }).execute()
    return result.data[0]


@app.post("/student-results", status_code=201)
async def save_student_result(body: StudentResultCreate, user: dict = Depends(get_current_user)):
    """Save a student's fact-check result for an assignment."""
    sb = get_supabase()
    result = sb.table("student_results").insert({
        "student_id": user["sub"],
        "assignment_id": body.assignment_id,
        "analysis_json": body.analysis_json,
    }).execute()
    return result.data[0]


@app.get("/student-results/{assignment_id}")
async def get_assignment_results(assignment_id: str, user: dict = Depends(get_current_user)):
    """Get all student results for an assignment (teacher view)."""
    sb = get_supabase()
    result = (
        sb.table("student_results")
        .select("*, users(name, email)")
        .eq("assignment_id", assignment_id)
        .order("completed_at")
        .execute()
    )
    return result.data


@app.get("/my-results")
async def get_my_results(user: dict = Depends(get_current_user)):
    """Get the authenticated student's own results."""
    sb = get_supabase()
    result = (
        sb.table("student_results")
        .select("*, assignments(article_title, article_url, module_id)")
        .eq("student_id", user["sub"])
        .order("completed_at", desc=True)
        .execute()
    )
    return result.data
