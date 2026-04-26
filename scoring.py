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


def score_article_credibility(
    url: str,
    title: str,
    content: str,
    source: str,
    author: str = '',
) -> dict:
    """Wrapper used by main.py endpoints — calls calculate_credibility_score
    with the domain extracted from the URL and the author name."""
    try:
        from urllib.parse import urlparse as _up
        domain = _up(url).netloc.replace('www.', '') if url.startswith('http') else source
    except Exception:
        domain = source
    return calculate_credibility_score(
        source_domain=domain,
        author_name=author or None,
        claude_assessment={
            'claim_verifiability': 50,
            'language_neutrality': 50,
            'authorship_transparency': 50,
            'cross_source_consensus': 50,
        },
    )


def score_article_bias(
    url: str,
    title: str,
    content: str,
    source: str,
) -> dict:
    """Wrapper used by main.py endpoints — calls calculate_bias_score with
    neutral defaults (0) since we don't run a full Claude analysis here)."""
    return calculate_bias_score({
        'lexical_bias': 0,
        'source_selection': 0,
        'narrative_framing': 0,
        'omission': 0,
    })


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
