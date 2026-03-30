"""
Cronkite Always-On Monitoring Agent
Runs every hour. Scans monitored sources, analyses articles,
groups into stories, runs triangulation, detects narratives.
"""

import os
import asyncio
import json
import logging
import re
import feedparser
import httpx
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse
from supabase import create_client
from tavily import TavilyClient

logger = logging.getLogger(__name__)


def get_svc():
    return create_client(
        os.getenv('SUPABASE_URL', ''),
        os.getenv('SUPABASE_SERVICE_KEY', '')
    )


# ── Step 1: Fetch new articles from a source ────────────────────────────────

async def fetch_new_articles_from_source(source: dict) -> list:
    """
    Fetch new articles from a source.
    Try RSS feed first, fall back to Tavily search.
    Only return articles not already in the articles table (check by URL).
    Return list of {title, url, published_at, source_name, source_domain}
    Limit to 10 most recent articles per source per cycle.
    """
    candidates = []

    # Try RSS first
    if source.get('rss_feed_url'):
        try:
            feed = feedparser.parse(source['rss_feed_url'])
            for entry in feed.entries[:15]:
                url = entry.get('link', '')
                if not url:
                    continue
                title = entry.get('title', '')
                published = entry.get('published_parsed') or entry.get('updated_parsed')
                pub_dt = None
                if published:
                    try:
                        from time import mktime
                        pub_dt = datetime.fromtimestamp(mktime(published), tz=timezone.utc).isoformat()
                    except Exception:
                        pass
                candidates.append({
                    'title': title,
                    'url': url,
                    'published_at': pub_dt,
                    'source_name': source['name'],
                    'source_domain': source['domain'],
                })
            logger.info(f"[Monitor] RSS returned {len(candidates)} candidates from {source['name']}")
        except Exception as e:
            logger.warning(f"[Monitor] RSS failed for {source['name']}: {e}")

    # Fall back to Tavily if RSS returned nothing
    if not candidates and source.get('tavily_search_query'):
        try:
            tavily_key = os.getenv('TAVILY_API_KEY')
            if tavily_key:
                tavily = TavilyClient(api_key=tavily_key)
                results = tavily.search(
                    query=source['tavily_search_query'],
                    max_results=10,
                    days=1,
                )
                for r in results.get('results', []):
                    candidates.append({
                        'title': r.get('title', ''),
                        'url': r.get('url', ''),
                        'published_at': None,
                        'source_name': source['name'],
                        'source_domain': source['domain'],
                    })
                logger.info(f"[Monitor] Tavily returned {len(candidates)} candidates from {source['name']}")
        except Exception as e:
            logger.warning(f"[Monitor] Tavily failed for {source['name']}: {e}")

    if not candidates:
        return []

    # Deduplicate by URL
    seen_urls = set()
    unique = []
    for c in candidates:
        if c['url'] not in seen_urls:
            seen_urls.add(c['url'])
            unique.append(c)
    candidates = unique[:10]

    # Check which URLs are already in the articles table
    svc = get_svc()
    urls = [c['url'] for c in candidates]
    try:
        existing = svc.table('articles').select('url').in_('url', urls).execute()
        existing_urls = {r['url'] for r in (existing.data or [])}
    except Exception as e:
        logger.warning(f"[Monitor] URL check failed: {e}")
        existing_urls = set()

    new_articles = [c for c in candidates if c['url'] not in existing_urls]
    logger.info(f"[Monitor] {source['name']}: {len(new_articles)} new articles (filtered {len(candidates) - len(new_articles)} existing)")
    return new_articles


# ── Step 2: Analyse article for monitoring ───────────────────────────────────

