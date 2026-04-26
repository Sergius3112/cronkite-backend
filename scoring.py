"""
Cronkite Truth Formula — Central Scoring Module
Version 1.0
All credibility and bias scoring across Cronkite runs through this module.
"""

import os
import json
import logging
from typing import Optional
from supabase import create_client

logger = logging.getLogger(__name__)

# ── CREDIBILITY SCORE WEIGHTS ──────────────────────────────────────────────
# Total must equal 1.0
CREDIBILITY_WEIGHTS = {
    'source_trust': 0.20,
    'claim_verifiability': 0.25,
    'language_neutrality': 0.20,
    'authorship_transparency': 0.15,
    'cross_source_consensus': 0.20,
}

# ── BIAS SCORE WEIGHTS ─────────────────────────────────────────────────────
# Applied to raw Claude bias assessment (-100 to +100)
BIAS_WEIGHTS = {
    'lexical_bias': 0.30,
    'source_selection': 0.25,
    'narrative_framing': 0.25,
    'omission': 0.20,
}

FORMULA_VERSION = '1.0'


def get_publication_trust(domain: str) -> Optional[int]:
    """Look up publication base trust score from database."""
    try:
        url = os.getenv('SUPABASE_URL', '')
        key = os.getenv('SUPABASE_SERVICE_KEY', '')
        svc = create_client(url, key)
        domain_clean = domain.replace('www.', '')
        result = svc.table('publications').select('base_trust_score').ilike('domain', f'%{domain_clean}%').single().execute()
        return result.data.get('base_trust_score') if result.data else None
    except Exception as e:
        logger.error(f"Publication trust lookup error: {e}")
        return None


def get_entity_trust(name: str) -> Optional[dict]:
    """Look up entity trust score and flags from database."""
    try:
        url = os.getenv('SUPABASE_URL', '')
        key = os.getenv('SUPABASE_SERVICE_KEY', '')
        svc = create_client(url, key)
        result = svc.table('entities').select(
            'base_trust_score, conflict_of_interest_flags, political_leaning, student_summary, verified, flagged_for_review'
        ).ilike('name', f'%{name}%').limit(1).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        logger.error(f"Entity trust lookup error: {e}")
        return None


def calculate_credibility_score(
    source_domain: str,
    author_name: Optional[str],
    claude_assessment: dict,
) -> dict:
    """
    Calculate Cronkite Credibility Score (0-100).

    claude_assessment should contain:
    - claim_verifiability: 0-100
    - language_neutrality: 0-100
    - authorship_transparency: 0-100
    - cross_source_consensus: 0-100 (optional, defaults to 50)
    """

    # Source trust — from database or default
    pub_trust = get_publication_trust(source_domain)
    source_trust = pub_trust if pub_trust is not None else 50

    # Author trust modifier
    author_modifier = 0
    author_data = None
    if author_name:
        author_data = get_entity_trust(author_name)
        if author_data and author_data.get('base_trust_score'):
            author_modifier = (author_data['base_trust_score'] - 50) * 0.1

    # Component scores
    components = {
        'source_trust': source_trust,
        'claim_verifiability': claude_assessment.get('claim_verifiability', 50),
        'language_neutrality': claude_assessment.get('language_neutrality', 50),
        'authorship_transparency': claude_assessment.get('authorship_transparency', 50),
        'cross_source_consensus': claude_assessment.get('cross_source_consensus', 50),
    }

    # Weighted score
    raw_score = sum(
        components[k] * CREDIBILITY_WEIGHTS[k]
        for k in CREDIBILITY_WEIGHTS
    )

    # Apply author modifier
    final_score = max(0, min(100, round(raw_score + author_modifier)))

    # Conflict of interest flags
    coi_flags = []
    if author_data and author_data.get('conflict_of_interest_flags'):
        coi_flags = author_data['conflict_of_interest_flags']

    return {
        'score': final_score,
        'components': components,
        'source_trust': source_trust,
        'author_trust': author_data.get('base_trust_score') if author_data else None,
        'conflict_of_interest_flags': coi_flags,
        'author_verified': author_data.get('verified', False) if author_data else False,
        'formula_version': FORMULA_VERSION,
    }


