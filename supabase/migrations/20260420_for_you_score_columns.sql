-- Add scoring + access status columns to for_you_articles if they don't exist
alter table public.for_you_articles
  add column if not exists credibility_score integer,
  add column if not exists bias_label text default 'centre',
  add column if not exists access_status text default 'free';

create index if not exists idx_for_you_user_module
  on public.for_you_articles(user_id, module_id);
