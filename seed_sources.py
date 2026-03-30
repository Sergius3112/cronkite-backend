"""
Cronkite Monitored Sources — Seed Script
Run once after executing the Situation Room SQL migration in Supabase.

Requires: SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.
"""

import os
import sys
from supabase import create_client


SOURCES = [
    {"name": "BBC News", "domain": "bbc.co.uk", "rss_feed_url": "http://feeds.bbci.co.uk/news/rss.xml", "tavily_search_query": "site:bbc.co.uk/news", "priority": "high"},
    {"name": "The Guardian", "domain": "theguardian.com", "rss_feed_url": "https://www.theguardian.com/uk/rss", "tavily_search_query": "site:theguardian.com", "priority": "high"},
    {"name": "Daily Mail", "domain": "dailymail.co.uk", "rss_feed_url": "https://www.dailymail.co.uk/news/index.rss", "tavily_search_query": "site:dailymail.co.uk/news", "priority": "high"},
    {"name": "The Telegraph", "domain": "telegraph.co.uk", "rss_feed_url": "https://www.telegraph.co.uk/rss.xml", "tavily_search_query": "site:telegraph.co.uk", "priority": "high"},
    {"name": "The Times", "domain": "thetimes.co.uk", "rss_feed_url": "https://www.thetimes.co.uk/rss", "tavily_search_query": "site:thetimes.co.uk", "priority": "high"},
    {"name": "GB News", "domain": "gbnews.com", "rss_feed_url": "https://www.gbnews.com/feed", "tavily_search_query": "site:gbnews.com", "priority": "high"},
    {"name": "Sky News", "domain": "sky.com", "rss_feed_url": "https://feeds.skynews.com/feeds/rss/home.xml", "tavily_search_query": "site:news.sky.com", "priority": "high"},
    {"name": "The Independent", "domain": "independent.co.uk", "rss_feed_url": "https://www.independent.co.uk/news/rss", "tavily_search_query": "site:independent.co.uk", "priority": "high"},
    {"name": "Daily Mirror", "domain": "mirror.co.uk", "rss_feed_url": "https://www.mirror.co.uk/news/rss.xml", "tavily_search_query": "site:mirror.co.uk/news", "priority": "medium"},
    {"name": "The Sun", "domain": "thesun.co.uk", "rss_feed_url": "https://www.thesun.co.uk/news/feed/", "tavily_search_query": "site:thesun.co.uk/news", "priority": "medium"},
    {"name": "Financial Times", "domain": "ft.com", "rss_feed_url": "https://www.ft.com/rss/home/uk", "tavily_search_query": "site:ft.com", "priority": "medium"},
    {"name": "Channel 4 News", "domain": "channel4.com", "rss_feed_url": "https://www.channel4.com/news/feed/", "tavily_search_query": "site:channel4.com/news", "priority": "medium"},
    {"name": "ITV News", "domain": "itv.com", "rss_feed_url": "https://www.itv.com/news/rss", "tavily_search_query": "site:itv.com/news", "priority": "medium"},
    {"name": "Reuters UK", "domain": "reuters.com", "rss_feed_url": "https://feeds.reuters.com/reuters/UKdomesticNews", "tavily_search_query": "site:reuters.com UK", "priority": "medium"},
    {"name": "The Spectator", "domain": "spectator.co.uk", "rss_feed_url": "https://www.spectator.co.uk/feed/", "tavily_search_query": "site:spectator.co.uk", "priority": "low"},
    {"name": "New Statesman", "domain": "newstatesman.com", "rss_feed_url": "https://www.newstatesman.com/feed/", "tavily_search_query": "site:newstatesman.com", "priority": "low"},
    {"name": "Novara Media", "domain": "novaramedia.com", "rss_feed_url": "https://novaramedia.com/feed/", "tavily_search_query": "site:novaramedia.com", "priority": "low"},
    {"name": "Conservative Party", "domain": "conservatives.com", "rss_feed_url": None, "tavily_search_query": "site:conservatives.com news", "priority": "low"},
    {"name": "Labour Party", "domain": "labour.org.uk", "rss_feed_url": None, "tavily_search_query": "site:labour.org.uk news", "priority": "low"},
    {"name": "Reform UK", "domain": "reformparty.uk", "rss_feed_url": None, "tavily_search_query": "site:reformparty.uk news", "priority": "low"},
]


def seed():
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not url or not key:
        print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables")
        sys.exit(1)

    supa = create_client(url, key)

    print(f"Seeding {len(SOURCES)} monitored sources...")
    for s in SOURCES:
        row = {
            "name": s["name"],
            "domain": s["domain"],
            "rss_feed_url": s["rss_feed_url"],
            "tavily_search_query": s["tavily_search_query"],
            "priority": s["priority"],
            "active": True,
            "check_frequency_minutes": 60,
        }
        try:
            supa.table("monitored_sources").upsert(row, on_conflict="domain").execute()
            print(f"  \u2713 {s['name']}")
        except Exception as err:
            print(f"  \u2717 {s['name']}: {err}")

    print("\nDone!")


if __name__ == "__main__":
    seed()