def calculate_bias_score(claude_assessment: dict) -> dict:
    """
    Calculate Cronkite Bias Score (-100 to +100).

    claude_assessment should contain:
    - lexical_bias: -100 to +100
    - source_selection: -100 to +100
    - narrative_framing: -100 to +100
    - omission: -100 to +100
    """
    components = {
        'lexical_bias': claude_assessment.get('lexical_bias', 0),
        'source_selection': claude_assessment.get('source_selection', 0),
        'narrative_framing': claude_assessment.get('narrative_framing', 0),
        'omission': claude_assessment.get('omission', 0),
    }

    raw_score = sum(
        components[k] * BIAS_WEIGHTS[k]
        for k in BIAS_WEIGHTS
    )

    final_score = max(-100, min(100, round(raw_score)))

    bias_label = (
        'far-left' if final_score <= -70 else
        'left' if final_score <= -40 else
        'centre-left' if final_score <= -15 else
        'centre' if final_score <= 15 else
        'centre-right' if final_score <= 40 else
        'right' if final_score <= 70 else
        'far-right'
    )

    return {
        'score': final_score,
        'label': bias_label,
        'components': components,
        'formula_version': FORMULA_VERSION,
    }


# ── ARTICLE ANALYSIS — CLAUDE-POWERED FORMULA INPUT ─────────────────────────

# This function is the analytical heart of the Truth Formula. It takes raw article
# text and returns the 9-component claude_assessment dict that calculate_credibility_score()
# and calculate_bias_score() expect. Without this function, those aggregators default to 50/0.