async def analyse_article_for_monitoring(url: str, source_name: str, source_domain: str) -> dict:
    """
    Run analysis on an article via the existing analyse_url_internal().
    Store result in articles table with auto_generated=True, monitoring_source=source_name.
    Return {article_id, title, bias_score, credibility_score, author, source}
    """
    try:
        # Import the existing analysis function
        from main import analyse_url_internal
        data = await analyse_url_internal(url)

        # Store in articles table
        svc = get_svc()
        insert_res = svc.table('articles').insert({
            'url': url,
            'title': data.get('title', ''),
            'source': data.get('source', source_name),
            'summary': data.get('summary', ''),
            'content_type': data.get('content_type', 'news_article'),
            'analysis': data,
            'status': 'analysed',
            'auto_generated': True,
            'monitoring_source': source_name,
        }).execute()

        article_id = insert_res.data[0]['id'] if insert_res.data else None

        return {
            'article_id': article_id,
            'title': data.get('title', ''),
            'bias_score': data.get('bias_direction', 0),
            'credibility_score': data.get('overall_credibility_score', 50),
            'author': data.get('author'),
            'source': data.get('source', source_name),
            'summary': data.get('summary', ''),
        }
    except Exception as e:
        logger.error(f"[Monitor] Analysis failed for {url}: {e}")
        return None


# ── Step 3: Find or create story ─────────────────────────────────────────────

async def find_or_create_story(article_data: dict, analysis: dict) -> str:
    """
    Determine if this article belongs to an existing active story (updated in last 24h)
    or if a new story should be created.
    Use Claude Haiku to compare article headline/summary against recent story headlines.
    Return story_id.
    """
    svc = get_svc()

    # Get recent active stories
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    stories_res = svc.table('stories').select('id, headline, keywords').eq('active', True).gte('last_updated', cutoff).execute()
    recent_stories = stories_res.data or []

    if not recent_stories:
        # No recent stories — create new one
        return await _create_story(svc, analysis)

    # Use Claude Haiku to match
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))

        story_list = "\n".join(
            f"- ID: {s['id']} | Headline: {s['headline']}"
            for s in recent_stories[:30]
        )

        response = client.messages.create(
            model='claude-haiku-4-5-20251001',
            max_tokens=200,
            messages=[{
                "role": "user",
                "content": f"""Does this article belong to one of the existing stories below?

Article title: {analysis.get('title', '')}
Article summary: {analysis.get('summary', '')[:200]}

Existing stories:
{story_list}

Reply with ONLY the story ID if it matches an existing story, or "NEW" if this is a new story. Nothing else."""
            }]
        )

        answer = response.content[0].text.strip()

        # Check if the answer is a valid story ID
        matching_ids = {s['id'] for s in recent_stories}
        if answer in matching_ids:
            # Update existing story
            story = next(s for s in recent_stories if s['id'] == answer)
            svc.table('stories').update({
                'last_updated': datetime.now(timezone.utc).isoformat(),
            }).eq('id', answer).execute()
            return answer

    except Exception as e:
        logger.warning(f"[Monitor] Story matching failed: {e}")

    # Create new story
    return await _create_story(svc, analysis)


async def _create_story(svc, analysis: dict) -> str:
    """Create a new story from an article analysis."""
    headline = analysis.get('title', 'Untitled Story')
    # Shorten to a story-level headline
    if len(headline) > 120:
        headline = headline[:117] + '...'

    insert_res = svc.table('stories').insert({
        'headline': headline,
        'topic': analysis.get('content_type', ''),
        'keywords': json.dumps([]),
        'article_count': 1,
        'source_count': 1,
        'bias_range_left': analysis.get('bias_score', 0),
        'bias_range_right': analysis.get('bias_score', 0),
        'bias_spread': 0,
        'trending': False,
        'active': True,
    }).execute()

    return insert_res.data[0]['id'] if insert_res.data else None


# ── Step 4: Triangulation ────────────────────────────────────────────────────

