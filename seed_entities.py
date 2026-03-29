"""
Cronkite Entity Trust System — Seed Script
Run once after executing the SQL migration in Supabase.

═══════════════════════════════════════════════════════════════════════════════
SQL MIGRATION — Run this in the Supabase SQL Editor BEFORE running this script
═══════════════════════════════════════════════════════════════════════════════

create table public.entities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  entity_type text not null check (entity_type in (
    'politician', 'journalist', 'editor', 'media_owner',
    'tech_ceo', 'influencer', 'commentator', 'academic',
    'think_tank', 'corporation', 'government_body'
  )),
  entity_role text,
  current_organisation text,
  employment_history jsonb default '[]',
  education jsonb default '[]',
  estimated_net_worth text,
  known_investments jsonb default '[]',
  board_positions jsonb default '[]',
  speaking_fees_received jsonb default '[]',
  donations_made jsonb default '[]',
  donations_received jsonb default '[]',
  party_affiliation text,
  political_leaning text check (political_leaning in (
    'far-left','left','centre-left','centre',
    'centre-right','right','far-right','libertarian','unknown'
  )),
  voting_record_url text,
  publicly_stated_positions jsonb default '[]',
  notable_connections jsonb default '[]',
  verified_claims_count integer default 0,
  false_claims_count integer default 0,
  misleading_claims_count integer default 0,
  corrections_issued integer default 0,
  prediction_accuracy float,
  fact_check_urls jsonb default '[]',
  base_trust_score integer check (base_trust_score between 0 and 100),
  conflict_of_interest_flags jsonb default '[]',
  student_summary text,
  teacher_notes text,
  auto_populated boolean default false,
  verified boolean default false,
  flagged_for_review boolean default false,
  data_sources jsonb default '[]',
  last_updated timestamptz default now(),
  created_at timestamptz default now()
);

create table public.publications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text unique not null,
  owner_entity_id uuid references public.entities(id),
  political_leaning text,
  base_trust_score integer check (base_trust_score between 0 and 100),
  ipso_member boolean default false,
  impress_member boolean default false,
  ipso_complaints_upheld_12m integer default 0,
  editorial_independence_score integer check (editorial_independence_score between 0 and 100),
  circulation_type text check (circulation_type in ('broadsheet','tabloid','online','broadcast','social')),
  student_summary text,
  teacher_notes text,
  verified boolean default false,
  created_at timestamptz default now()
);

create table public.entity_claims (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid references public.entities(id) on delete cascade,
  claim text not null,
  claim_type text check (claim_type in ('factual','prediction','opinion','statistic','denial')),
  made_at date,
  source_url text,
  context text,
  verification_status text check (verification_status in (
    'verified_true','verified_false','misleading',
    'unverifiable','pending','contested'
  )) default 'pending',
  verification_source text,
  verification_date date,
  cronkite_notes text,
  created_at timestamptz default now()
);

create table public.article_entities (
  id uuid primary key default gen_random_uuid(),
  article_id uuid references public.articles(id) on delete cascade,
  entity_id uuid references public.entities(id) on delete cascade,
  role text check (role in ('author','subject','quoted_source','mentioned')),
  entity_trust_score_at_time integer,
  created_at timestamptz default now()
);

create table public.entity_trust_events (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid references public.entities(id) on delete cascade,
  event_type text check (event_type in (
    'ipso_complaint_upheld','correction_issued','false_claim_verified',
    'accurate_prediction','conflict_of_interest_revealed',
    'manual_adjustment','financial_interest_declared','political_donation'
  )),
  description text,
  score_impact integer,
  source_url text,
  occurred_at date,
  created_at timestamptz default now()
);

-- RLS
alter table public.entities enable row level security;
alter table public.publications enable row level security;
alter table public.entity_claims enable row level security;
alter table public.article_entities enable row level security;
alter table public.entity_trust_events enable row level security;

create policy "entities: authenticated read" on public.entities for select using (auth.role() = 'authenticated');
create policy "publications: authenticated read" on public.publications for select using (auth.role() = 'authenticated');
create policy "claims: authenticated read" on public.entity_claims for select using (auth.role() = 'authenticated');
create policy "article_entities: authenticated read" on public.article_entities for select using (auth.role() = 'authenticated');
create policy "trust_events: authenticated read" on public.entity_trust_events for select using (auth.role() = 'authenticated');

═══════════════════════════════════════════════════════════════════════════════
END SQL MIGRATION
═══════════════════════════════════════════════════════════════════════════════
"""

