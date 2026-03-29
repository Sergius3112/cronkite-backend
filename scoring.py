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