async def run_triangulation(story_id: str) -> dict:
    """
    For stories with 3+ articles from different sources:
    1. Get all article bias scores for this story
    2. Calculate bias_range_left, bias_range_right, bias_spread
    3. If spread > 30 points, generate neutral_summary using Claude Haiku
    4. Update stories table with results
    """
    svc = get_svc()

    # Get linked articles
    articles_res = svc.table('story_articles').select(
        'bias_score, credibility_score, source'
    ).eq('story_id', story_id).execute()
    articles = articles_res.data or []

    if len(articles) < 2:
        return {}

    bias_scores = [a['bias_score'] for a in articles if a.get('bias_score') is not None]
    if not bias_scores:
        return {}

    bias_left = min(bias_scores)
    bias_right = max(bias_scores)
    bias_spread = bias_right - bias_left
    source_count = len(set(a.get('source', '') for a in articles))

    update_data = {
        'bias_range_left': bias_left,
        'bias_range_right': bias_right,
        'bias_spread': bias_spread,
        'article_count': len(articles),
        'source_count': source_count,
        'trending': len(articles) >= 5 or source_count >= 4,
        'last_updated': datetime.now(timezone.utc).isoformat(),
    }

    # Generate neutral summary if significant bias spread
    if bias_spread > 30 and len(articles) >= 3:
        try:
            # Get full article data for summary
            full_res = svc.table('story_articles').select(
                'source, bias_score, articles(title, summary, source)'
            ).eq('story_id', story_id).execute()
            full_articles = full_res.data or []

            article_summaries = "\n".join(
                f"- {a.get('source', 'Unknown')} (bias: {a.get('bias_score', '?')}): {a.get('articles', {}).get('summary', '')[:150]}"
                for a in full_articles[:8]
            )

            import anthropic
            client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))
            response = client.messages.create(
                model='claude-haiku-4-5-20251001',
                max_tokens=300,
                messages=[{
                    "role": "user",
                    "content": f"""Write a neutral 2-3 sentence summary of this news story based on multiple sources.
Focus on verified facts only, noting where sources disagree.

Sources covering this story:
{article_summaries}

Write the summary now — no preamble."""
                }]
            )
            update_data['neutral_summary'] = response.content[0].text.strip()
        except Exception as e:
            logger.warning(f"[Monitor] Neutral summary generation failed: {e}")

    svc.table('stories').update(update_data).eq('id', story_id).execute()

    return {
        'bias_range_left': bias_left,
        'bias_range_right': bias_right,
        'bias_spread': bias_spread,
        'neutral_summary': update_data.get('neutral_summary'),
    }


# ── Step 5: Narrative pattern detection ──────────────────────────────────────

async def detect_narrative_patterns(story_id: str) -> list:
    """
    Detect coordinated framing patterns and insert alerts.
    """
    svc = get_svc()
    inserted_alerts = []

    articles_res = svc.table('story_articles').select(
        'source, bias_score, credibility_score, published_at, article_id'
    ).eq('story_id', story_id).execute()
    articles = articles_res.data or []

    if len(articles) < 3:
        return []

    # ── coordinated_framing: 3+ articles with bias within 15 points ──────
    bias_scores = [(a.get('bias_score', 0), a.get('source', '')) for a in articles if a.get('bias_score') is not None]
    if len(bias_scores) >= 3:
        # Check if any cluster of 3+ has bias within 15 points
        sorted_bias = sorted(bias_scores, key=lambda x: x[0])
        for i in range(len(sorted_bias) - 2):
            cluster = []
            for j in range(i, len(sorted_bias)):
                if sorted_bias[j][0] - sorted_bias[i][0] <= 15:
                    cluster.append(sorted_bias[j])
                else:
                    break
            if len(cluster) >= 3:
                outlets = list(set(c[1] for c in cluster))
                avg_bias = sum(c[0] for c in cluster) / len(cluster)
                bias_dir = 'left' if avg_bias < -15 else 'right' if avg_bias > 15 else 'centre'

                alert = {
                    'story_id': story_id,
                    'alert_type': 'coordinated_framing',
                    'description': f"{len(cluster)} outlets framing this story with similar bias (within 15 points). Average bias: {round(avg_bias)}.",
                    'outlets_involved': json.dumps(outlets),
                    'bias_direction': bias_dir,
                    'severity': 'high' if len(cluster) >= 5 else 'medium',
                    'dismissed': False,
                }
                try:
                    svc.table('narrative_alerts').insert(alert).execute()
                    inserted_alerts.append(alert)
                except Exception as e:
                    logger.warning(f"[Monitor] Alert insert failed: {e}")
                break  # Only one coordinated_framing alert per story

    # ── breaking_story: 5+ sources within short timeframe ────────────────
    if len(articles) >= 5:
        timed = [a for a in articles if a.get('published_at')]
        if len(timed) >= 5:
            try:
                times = sorted([datetime.fromisoformat(a['published_at'].replace('Z', '+00:00')) for a in timed])
                # Check if 5+ articles within 2 hours
                for i in range(len(times) - 4):
                    if (times[i + 4] - times[i]).total_seconds() <= 7200:
                        outlets = list(set(a.get('source', '') for a in articles))
                        alert = {
                            'story_id': story_id,
                            'alert_type': 'breaking_story',
                            'description': f"Breaking: {len(articles)} sources covered this story within a short timeframe.",
                            'outlets_involved': json.dumps(outlets[:10]),
                            'severity': 'high' if len(articles) >= 8 else 'medium',
                            'dismissed': False,
                        }
                        svc.table('narrative_alerts').insert(alert).execute()
                        inserted_alerts.append(alert)
                        break
            except Exception as e:
                logger.warning(f"[Monitor] Breaking story detection failed: {e}")

    return inserted_alerts


