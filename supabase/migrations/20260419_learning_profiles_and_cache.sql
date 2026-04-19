-- Student learning profiles — one row per student, updated as chat observations accumulate
create table if not exists public.student_learning_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ability_level text default 'unknown',
  strengths jsonb default '[]'::jsonb,
  struggles jsonb default '[]'::jsonb,
  last_techniques_covered jsonb default '[]'::jsonb,
  observations_count integer default 0,
  preferred_depth text default 'medium',
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $
begin
  new.updated_at = now();
  return new;
end;
$;

drop trigger if exists trg_profiles_touch on public.student_learning_profiles;
create trigger trg_profiles_touch before update on public.student_learning_profiles
for each row execute function public.touch_updated_at();

-- Raw observation log — append-only, one row per observation
create table if not exists public.learning_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  technique text,
  ability_signal text,
  note text default '',
  article_url text default '',
  created_at timestamptz default now()
);

create index if not exists idx_obs_user on public.learning_observations(user_id);
create index if not exists idx_obs_user_created on public.learning_observations(user_id, created_at desc);

-- Article scores cache — one row per URL, scored on first student visit
create table if not exists public.article_scores_cache (
  url text primary key,
  title text default '',
  source text default '',
  summary text default '',
  credibility_score integer default 50,
  credibility_components jsonb default '{}'::jsonb,
  source_trust integer,
  author_trust integer,
  conflict_of_interest_flags jsonb default '[]'::jsonb,
  bias_score integer default 0,
  bias_label text default 'centre',
  bias_components jsonb default '{}'::jsonb,
  formula_version text default '1.0',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists trg_scores_touch on public.article_scores_cache;
create trigger trg_scores_touch before update on public.article_scores_cache
for each row execute function public.touch_updated_at();

-- RLS: students read their own profile and observations; service role writes all
alter table public.student_learning_profiles enable row level security;
alter table public.learning_observations enable row level security;
alter table public.article_scores_cache enable row level security;

drop policy if exists "own profile read" on public.student_learning_profiles;
create policy "own profile read" on public.student_learning_profiles
for select using (auth.uid() = user_id);

drop policy if exists "own observations read" on public.learning_observations;
create policy "own observations read" on public.learning_observations
for select using (auth.uid() = user_id);

drop policy if exists "all read scores" on public.article_scores_cache;
create policy "all read scores" on public.article_scores_cache
for select using (true);