import os
import sys
import json
from supabase import create_client


def get_supa():
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not url or not key:
        print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables")
        sys.exit(1)
    return create_client(url, key)


# ── ENTITIES ────────────────────────────────────────────────────────────────

ENTITIES = [
    # ── Politicians (15) ────────────────────────────────────────────────────
    {
        "name": "Keir Starmer",
        "slug": "keir-starmer",
        "entity_type": "politician",
        "entity_role": "Prime Minister",
        "current_organisation": "UK Government",
        "party_affiliation": "Labour",
        "political_leaning": "centre-left",
        "base_trust_score": 62,
        "student_summary": "UK Prime Minister since 2024. Former lawyer and Director of Public Prosecutions. Some policies have changed since election promises.",
        "conflict_of_interest_flags": ["Reversed multiple manifesto commitments post-election"],
    },
    {
        "name": "Rachel Reeves",
        "slug": "rachel-reeves",
        "entity_type": "politician",
        "entity_role": "Chancellor of the Exchequer",
        "current_organisation": "UK Government",
        "party_affiliation": "Labour",
        "political_leaning": "centre-left",
        "base_trust_score": 65,
        "conflict_of_interest_flags": ["CV discrepancy regarding Bank of England role"],
    },
    {
        "name": "Wes Streeting",
        "slug": "wes-streeting",
        "entity_type": "politician",
        "entity_role": "Health Secretary",
        "current_organisation": "UK Government",
        "party_affiliation": "Labour",
        "political_leaning": "centre",
        "base_trust_score": 64,
        "conflict_of_interest_flags": ["Accepted donations from private healthcare interests"],
    },
    {
        "name": "Yvette Cooper",
        "slug": "yvette-cooper",
        "entity_type": "politician",
        "entity_role": "Home Secretary",
        "current_organisation": "UK Government",
        "party_affiliation": "Labour",
        "political_leaning": "centre-left",
        "base_trust_score": 67,
        "conflict_of_interest_flags": [],
    },
    {
        "name": "Kemi Badenoch",
        "slug": "kemi-badenoch",
        "entity_type": "politician",
        "entity_role": "Leader of the Opposition",
        "current_organisation": "Conservative Party",
        "party_affiliation": "Conservative",
        "political_leaning": "centre-right",
        "base_trust_score": 61,
        "conflict_of_interest_flags": [],
    },
    {
        "name": "Nigel Farage",
        "slug": "nigel-farage",
        "entity_type": "politician",
        "entity_role": "Leader of Reform UK",
        "current_organisation": "Reform UK",
        "party_affiliation": "Reform UK",
        "political_leaning": "right",
        "base_trust_score": 38,
        "student_summary": "Leader of Reform UK party. Presents GB News show. Has made several claims about immigration and the EU that have been rated misleading by fact-checkers.",
        "conflict_of_interest_flags": [
            "Paid GB News presenter — financial interest in political coverage",
            "Multiple immigration statistics rated misleading by Full Fact",
        ],
    },
    {
        "name": "Richard Tice",
        "slug": "richard-tice",
        "entity_type": "politician",
        "entity_role": "Deputy Leader of Reform UK",
        "current_organisation": "Reform UK",
        "party_affiliation": "Reform UK",
        "political_leaning": "right",
        "base_trust_score": 40,
        "conflict_of_interest_flags": ["Property developer interests", "Misleading economic claims"],
    },
    {
        "name": "Ed Davey",
        "slug": "ed-davey",
        "entity_type": "politician",
        "entity_role": "Leader of the Liberal Democrats",
        "current_organisation": "Liberal Democrats",
        "party_affiliation": "Liberal Democrats",
        "political_leaning": "centre",
        "base_trust_score": 66,
        "conflict_of_interest_flags": [],
    },
    {
        "name": "Stephen Flynn",
        "slug": "stephen-flynn",
        "entity_type": "politician",
        "entity_role": "SNP Westminster Leader",
        "current_organisation": "SNP",
        "party_affiliation": "SNP",
        "political_leaning": "centre-left",
        "base_trust_score": 64,
        "conflict_of_interest_flags": [],
    },
    {
        "name": "Boris Johnson",
        "slug": "boris-johnson",
        "entity_type": "politician",
        "entity_role": "Former Prime Minister",
        "current_organisation": "Conservative Party",
        "party_affiliation": "Conservative",
        "political_leaning": "centre-right",
        "base_trust_score": 29,
        "student_summary": "Former UK Prime Minister 2019-2022. Left office following Partygate scandal. Multiple claims made in office were ruled false by independent checkers.",
        "conflict_of_interest_flags": [
            "Prorogation of Parliament ruled unlawful",
            "Partygate — broke own lockdown rules",
            "Multiple false claims verified by Full Fact",
        ],
    },
    {
        "name": "Liz Truss",
        "slug": "liz-truss",
        "entity_type": "politician",
        "entity_role": "Former Prime Minister",
        "current_organisation": "Conservative Party",
        "party_affiliation": "Conservative",
        "political_leaning": "right",
        "base_trust_score": 25,
        "student_summary": "UK Prime Minister for 45 days in 2022. Her economic policies caused significant market instability. Continues to promote similar policies.",
        "conflict_of_interest_flags": [
            "Mini-budget caused pound to collapse and mortgage rates to spike",
            "Continues to promote discredited economic policies",
        ],
    },
    {
        "name": "Rishi Sunak",
        "slug": "rishi-sunak",
        "entity_type": "politician",
        "entity_role": "Former Prime Minister",
        "current_organisation": "Conservative Party",
        "party_affiliation": "Conservative",
        "political_leaning": "centre-right",
        "base_trust_score": 55,
        "conflict_of_interest_flags": [],
    },
    {
        "name": "Jacob Rees-Mogg",
        "slug": "jacob-rees-mogg",
        "entity_type": "politician",
        "entity_role": "Former Minister",
        "current_organisation": "Conservative Party",
        "party_affiliation": "Conservative",
        "political_leaning": "right",
        "base_trust_score": 42,
        "conflict_of_interest_flags": [
            "Somerset Capital Management investments",
            "Misleading Brexit economic claims",
        ],
    },
    {
        "name": "Peter Mandelson",
        "slug": "peter-mandelson",
        "entity_type": "politician",
        "entity_role": "UK Ambassador to the United States",
        "current_organisation": "UK Government",
        "party_affiliation": "Labour",
        "political_leaning": "centre-left",
        "base_trust_score": 58,
        "conflict_of_interest_flags": [
            "Two prior ministerial resignations",
            "Lobbying connections",
        ],
    },
    {
        "name": "Sadiq Khan",
        "slug": "sadiq-khan",
        "entity_type": "politician",
        "entity_role": "Mayor of London",
        "current_organisation": "Greater London Authority",
        "party_affiliation": "Labour",
        "political_leaning": "centre-left",
        "base_trust_score": 61,
        "conflict_of_interest_flags": [],
    },

    # ── Tech CEOs (8) ───────────────────────────────────────────────────────
    {
        "name": "Elon Musk",
        "slug": "elon-musk",
        "entity_type": "tech_ceo",
        "entity_role": "CEO of Tesla, SpaceX, and X",
        "current_organisation": "Tesla / SpaceX / X",
        "political_leaning": "libertarian",
        "base_trust_score": 31,
        "student_summary": "Owns X (formerly Twitter), Tesla, and SpaceX. Has used his platforms to spread content that fact-checkers have rated false. Donated heavily to Trump campaign.",
        "conflict_of_interest_flags": [
            "Systematic promotion of misinformation on X",
            "Market manipulation via tweets (SEC investigation)",
            "Political donations to Trump campaign",
            "Purchased Twitter to influence political speech",
        ],
    },
    {
        "name": "Mark Zuckerberg",
        "slug": "mark-zuckerberg",
        "entity_type": "tech_ceo",
        "entity_role": "CEO of Meta",
        "current_organisation": "Meta",
        "political_leaning": "centre-right",
        "base_trust_score": 44,
        "conflict_of_interest_flags": [
            "Congressional testimony evasions on data privacy",
            "Cambridge Analytica data scandal",
            "Reduced fact-checking on Facebook 2025",
        ],
    },
    {
        "name": "Sundar Pichai",
        "slug": "sundar-pichai",
        "entity_type": "tech_ceo",
        "entity_role": "CEO of Google and Alphabet",
        "current_organisation": "Alphabet",
        "political_leaning": "centre",
        "base_trust_score": 61,
        "conflict_of_interest_flags": [],
    },
    {
        "name": "Sam Altman",
        "slug": "sam-altman",
        "entity_type": "tech_ceo",
        "entity_role": "CEO of OpenAI",
        "current_organisation": "OpenAI",
        "political_leaning": "centre",
        "base_trust_score": 58,
        "conflict_of_interest_flags": [
            "Board removal and reinstatement raises governance questions",
        ],
    },
    {
        "name": "Jeff Bezos",
        "slug": "jeff-bezos",
        "entity_type": "tech_ceo",
        "entity_role": "Executive Chairman of Amazon, Owner of Washington Post",
        "current_organisation": "Amazon / Washington Post",
        "political_leaning": "centre-right",
        "base_trust_score": 52,
        "conflict_of_interest_flags": [
            "Washington Post editorial interference concerns",
            "Amazon tax avoidance",
        ],
    },
    {
        "name": "Peter Thiel",
        "slug": "peter-thiel",
        "entity_type": "tech_ceo",
        "entity_role": "Co-founder of Palantir and PayPal",
        "current_organisation": "Palantir / Founders Fund",
        "political_leaning": "right",
        "base_trust_score": 38,
        "conflict_of_interest_flags": [
            "Palantir government surveillance contracts",
            "Political donations to far-right candidates",
        ],
    },
    {
        "name": "Tim Cook",
        "slug": "tim-cook",
        "entity_type": "tech_ceo",
        "entity_role": "CEO of Apple",
        "current_organisation": "Apple",
        "political_leaning": "centre",
        "base_trust_score": 68,
        "conflict_of_interest_flags": [],
    },
    {
        "name": "Bill Gates",
        "slug": "bill-gates",
        "entity_type": "tech_ceo",
        "entity_role": "Co-chair of the Gates Foundation",
        "current_organisation": "Gates Foundation",
        "political_leaning": "centre-left",
        "base_trust_score": 71,
        "conflict_of_interest_flags": [],
    },

    # ── Journalists (10) ────────────────────────────────────────────────────
    {
        "name": "Paul Dacre",
        "slug": "paul-dacre",
        "entity_type": "journalist",
        "entity_role": "Former Editor-in-Chief",
        "current_organisation": "Daily Mail",
        "political_leaning": "right",
        "base_trust_score": 35,
        "conflict_of_interest_flags": [
            "Multiple IPSO complaints upheld",
            "Attacks on judiciary described as constitutional overreach",
        ],
    },
    {
        "name": "Piers Morgan",
        "slug": "piers-morgan",
        "entity_type": "journalist",
        "entity_role": "Presenter and Columnist",
        "current_organisation": "Various",
        "political_leaning": "centre",
        "base_trust_score": 45,
        "conflict_of_interest_flags": [
            "Involvement in phone hacking scandal at Mirror",
        ],
    },
    {
        "name": "Laura Kuenssberg",
        "slug": "laura-kuenssberg",
        "entity_type": "journalist",
        "entity_role": "Political Editor and Presenter",
        "current_organisation": "BBC",
        "political_leaning": "centre",
        "base_trust_score": 72,
        "conflict_of_interest_flags": [],
    },
    {
        "name": "Robert Peston",
        "slug": "robert-peston",
        "entity_type": "journalist",
        "entity_role": "Political Editor",
        "current_organisation": "ITV",
        "political_leaning": "centre",
        "base_trust_score": 70,
        "conflict_of_interest_flags": [],
    },
    {
        "name": "Andrew Neil",
        "slug": "andrew-neil",
        "entity_type": "journalist",
        "entity_role": "Chairman and Presenter",
        "current_organisation": "Various",
        "political_leaning": "centre-right",
        "base_trust_score": 61,
        "conflict_of_interest_flags": [],
    },
    {
        "name": "Owen Jones",
        "slug": "owen-jones",
        "entity_type": "journalist",
        "entity_role": "Columnist",
        "current_organisation": "Guardian",
        "political_leaning": "left",
        "base_trust_score": 55,
        "student_summary": "Guardian columnist. Openly left-wing and activist. Acknowledges his own political bias in writing.",
        "conflict_of_interest_flags": [
            "Acknowledged activist-journalist — not neutral",
        ],
    },
    {
        "name": "Rod Liddle",
        "slug": "rod-liddle",
        "entity_type": "journalist",
        "entity_role": "Associate Editor",
        "current_organisation": "Spectator",
        "political_leaning": "right",
        "base_trust_score": 41,
        "conflict_of_interest_flags": [
            "Multiple IPSO complaints upheld",
        ],
    },
    {
        "name": "Polly Toynbee",
        "slug": "polly-toynbee",
        "entity_type": "journalist",
        "entity_role": "Columnist",
        "current_organisation": "Guardian",
        "political_leaning": "left",
        "base_trust_score": 64,
        "student_summary": "Senior Guardian columnist. Openly progressive. Acknowledges her political perspective influences her writing.",
        "conflict_of_interest_flags": [],
    },
    {
        "name": "Dominic Cummings",
        "slug": "dominic-cummings",
        "entity_type": "commentator",
        "entity_role": "Former adviser and blogger",
        "current_organisation": "Various",
        "political_leaning": "right",
        "base_trust_score": 33,
        "conflict_of_interest_flags": [
            "Durham lockdown breach",
            "Unverified claims about government decision-making",
            "No corrections culture on blog",
        ],
    },
    {
        "name": "Emily Maitlis",
        "slug": "emily-maitlis",
        "entity_type": "journalist",
        "entity_role": "Presenter and Podcaster",
        "current_organisation": "Global / The News Agents",
        "political_leaning": "centre-left",
        "base_trust_score": 68,
        "conflict_of_interest_flags": [
            "Declared political leanings after leaving BBC",
        ],
    },

    # ── Influencers / Commentators (7) ──────────────────────────────────────
    {
        "name": "Darren Grimes",
        "slug": "darren-grimes",
        "entity_type": "influencer",
        "entity_role": "Presenter and Commentator",
        "current_organisation": "GB News / Substack",
        "political_leaning": "right",
        "base_trust_score": 36,
        "conflict_of_interest_flags": [
            "Electoral Commission fine for campaign finance breach",
            "Misleading immigration statistics",
        ],
    },
    {
        "name": "James O'Brien",
        "slug": "james-obrien",
        "entity_type": "commentator",
        "entity_role": "Presenter",
        "current_organisation": "LBC",
        "political_leaning": "centre-left",
        "base_trust_score": 62,
        "conflict_of_interest_flags": [],
    },
    {
        "name": "Calvin Robinson",
        "slug": "calvin-robinson",
        "entity_type": "commentator",
        "entity_role": "Presenter",
        "current_organisation": "GB News",
        "political_leaning": "right",
        "base_trust_score": 38,
        "conflict_of_interest_flags": [],
    },
    {
        "name": "Ash Sarkar",
        "slug": "ash-sarkar",
        "entity_type": "influencer",
        "entity_role": "Journalist and Commentator",
        "current_organisation": "Novara Media",
        "political_leaning": "far-left",
        "base_trust_score": 55,
        "student_summary": "Novara Media journalist. Openly communist. Her political position is transparent and consistent.",
        "conflict_of_interest_flags": [
            "Acknowledged activist position — not neutral reporting",
        ],
    },
    {
        "name": "Maajid Nawaz",
        "slug": "maajid-nawaz",
        "entity_type": "commentator",
        "entity_role": "Presenter and Podcaster",
        "current_organisation": "Independent / Podcast",
        "political_leaning": "right",
        "base_trust_score": 34,
        "conflict_of_interest_flags": [
            "Promoted multiple conspiracy theories post-2020",
            "Dropped by LBC for spreading misinformation",
        ],
    },
    {
        "name": "Iain Dale",
        "slug": "iain-dale",
        "entity_type": "commentator",
        "entity_role": "Presenter",
        "current_organisation": "LBC",
        "political_leaning": "centre-right",
        "base_trust_score": 64,
        "conflict_of_interest_flags": [],
    },
    {
        "name": "Naga Munchetty",
        "slug": "naga-munchetty",
        "entity_type": "journalist",
        "entity_role": "Presenter",
        "current_organisation": "BBC Breakfast",
        "political_leaning": "centre",
        "base_trust_score": 71,
        "conflict_of_interest_flags": [],
    },
]