# ── Main orchestration ───────────────────────────────────────────────────────

async def run_monitoring_cycle():
    """
    Main orchestration function — called by scheduler every hour.
    """
    logger.info("[Monitor] ═══ Starting monitoring cycle ═══")
    cycle_start = datetime.now(timezone.utc)
    svc = get_svc()

    # 1. Get all active monitored sources
    sources_res = svc.table('monitored_sources').select('*').eq('active', True).execute()
    sources = sources_res.data or []
    logger.info(f"[Monitor] {len(sources)} active sources to check")

    total_articles = 0
    stories_updated = set()

    # 2. Process each source with staggered delays
    for i, source in enumerate(sources):
        source_name = source['name']
        try:
            # 2a. Fetch new articles
            new_articles = await fetch_new_articles_from_source(source)
            if not new_articles:
                logger.info(f"[Monitor] {source_name}: no new articles")
                # Update last_checked even if no articles
                svc.table('monitored_sources').update({
                    'last_checked': datetime.now(timezone.utc).isoformat(),
                }).eq('id', source['id']).execute()
                if i < len(sources) - 1:
                    await asyncio.sleep(1)
                continue

            for article in new_articles:
                try:
                    # 2b. Analyse each new article
                    analysis = await analyse_article_for_monitoring(
                        article['url'], article['source_name'], article['source_domain']
                    )
                    if not analysis or not analysis.get('article_id'):
                        continue

                    total_articles += 1

                    # 2c. Find or create story
                    story_id = await find_or_create_story(article, analysis)
                    if not story_id:
                        continue

                    stories_updated.add(story_id)

                    # 2d. Link article to story
                    svc.table('story_articles').upsert({
                        'story_id': story_id,
                        'article_id': analysis['article_id'],
                        'source': analysis.get('source', article['source_name']),
                        'bias_score': analysis.get('bias_score', 0),
                        'credibility_score': analysis.get('credibility_score', 50),
                        'published_at': article.get('published_at'),
                    }, on_conflict='story_id,article_id').execute()

                except Exception as e:
                    logger.error(f"[Monitor] Article processing error ({article.get('url', '?')}): {e}")
                    continue

            # Update source metadata
            svc.table('monitored_sources').update({
                'last_checked': datetime.now(timezone.utc).isoformat(),
                'last_article_found': datetime.now(timezone.utc).isoformat() if new_articles else source.get('last_article_found'),
                'articles_found_24h': len(new_articles),
            }).eq('id', source['id']).execute()

        except Exception as e:
            logger.error(f"[Monitor] Source failed ({source_name}): {e}")
            continue

        # Stagger between sources
        if i < len(sources) - 1:
            await asyncio.sleep(2)

    # 3. Post-processing for updated stories
    for story_id in stories_updated:
        try:
            # 3a. Run triangulation
            await run_triangulation(story_id)
            # 3b. Detect narrative patterns
            await detect_narrative_patterns(story_id)
        except Exception as e:
            logger.error(f"[Monitor] Post-processing failed for story {story_id}: {e}")

    # 4. Log summary
    elapsed = (datetime.now(timezone.utc) - cycle_start).total_seconds()
    logger.info(
        f"[Monitor] ═══ Cycle complete: {len(sources)} sources checked, "
        f"{total_articles} articles analysed, {len(stories_updated)} stories updated, "
        f"{elapsed:.0f}s elapsed ═══"
    )