ARTICLE_ANALYSIS_RUBRIC = """You are Cronkite's analytical engine. You are NOT a chat model. You are scoring an article against a fixed rubric and returning JSON. No commentary, no caveats, no preamble.

You must score the article on 9 components. Five contribute to credibility (0-100 scale, higher = more credible). Four contribute to bias (-100 to +100 scale, negative = left-leaning, positive = right-leaning, zero = balanced).

═══════════════════════════════════════════════════════════════════
CREDIBILITY COMPONENTS (0-100, higher = more credible)
═══════════════════════════════════════════════════════════════════

1. claim_verifiability (0-100)
How verifiable are the article's central factual claims?
  90-100: All key claims are specific, dated, attributed to named sources, or refer to public records (Hansard, ONS, court documents, peer-reviewed studies).
  70-89:  Most claims are specific and attributed; a few are vague or attributed to "sources" / "experts".
  50-69:  Mix of verifiable and unverifiable claims. Heavy use of unnamed sources or "it is understood".
  30-49:  Mostly assertions with little attribution. Generalised claims about groups or trends without data.
  0-29:   Vague accusations, unattributed quotes, claims that contradict public record, or pure opinion presented as fact.

2. language_neutrality (0-100)
Does the language report the story or push the reader toward a conclusion?
  90-100: Plain factual register. No loaded adjectives. No emotive metaphors. Reads like Reuters or AP.
  70-89:  Mostly neutral with occasional mild colouring ("controversial", "alleged").
  50-69:  Noticeable rhetorical framing — emotive verbs, loaded adjectives, suggestive metaphors.
  30-49:  Heavy rhetorical loading. Examples: "swarms of migrants", "Afghan knifeman" (identity-plus-crime), "tax-and-spend Labour", "far-right firebrand" applied without qualification, dehumanising metaphors (vermin, plague, parasites).
  0-29:   Article reads as advocacy. Sustained emotive language replacing fact. Slurs, dog-whistles, or open dehumanisation.

  CRITICAL — emotive language operating AS rhetoric (replacing fact with feeling) is the core thing this dimension measures. Apply equally across the political spectrum: "gammon", "TERF", "manosphere", and "Karen" all score the same way as "snowflake", "woke mob", and "feminazi".

3. authorship_transparency (0-100)
Is the author named, are their credentials clear, are conflicts of interest disclosed?
  90-100: Author named, role/expertise stated, any relevant interests disclosed in-text or via byline.
  70-89:  Author named, role implied. No COI section but no obvious COI either.
  50-69:  Author named only, no context. Or staff byline ("Mail Reporter", "Telegraph staff").
  30-49:  No author or only a publication-level attribution. Or named author writing outside their disclosed expertise.
  0-29:   Anonymous, ghost-bylined, or written by someone with an undisclosed financial/political interest in the subject.

4. cross_source_consensus (0-100)
Without searching, judge: does this article's framing align with how mainstream UK outlets across the spectrum would report the same facts? Or is it an outlier framing?
  90-100: Story would be reported essentially the same way by BBC, Reuters, FT, and Guardian/Telegraph (allowing for tonal differences).
  70-89:  Core facts agree across the spectrum but framing tilts.
  50-69:  Significant framing divergence likely between this outlet and others.
  30-49:  Framing is contested — the same facts would be told as a different story by other outlets.
  0-29:   The framing is an outlier. The article makes claims or implications that other mainstream outlets would not make from the same facts.

5. (source_trust is provided separately by the database lookup, not by you — do not score it.)

═══════════════════════════════════════════════════════════════════
BIAS COMPONENTS (-100 to +100, negative = left, positive = right, 0 = balanced)
═══════════════════════════════════════════════════════════════════

1. lexical_bias (-100 to +100)
Word choices that carry political loading.
  -100 to -70: Heavy use of left-coded terms ("austerity victims", "the 1%", "billionaire class", "structural racism", "gammon", "TERF").
  -69 to -30:  Moderate left framing in word choice.
  -29 to +29:  Balanced or neutral vocabulary.
  +30 to +69:  Moderate right framing ("woke mob", "elites", "lefty", "snowflake", "virtue signalling").
  +70 to +100: Heavy right-coded terms ("invasion", "swarms", "groomers", "Marxist", "deep state", "great replacement", identity-plus-crime framing like "Afghan knifeman", "Somali rapist").

2. source_selection (-100 to +100)
Whose voices are quoted? Whose are absent?
  Negative: Predominantly left-leaning sources (TUC, Greenpeace, Compass, Labour MPs, Owen Jones types).
  Positive: Predominantly right-leaning sources (TaxPayers' Alliance, Reform, Conservative MPs, IEA, Spectator commentary).
  Zero: Multiple sides represented or no advocacy sources used.

3. narrative_framing (-100 to +100)
What story does the article tell about cause and blame?
  Negative: Frames problems as caused by inequality, capitalism, austerity, structural racism, or right-wing politics.
  Positive: Frames problems as caused by immigration, wokeism, regulation, the EU, "the metropolitan elite", or left-wing politics.
  Zero: Frames problem in non-partisan terms or presents multiple causal accounts.

4. omission (-100 to +100)
What does the article fail to mention that would change the reader's understanding?
  Negative: Omits context that would make the right-wing case (e.g. cost figures, public opinion data unfavourable to left position).
  Positive: Omits context that would make the left-wing case (e.g. structural data, historical context, voices of affected groups).
  Zero: Comprehensive context, no glaring omissions.

═══════════════════════════════════════════════════════════════════
CALIBRATION ANCHORS (use these to set your scale)
═══════════════════════════════════════════════════════════════════

EXAMPLE A — Reuters wire copy on UK GDP figures:
  claim_verifiability: 90, language_neutrality: 95, authorship_transparency: 70, cross_source_consensus: 95
  lexical_bias: 0, source_selection: 0, narrative_framing: 0, omission: 0

EXAMPLE B — Daily Mail story headlined "Migrant crisis spirals out of control":
  claim_verifiability: 35, language_neutrality: 25, authorship_transparency: 50, cross_source_consensus: 30
  lexical_bias: 75, source_selection: 60, narrative_framing: 70, omission: 60

EXAMPLE C — Guardian comment piece headlined "Tory austerity is killing the NHS":
  claim_verifiability: 50, language_neutrality: 35, authorship_transparency: 80, cross_source_consensus: 45
  lexical_bias: -65, source_selection: -55, narrative_framing: -70, omission: -50

EXAMPLE D — BBC News article on a court ruling:
  claim_verifiability: 90, language_neutrality: 90, authorship_transparency: 75, cross_source_consensus: 90
  lexical_bias: 0, source_selection: -5, narrative_framing: 0, omission: 5

═══════════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════════

Return ONLY a JSON object. No markdown fences. No preamble. No commentary.

{
  "claim_verifiability": <integer 0-100>,
  "language_neutrality": <integer 0-100>,
  "authorship_transparency": <integer 0-100>,
  "cross_source_consensus": <integer 0-100>,
  "lexical_bias": <integer -100 to 100>,
  "source_selection": <integer -100 to 100>,
  "narrative_framing": <integer -100 to 100>,
  "omission": <integer -100 to 100>,
  "rationale": {
    "credibility_brief": "<one sentence, max 25 words, explaining the credibility assessment>",
    "bias_brief": "<one sentence, max 25 words, explaining the bias direction>",
    "key_phrases": ["<up to 3 short verbatim phrases from the article that drove your scoring>"]
  }
}"""