# ── PUBLICATIONS (20) ───────────────────────────────────────────────────────

PUBLICATIONS = [
    {
        "name": "BBC News",
        "domain": "bbc.co.uk",
        "political_leaning": "centre",
        "base_trust_score": 82,
        "ipso_member": False,
        "impress_member": False,
        "editorial_independence_score": 85,
        "circulation_type": "broadcast",
        "student_summary": "UK's public service broadcaster, funded by the licence fee. Required by charter to be impartial. Most trusted news brand in the UK.",
        "verified": True,
    },
    {
        "name": "The Guardian",
        "domain": "theguardian.com",
        "political_leaning": "centre-left",
        "base_trust_score": 74,
        "ipso_member": False,
        "impress_member": False,
        "editorial_independence_score": 80,
        "circulation_type": "broadsheet",
        "student_summary": "Centre-left broadsheet owned by the Scott Trust, a not-for-profit. Known for investigative journalism and progressive editorial stance.",
        "verified": True,
    },
    {
        "name": "Daily Mail",
        "domain": "dailymail.co.uk",
        "political_leaning": "right",
        "base_trust_score": 38,
        "ipso_member": True,
        "impress_member": False,
        "ipso_complaints_upheld_12m": 8,
        "editorial_independence_score": 45,
        "circulation_type": "tabloid",
        "student_summary": "Right-leaning tabloid. UK's highest-circulation newspaper. Has had multiple IPSO complaints upheld. Known for sensationalist headlines.",
        "verified": True,
    },
    {
        "name": "The Telegraph",
        "domain": "telegraph.co.uk",
        "political_leaning": "centre-right",
        "base_trust_score": 62,
        "ipso_member": True,
        "impress_member": False,
        "ipso_complaints_upheld_12m": 2,
        "editorial_independence_score": 60,
        "circulation_type": "broadsheet",
        "student_summary": "Centre-right broadsheet. Known as 'The Torygraph' for its Conservative-leaning editorial position. Strong business and political coverage.",
        "verified": True,
    },
    {
        "name": "The Times",
        "domain": "thetimes.com",
        "political_leaning": "centre-right",
        "base_trust_score": 72,
        "ipso_member": True,
        "impress_member": False,
        "ipso_complaints_upheld_12m": 1,
        "editorial_independence_score": 70,
        "circulation_type": "broadsheet",
        "student_summary": "Centre-right broadsheet owned by News UK (Rupert Murdoch). One of the UK's oldest newspapers with strong reputation for reporting quality.",
        "verified": True,
    },
    {
        "name": "The Sun",
        "domain": "thesun.co.uk",
        "political_leaning": "right",
        "base_trust_score": 32,
        "ipso_member": True,
        "impress_member": False,
        "ipso_complaints_upheld_12m": 6,
        "editorial_independence_score": 35,
        "circulation_type": "tabloid",
        "student_summary": "Right-leaning tabloid owned by News UK (Rupert Murdoch). Known for sensationalist headlines and political influence. Multiple accuracy complaints.",
        "verified": True,
    },
    {
        "name": "Daily Mirror",
        "domain": "mirror.co.uk",
        "political_leaning": "centre-left",
        "base_trust_score": 40,
        "ipso_member": True,
        "impress_member": False,
        "ipso_complaints_upheld_12m": 4,
        "editorial_independence_score": 45,
        "circulation_type": "tabloid",
        "student_summary": "Centre-left tabloid. Traditionally Labour-supporting. Has had phone hacking and accuracy issues in the past.",
        "verified": True,
    },
    {
        "name": "The Independent",
        "domain": "independent.co.uk",
        "political_leaning": "centre-left",
        "base_trust_score": 66,
        "ipso_member": False,
        "impress_member": False,
        "editorial_independence_score": 62,
        "circulation_type": "online",
        "student_summary": "Centre-left online-only newspaper. Originally a broadsheet, now digital-only. Owned by a Saudi-connected investor.",
        "verified": True,
    },
    {
        "name": "Sky News",
        "domain": "news.sky.com",
        "political_leaning": "centre",
        "base_trust_score": 74,
        "ipso_member": False,
        "impress_member": False,
        "editorial_independence_score": 75,
        "circulation_type": "broadcast",
        "student_summary": "UK broadcast news channel. Regulated by Ofcom for impartiality. Generally considered reliable for breaking news.",
        "verified": True,
    },
    {
        "name": "Channel 4 News",
        "domain": "channel4.com",
        "political_leaning": "centre-left",
        "base_trust_score": 78,
        "ipso_member": False,
        "impress_member": False,
        "editorial_independence_score": 82,
        "circulation_type": "broadcast",
        "student_summary": "Publicly-owned broadcast channel with Ofcom impartiality requirements. Known for in-depth investigative journalism.",
        "verified": True,
    },
    {
        "name": "ITV News",
        "domain": "itv.com",
        "political_leaning": "centre",
        "base_trust_score": 72,
        "ipso_member": False,
        "impress_member": False,
        "editorial_independence_score": 72,
        "circulation_type": "broadcast",
        "student_summary": "UK's largest commercial broadcaster. Regulated by Ofcom for impartiality. Mainstream news coverage.",
        "verified": True,
    },
    {
        "name": "GB News",
        "domain": "gbnews.com",
        "political_leaning": "right",
        "base_trust_score": 35,
        "ipso_member": False,
        "impress_member": False,
        "editorial_independence_score": 30,
        "circulation_type": "broadcast",
        "student_summary": "Right-leaning opinion-led TV channel launched 2021. Multiple Ofcom complaints. Employs sitting politicians as presenters, raising impartiality concerns.",
        "verified": True,
    },
    {
        "name": "The Spectator",
        "domain": "spectator.co.uk",
        "political_leaning": "centre-right",
        "base_trust_score": 60,
        "ipso_member": True,
        "impress_member": False,
        "ipso_complaints_upheld_12m": 2,
        "editorial_independence_score": 58,
        "circulation_type": "broadsheet",
        "student_summary": "Centre-right political magazine. Oldest continuously published magazine in the English language. Known for commentary and opinion rather than news reporting.",
        "verified": True,
    },
    {
        "name": "New Statesman",
        "domain": "newstatesman.com",
        "political_leaning": "centre-left",
        "base_trust_score": 68,
        "ipso_member": False,
        "impress_member": False,
        "editorial_independence_score": 72,
        "circulation_type": "broadsheet",
        "student_summary": "Centre-left political magazine. Known for long-form political analysis and cultural commentary.",
        "verified": True,
    },
    {
        "name": "Financial Times",
        "domain": "ft.com",
        "political_leaning": "centre",
        "base_trust_score": 84,
        "ipso_member": False,
        "impress_member": False,
        "editorial_independence_score": 88,
        "circulation_type": "broadsheet",
        "student_summary": "Internationally respected financial newspaper. Owned by Nikkei (Japan). Known for accurate reporting and high editorial standards.",
        "verified": True,
    },
    {
        "name": "Daily Express",
        "domain": "express.co.uk",
        "political_leaning": "right",
        "base_trust_score": 34,
        "ipso_member": True,
        "impress_member": False,
        "ipso_complaints_upheld_12m": 5,
        "editorial_independence_score": 38,
        "circulation_type": "tabloid",
        "student_summary": "Right-leaning tabloid owned by Reach plc. Known for sensationalist immigration and health headlines. Multiple accuracy issues.",
        "verified": True,
    },
    {
        "name": "Evening Standard",
        "domain": "standard.co.uk",
        "political_leaning": "centre-right",
        "base_trust_score": 55,
        "ipso_member": True,
        "impress_member": False,
        "ipso_complaints_upheld_12m": 1,
        "editorial_independence_score": 50,
        "circulation_type": "tabloid",
        "student_summary": "London-focused newspaper. Previously owned by a Russian oligarch. Now under new ownership. Focus on London news and politics.",
        "verified": True,
    },
    {
        "name": "Novara Media",
        "domain": "novaramedia.com",
        "political_leaning": "far-left",
        "base_trust_score": 48,
        "ipso_member": False,
        "impress_member": False,
        "editorial_independence_score": 55,
        "circulation_type": "online",
        "student_summary": "Left-wing independent media outlet. Openly activist and anti-capitalist. Transparent about its political position.",
        "verified": True,
    },
    {
        "name": "LBC",
        "domain": "lbc.co.uk",
        "political_leaning": "centre",
        "base_trust_score": 62,
        "ipso_member": False,
        "impress_member": False,
        "editorial_independence_score": 60,
        "circulation_type": "broadcast",
        "student_summary": "Talk radio station owned by Global. Features presenters across the political spectrum. Opinion-led rather than news-led.",
        "verified": True,
    },
    {
        "name": "The Economist",
        "domain": "economist.com",
        "political_leaning": "centre",
        "base_trust_score": 82,
        "ipso_member": False,
        "impress_member": False,
        "editorial_independence_score": 85,
        "circulation_type": "broadsheet",
        "student_summary": "Internationally respected weekly publication. Classically liberal editorial stance. Known for data-driven analysis and high editorial standards.",
        "verified": True,
    },
]


