-- Change set 3.0.6: briefing generation as a background job with a poll endpoint.
-- One row per triggered briefing generation run. The trigger endpoint enforces
-- at most one job in 'queued' or 'running' at a time.

create table if not exists public.briefing_jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('queued', 'running', 'complete', 'failed')),
  triggered_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  triggered_by text not null,  -- 'manual', 'scheduler', or 'api'
  send_after_complete boolean not null default false,
  dry_run boolean not null default false,
  progress_stage text,  -- 'events', 'scraping', 'synthesis', 'bias', 'sending', 'done'
  progress_detail text,  -- Human-readable status string
  student_briefing_id uuid references public.daily_briefings(id),
  teacher_briefing_id uuid references public.daily_briefings(id),
  error_message text,
  error_stage text,
  created_at timestamptz not null default now()
);

create index if not exists briefing_jobs_status_idx on public.briefing_jobs (status);
create index if not exists briefing_jobs_triggered_at_idx on public.briefing_jobs (triggered_at desc);