def _default_assessment(reason: str = '', error: str = '') -> dict:
    """Fallback assessment when analysis fails. Marked clearly so callers know
    not to present these as real scores."""
    return {
        'claim_verifiability': 50,
        'language_neutrality': 50,
        'authorship_transparency': 50,
        'cross_source_consensus': 50,
        'lexical_bias': 0,
        'source_selection': 0,
        'narrative_framing': 0,
        'omission': 0,
        'rationale': {
            'credibility_brief': 'Analysis unavailable for this article.',
            'bias_brief': 'Analysis unavailable for this article.',
            'key_phrases': [],
        },
        'analysis_failed': True,
        'failure_reason': reason,
        'failure_detail': error,
    }


def analyse_article_with_claude(
    title: str,
    content: str,
    source: str = '',
    author: str = '',
) -> dict:
    """Run the rubric-based analytical pass that produces a claude_assessment dict.

    This is the function that calculate_credibility_score() and calculate_bias_score()
    have always expected. Until now, callers passed empty dicts, defaulting all components.

    Returns a dict shaped exactly as those aggregators expect, plus a 'rationale' field
    that downstream consumers (chat, reader UI) can use to explain the score to students.

    On failure, returns a dict with all components set to neutral defaults AND a flag
    'analysis_failed': True so the caller can surface this honestly rather than show
    a confidently-neutral fake score.
    """
    if not content or len(content.strip()) < 100:
        return _default_assessment(reason='insufficient_content')

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))

        # Trim content to keep token cost predictable. ~6000 chars ≈ 1500 tokens of input,
        # which is enough for the rubric to read substantively without ballooning cost.
        excerpt = content[:6000]

        user_message = f"""Article to score:

SOURCE: {source or 'unknown'}
AUTHOR: {author or 'not stated'}
TITLE: {title or '(no title)'}

BODY:
\"\"\"
{excerpt}
\"\"\"

Return only the JSON object specified in the rubric. No other text."""

        response = client.messages.create(
            model='claude-sonnet-4-5',
            max_tokens=1500,
            system=ARTICLE_ANALYSIS_RUBRIC,
            messages=[{"role": "user", "content": user_message}],
        )

        result_text = ''
        for block in response.content:
            if getattr(block, 'type', None) == 'text':
                result_text += block.text
        result_text = result_text.strip()

        # Defensive parsing — strip markdown fences if Claude added any
        if result_text.startswith('```'):
            result_text = result_text.split('```', 2)[1]
            if result_text.startswith('json'):
                result_text = result_text[4:]
            result_text = result_text.rsplit('```', 1)[0].strip()

        start = result_text.find('{')
        end = result_text.rfind('}') + 1
        if start < 0 or end <= start:
            logger.error(f"[ANALYSE] No JSON found in response: {result_text[:200]}")
            return _default_assessment(reason='no_json')

        parsed = json.loads(result_text[start:end])

        # Validate all required fields exist and are in range
        required_credibility = ['claim_verifiability', 'language_neutrality', 'authorship_transparency', 'cross_source_consensus']
        required_bias = ['lexical_bias', 'source_selection', 'narrative_framing', 'omission']

        for field in required_credibility:
            val = parsed.get(field)
            if not isinstance(val, (int, float)) or not (0 <= val <= 100):
                logger.warning(f"[ANALYSE] Invalid {field}: {val}, defaulting to 50")
                parsed[field] = 50

        for field in required_bias:
            val = parsed.get(field)
            if not isinstance(val, (int, float)) or not (-100 <= val <= 100):
                logger.warning(f"[ANALYSE] Invalid {field}: {val}, defaulting to 0")
                parsed[field] = 0

        # Coerce to int (rubric specifies integers)
        for field in required_credibility + required_bias:
            parsed[field] = int(round(parsed[field]))

        # Normalise rationale shape
        rationale = parsed.get('rationale') or {}
        if not isinstance(rationale, dict):
            rationale = {}
        parsed['rationale'] = {
            'credibility_brief': str(rationale.get('credibility_brief', ''))[:200],
            'bias_brief': str(rationale.get('bias_brief', ''))[:200],
            'key_phrases': [str(p)[:120] for p in (rationale.get('key_phrases') or [])][:3],
        }
        parsed['analysis_failed'] = False
        return parsed

    except Exception as e:
        logger.error(f"[ANALYSE] Failed: {e}")
        return _default_assessment(reason='exception', error=str(e)[:120])