def seed():
    supa = get_supa()

    # ── Seed entities ───────────────────────────────────────────────────────
    print(f"Seeding {len(ENTITIES)} entities...")
    for e in ENTITIES:
        row = {
            "name": e["name"],
            "slug": e["slug"],
            "entity_type": e["entity_type"],
            "entity_role": e.get("entity_role"),
            "current_organisation": e.get("current_organisation"),
            "party_affiliation": e.get("party_affiliation"),
            "political_leaning": e.get("political_leaning"),
            "base_trust_score": e.get("base_trust_score"),
            "student_summary": e.get("student_summary"),
            "conflict_of_interest_flags": json.dumps(e.get("conflict_of_interest_flags", [])),
            "auto_populated": False,
            "verified": True,
            "flagged_for_review": False,
        }
        try:
            supa.table("entities").upsert(row, on_conflict="slug").execute()
            print(f"  ✓ {e['name']}")
        except Exception as err:
            print(f"  ✗ {e['name']}: {err}")

    # ── Seed publications ───────────────────────────────────────────────────
    print(f"\nSeeding {len(PUBLICATIONS)} publications...")
    for p in PUBLICATIONS:
        row = {
            "name": p["name"],
            "domain": p["domain"],
            "political_leaning": p.get("political_leaning"),
            "base_trust_score": p.get("base_trust_score"),
            "ipso_member": p.get("ipso_member", False),
            "impress_member": p.get("impress_member", False),
            "ipso_complaints_upheld_12m": p.get("ipso_complaints_upheld_12m", 0),
            "editorial_independence_score": p.get("editorial_independence_score"),
            "circulation_type": p.get("circulation_type"),
            "student_summary": p.get("student_summary"),
            "verified": p.get("verified", True),
        }
        try:
            supa.table("publications").upsert(row, on_conflict="domain").execute()
            print(f"  ✓ {p['name']}")
        except Exception as err:
            print(f"  ✗ {p['name']}: {err}")

    print("\nDone! Seeded entities and publications.")


if __name__ == "__main__":
    seed()
