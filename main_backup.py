from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
from tavily import TavilyClient
import json, os

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class AnalyseRequest(BaseModel):
    text: str
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

@app.get("/health")
async def health():
    return {"status": "ok"}

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
    except:
        pass
    return results[:5]

@app.post("/analyse")
async def analyse(req: AnalyseRequest):
    if len(req.text) < 100:
        raise HTTPException(status_code=400, detail="Too short.")
    try:
        groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
        tavily_client = TavilyClient(api_key=os.environ.get("TAVILY_API_KEY"))

        # Step 1: Extract claims
        extract_response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": (
                "Extract 4-6 important verifiable factual claims from this article. "
                "Ignore opinions. Return ONLY a JSON array of short claim strings.\n"
                f"ARTICLE:\n{req.text[:6000]}\n"
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

                f"ARTICLE URL: {req.url}\n"
                f"ARTICLE TEXT:\n{req.text[:4000]}\n"
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
                if p.startswith("json"): p = p[4:].strip()
                if p.startswith("{"): raw = p; break

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
            claims=claims
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