def auto_populate_entity(name: str, entity_type: str) -> Optional[dict]:
    """
    Use Tavily to auto-populate an entity profile when first encountered.
    Flags as unverified — must be reviewed before affecting scores.
    """
    try:
        from tavily import TavilyClient
        tavily = TavilyClient(api_key=os.getenv('TAVILY_API_KEY'))

        results = tavily.search(
            query=f"{name} {entity_type} UK biography political views financial interests",
            max_results=5,
            days=365
        )

        # Return raw data for Claude to process and structure
        return {
            'name': name,
            'entity_type': entity_type,
            'raw_data': results.get('results', []),
            'auto_populated': True,
            'flagged_for_review': True,
            'verified': False,
        }
    except Exception as e:
        logger.error(f"Entity auto-populate error: {e}")
        return None


# ── Article score caching ───────────────────────────────────────────────────

def get_cached_article_score(url: str) -> Optional[dict]:
    """Look up a previously-scored article by URL from article_scores_cache."""
    try:
        sb_url = os.getenv('SUPABASE_URL', '')
        sb_key = os.getenv('SUPABASE_SERVICE_KEY', '')
        if not sb_url or not sb_key:
            return None
        svc = create_client(sb_url, sb_key)
        result = svc.table('article_scores_cache').select('*').eq('url', url).limit(1).execute()
        if result.data:
            return result.data[0]
        return None
    except Exception as e:
        logger.error(f"Cache lookup error: {e}")
        return None


