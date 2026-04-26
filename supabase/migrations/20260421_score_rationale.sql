alter table public.article_scores_cache
  add column if not exists rationale jsonb default '{}'::jsonb,
  add column if not exists analysis_failed boolean default false;