def cache_article_score(url: str, title: str, source: str, credibility: dict, bias: dict, summary: str = '') -> None:
    """Store a scored article for future fast retrieval. Upserts on url."""
    try:
        sb_url = os.getenv('SUPABASE_URL', '')
        sb_key = os.getenv('SUPABASE_SERVICE_KEY', '')
        if not sb_url or not sb_key:
            return
        svc = create_client(sb_url, sb_key)
        svc.table('article_scores_cache').upsert({
            'url': url,
            'title': title or '',
            'source': source or '',
            'summary': summary or '',
            'credibility_score': credibility.get('score', 50),
            'credibility_components': credibility.get('components', {}),
            'source_trust': credibility.get('source_trust'),
            'author_trust': credibility.get('author_trust'),
            'conflict_of_interest_flags': credibility.get('conflict_of_interest_flags', []),
            'bias_score': bias.get('score', 0),
            'bias_label': bias.get('label', 'centre'),
            'bias_components': bias.get('components', {}),
            'rationale': credibility.get('rationale') or bias.get('rationale') or {},
            'analysis_failed': bool(credibility.get('analysis_failed', False) or bias.get('analysis_failed', False)),
            'formula_version': FORMULA_VERSION,
        }, on_conflict='url').execute()
    except Exception as e:
        logger.error(f"Cache write error: {e}")


# ── Student learning profile ────────────────────────────────────────────────

def _empty_profile(user_id: str) -> dict:
    return {
        'user_id': user_id,
        'ability_level': 'unknown',          # unknown | emerging | developing | confident | advanced
        'strengths': [],                      # list of technique/concept names
        'struggles': [],                      # list of technique/concept names
        'observations_count': 0,
        'last_techniques_covered': [],        # rolling last 10
        'preferred_depth': 'medium',          # short | medium | deep
        'notes': '',
    }


def get_student_profile(user_id: str) -> dict:
    """Load a student's learning profile. Returns empty defaults if none exists."""
    try:
        sb_url = os.getenv('SUPABASE_URL', '')
        sb_key = os.getenv('SUPABASE_SERVICE_KEY', '')
        if not sb_url or not sb_key:
            return _empty_profile(user_id)
        svc = create_client(sb_url, sb_key)
        result = svc.table('student_learning_profiles').select('*').eq('user_id', user_id).limit(1).execute()
        if result.data:
            return result.data[0]
        return _empty_profile(user_id)
    except Exception as e:
        logger.error(f"Profile load error: {e}")
        return _empty_profile(user_id)


def record_learning_observation(user_id: str, observation: dict) -> None:
    """Record a single chat-derived observation and update the rolling profile.

    observation keys (all optional except type):
      - type: 'strength' | 'struggle' | 'technique_covered' | 'ability_signal'
      - technique: str (e.g. 'loaded_language', 'source_evaluation')
      - ability_signal: 'emerging' | 'developing' | 'confident' | 'advanced'
      - note: str (short human-readable context)
      - article_url: str
    """
    try:
        sb_url = os.getenv('SUPABASE_URL', '')
        sb_key = os.getenv('SUPABASE_SERVICE_KEY', '')
        if not sb_url or not sb_key:
            return
        svc = create_client(sb_url, sb_key)

        # Write raw observation
        svc.table('learning_observations').insert({
            'user_id': user_id,
            'type': observation.get('type', ''),
            'technique': observation.get('technique'),
            'ability_signal': observation.get('ability_signal'),
            'note': observation.get('note', ''),
            'article_url': observation.get('article_url', ''),
        }).execute()

        # Load current profile
        profile = get_student_profile(user_id)

        strengths = list(profile.get('strengths') or [])
        struggles = list(profile.get('struggles') or [])
        techniques_covered = list(profile.get('last_techniques_covered') or [])
        ability_level = profile.get('ability_level') or 'unknown'

        obs_type = observation.get('type')
        technique = observation.get('technique')

        if obs_type == 'strength' and technique and technique not in strengths:
            strengths.append(technique)
            if technique in struggles:
                struggles.remove(technique)
        elif obs_type == 'struggle' and technique and technique not in struggles:
            struggles.append(technique)
        elif obs_type == 'technique_covered' and technique:
            if technique in techniques_covered:
                techniques_covered.remove(technique)
            techniques_covered.append(technique)
            techniques_covered = techniques_covered[-10:]
        elif obs_type == 'ability_signal' and observation.get('ability_signal'):
            ability_level = observation['ability_signal']

        # Upsert profile
        svc.table('student_learning_profiles').upsert({
            'user_id': user_id,
            'ability_level': ability_level,
            'strengths': strengths[-20:],
            'struggles': struggles[-20:],
            'last_techniques_covered': techniques_covered,
            'observations_count': (profile.get('observations_count') or 0) + 1,
            'preferred_depth': profile.get('preferred_depth') or 'medium',
            'notes': profile.get('notes') or '',
        }, on_conflict='user_id').execute()

    except Exception as e:
        logger.error(f"Observation record error: {e}")


def compare_sources_on_topic(topic: str, limit: int = 5) -> list:
    """Return publications from the entities DB ranked by base trust, with their known lean.
    Used by chat to answer 'how do different outlets cover this?'"""
    try:
        sb_url = os.getenv('SUPABASE_URL', '')
        sb_key = os.getenv('SUPABASE_SERVICE_KEY', '')
        if not sb_url or not sb_key:
            return []
        svc = create_client(sb_url, sb_key)
        result = svc.table('publications').select(
            'name, domain, base_trust_score, political_leaning'
        ).order('base_trust_score', desc=True).limit(limit).execute()
        return result.data or []
    except Exception as e:
        logger.error(f"Source comparison error: {e}")
        return []


# ── COMPOSED SCORERS — full pipeline used by main.py endpoints ─────────────

def score_article_credibility(
    url: str,
    title: str,
    content: str,
    source: str,
    author: str = '',
) -> dict:
    """Full credibility pipeline: analyse text with rubric, then aggregate via formula.

    Returns the dict shape that calculate_credibility_score() returns, plus a
    'rationale' field so the chat and reader UIs can explain the score.
    """
    assessment = analyse_article_with_claude(
        title=title, content=content, source=source, author=author,
    )

    domain = source
    if url.startswith('http'):
        try:
            domain = url.split('/')[2].replace('www.', '')
        except Exception:
            pass

    result = calculate_credibility_score(
        source_domain=domain,
        author_name=author or None,
        claude_assessment=assessment,
    )

    result['rationale'] = assessment.get('rationale', {})
    if assessment.get('analysis_failed'):
        result['analysis_failed'] = True
        result['failure_reason'] = assessment.get('failure_reason', '')

    return result


def score_article_bias(
    url: str,
    title: str,
    content: str,
    source: str,
) -> dict:
    """Full bias pipeline: analyse text with rubric, then aggregate via formula."""
    assessment = analyse_article_with_claude(
        title=title, content=content, source=source, author='',
    )

    result = calculate_bias_score(claude_assessment=assessment)

    result['rationale'] = assessment.get('rationale', {})
    if assessment.get('analysis_failed'):
        result['analysis_failed'] = True
        result['failure_reason'] = assessment.get('failure_reason', '')

    return result


def score_article_combined(
    url: str,
    title: str,
    content: str,
    source: str,
    author: str = '',
) -> dict:
    """Combined credibility + bias scorer that runs the rubric ONCE.
    Use this when you need both — saves an Anthropic API call vs calling the
    two separate functions.

    Returns: { 'credibility': {...}, 'bias': {...}, 'rationale': {...}, 'analysis_failed': bool }
    """
    assessment = analyse_article_with_claude(
        title=title, content=content, source=source, author=author,
    )

    domain = source
    if url.startswith('http'):
        try:
            domain = url.split('/')[2].replace('www.', '')
        except Exception:
            pass

    credibility = calculate_credibility_score(
        source_domain=domain,
        author_name=author or None,
        claude_assessment=assessment,
    )
    bias = calculate_bias_score(claude_assessment=assessment)

    return {
        'credibility': credibility,
        'bias': bias,
        'rationale': assessment.get('rationale', {}),
        'analysis_failed': assessment.get('analysis_failed', False),
    }
