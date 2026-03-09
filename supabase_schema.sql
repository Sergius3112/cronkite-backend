-- ============================================================
-- Cronkite Education – Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- Safe to re-run: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- ============================================================


-- ============================================================
-- 1. Users profile table
--    Mirrors auth.users; auto-populated on signup via trigger below.
-- ============================================================
create table if not exists public.users (
  id         uuid        references auth.users(id) on delete cascade primary key,
  email      text        not null,
  name       text,
  role       text        not null default 'student'
               check (role in ('teacher', 'student', 'admin')),
  school     text,
  created_at timestamptz not null default now()
);

-- Trigger: auto-create a profile row whenever someone signs up (incl. Google OAuth)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================
-- 2. Modules (created by teachers)
-- ============================================================
create table if not exists public.modules (
  id          uuid        default gen_random_uuid() primary key,
  teacher_id  uuid        references public.users(id) on delete cascade not null,
  title       text        not null,
  description text        not null default '',
  focus_point text        not null default '',
  created_at  timestamptz not null default now()
);

-- New columns (added in v2 — safe to re-run)
alter table public.modules
  add column if not exists key_stage  text,   -- e.g. KS3, KS4, KS5
  add column if not exists class_name text;   -- e.g. "9B English"


-- ============================================================
-- 3. Assignments (articles attached to a module)
-- ============================================================
create table if not exists public.assignments (
  id            uuid        default gen_random_uuid() primary key,
  module_id     uuid        references public.modules(id) on delete cascade not null,
  article_url   text        not null,
  article_title text        not null default '',
  created_at    timestamptz not null default now()
);

-- New columns (added in v2 — safe to re-run)
alter table public.assignments
  add column if not exists due_date         timestamptz,            -- optional deadline
  add column if not exists instructions     text,                   -- teacher guidance for this task
  add column if not exists student_response text,                   -- student's written reflection
  add column if not exists teacher_feedback text,                   -- teacher's written feedback
  add column if not exists score            integer                 -- teacher-assigned score (0-100)
                              check (score is null or (score >= 0 and score <= 100));


-- ============================================================
-- 4. Student results
-- ============================================================
create table if not exists public.student_results (
  id            uuid        default gen_random_uuid() primary key,
  student_id    uuid        references public.users(id) on delete cascade not null,
  assignment_id uuid        references public.assignments(id) on delete cascade not null,
  analysis_json jsonb,
  completed_at  timestamptz not null default now(),
  unique (student_id, assignment_id)   -- one submission per student per assignment
);


-- ============================================================
-- 5. Student profiles
--    Extended per-student data: bias exposure tracking + parent contacts.
--    One row per student (1-to-1 with users).
-- ============================================================
create table if not exists public.student_profiles (
  id             uuid        default gen_random_uuid() primary key,
  student_id     uuid        references public.users(id) on delete cascade not null unique,

  -- Accumulated bias exposure counters, keyed by bias type.
  -- Example: {"left_leaning": 3, "right_leaning": 1, "misinformation": 5, "loaded_language": 2}
  bias_exposure  jsonb       not null default '{}',

  -- Parent / guardian email addresses for report delivery
  parent_emails  text[]      not null default '{}',

  -- Optional teacher notes about the student
  notes          text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);


-- ============================================================
-- 6. Daily reports
--    Summaries generated per teacher (optionally per module) each day.
--    Sent to the teacher and optionally to parents.
-- ============================================================
create table if not exists public.daily_reports (
  id           uuid        default gen_random_uuid() primary key,
  teacher_id   uuid        references public.users(id) on delete cascade not null,
  module_id    uuid        references public.modules(id) on delete set null,
  report_date  date        not null default current_date,

  -- Human-readable summary paragraph
  summary      text,

  -- Full structured report payload (class stats, flag counts, individual scores, etc.)
  report_json  jsonb       not null default '{}',

  -- Timestamp when the report email was dispatched (null = not yet sent)
  sent_at      timestamptz,

  created_at   timestamptz not null default now(),

  unique (teacher_id, report_date, module_id)
);


-- ============================================================
-- 7. Challenger sessions
--    Records when a student challenges an AI verdict on a claim.
-- ============================================================
create table if not exists public.challenger_sessions (
  id               uuid        default gen_random_uuid() primary key,
  student_id       uuid        references public.users(id) on delete cascade not null,
  assignment_id    uuid        references public.assignments(id) on delete cascade,

  -- The specific claim being challenged
  claim_text       text        not null,

  -- What the AI originally said
  ai_verdict       text,
  ai_score         integer,

  -- The student's counter-argument
  student_argument text,

  -- Resolution of the challenge
  outcome          text        check (outcome in ('upheld', 'overturned', 'partial', 'pending'))
                               default 'pending',

  -- Full session payload (chat turns, evidence submitted, timestamps, etc.)
  session_json     jsonb       not null default '{}',

  created_at       timestamptz not null default now(),
  completed_at     timestamptz
);


-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.users              enable row level security;
alter table public.modules            enable row level security;
alter table public.assignments        enable row level security;
alter table public.student_results    enable row level security;
alter table public.student_profiles   enable row level security;
alter table public.daily_reports      enable row level security;
alter table public.challenger_sessions enable row level security;


-- ── users ─────────────────────────────────────────────────────────────────────
-- Users can read and update their own profile
create policy "users: read own"   on public.users
  for select using (auth.uid() = id);

create policy "users: update own" on public.users
  for update using (auth.uid() = id);

-- Teachers can read profiles of students who have results in their modules
create policy "users: teacher reads students" on public.users
  for select using (
    exists (
      select 1
      from   public.student_results sr
      join   public.assignments     a  on a.id  = sr.assignment_id
      join   public.modules         m  on m.id  = a.module_id
      where  sr.student_id = users.id
        and  m.teacher_id  = auth.uid()
    )
  );


-- ── modules ───────────────────────────────────────────────────────────────────
-- Run these drops first to remove the old policies (including the recursive one):
--   DROP POLICY IF EXISTS "modules: teacher full"  ON public.modules;
--   DROP POLICY IF EXISTS "modules: student read"  ON public.modules;
--   DROP POLICY IF EXISTS "modules_select"         ON public.modules;
--   DROP POLICY IF EXISTS "modules_insert"         ON public.modules;
--   DROP POLICY IF EXISTS "modules_update"         ON public.modules;
--   DROP POLICY IF EXISTS "modules_student_read"   ON public.modules;

-- Teachers manage their own modules
create policy "modules_select" on public.modules
  for select using (auth.uid() = teacher_id);

create policy "modules_insert" on public.modules
  for insert with check (auth.uid() = teacher_id);

create policy "modules_update" on public.modules
  for update using (auth.uid() = teacher_id);

-- Students can read modules they have assignments in.
-- Uses auth.email() and the student_email column — no cross-table recursion.
create policy "modules_student_read" on public.modules
  for select using (
    exists (
      select 1 from public.assignments a
      where  a.module_id    = modules.id
        and  a.student_email = auth.email()
    )
  );


-- ── assignments ───────────────────────────────────────────────────────────────
-- Teachers manage assignments in their own modules
create policy "assignments: teacher full" on public.assignments
  for all using (
    exists (
      select 1 from public.modules m
      where  m.id = assignments.module_id
        and  m.teacher_id = auth.uid()
    )
  );

-- Students can read assignments sent to them directly (no cross-table join, no recursion).
-- Drop old policy first:
--   DROP POLICY IF EXISTS "assignments: student read" ON public.assignments;
--   DROP POLICY IF EXISTS "assignments_student_read"  ON public.assignments;
create policy "assignments_student_read" on public.assignments
  for select using (student_email = auth.email());


-- ── student_results ───────────────────────────────────────────────────────────
-- Students own their own results (create + read)
create policy "results: student own" on public.student_results
  for all using (auth.uid() = student_id);

-- Teachers can read results for assignments in their modules
create policy "results: teacher read" on public.student_results
  for select using (
    exists (
      select 1
      from   public.assignments a
      join   public.modules     m on m.id = a.module_id
      where  a.id          = student_results.assignment_id
        and  m.teacher_id  = auth.uid()
    )
  );


-- ── student_profiles ──────────────────────────────────────────────────────────
-- Students manage their own profile
create policy "student_profiles: student own" on public.student_profiles
  for all using (auth.uid() = student_id);

-- Teachers can read profiles of students in their modules
create policy "student_profiles: teacher read" on public.student_profiles
  for select using (
    exists (
      select 1
      from   public.student_results sr
      join   public.assignments     a  on a.id  = sr.assignment_id
      join   public.modules         m  on m.id  = a.module_id
      where  sr.student_id          = student_profiles.student_id
        and  m.teacher_id           = auth.uid()
    )
  );


-- ── daily_reports ─────────────────────────────────────────────────────────────
-- Teachers can fully manage their own reports
create policy "daily_reports: teacher full" on public.daily_reports
  for all using (auth.uid() = teacher_id);


-- ── challenger_sessions ───────────────────────────────────────────────────────
-- Students own their own sessions
create policy "challenger_sessions: student own" on public.challenger_sessions
  for all using (auth.uid() = student_id);

-- Teachers can read challenger sessions for students in their modules
create policy "challenger_sessions: teacher read" on public.challenger_sessions
  for select using (
    exists (
      select 1
      from   public.assignments a
      join   public.modules     m on m.id = a.module_id
      where  a.id           = challenger_sessions.assignment_id
        and  m.teacher_id   = auth.uid()
    )
  );


-- ============================================================
-- 8. Articles
--    Teacher-curated content with AI analysis results.
--    status: 'analysed' = awaiting teacher review
--            'approved' = ready to assign to modules
-- ============================================================
create table if not exists public.articles (
  id           uuid        default gen_random_uuid() primary key,
  teacher_id   uuid        references public.users(id) on delete cascade not null,
  url          text        not null,
  title        text        not null default '',
  source       text        not null default '',
  summary      text        not null default '',
  content_type text        not null default 'news_article',
  analysis     jsonb,
  status       text        not null default 'analysed'
                 check (status in ('analysed', 'approved')),
  created_at   timestamptz not null default now()
);

alter table public.articles enable row level security;

create policy "articles: teacher full" on public.articles
  for all using (auth.uid() = teacher_id);


-- ============================================================
-- Indexes
-- ============================================================

-- Existing
create index if not exists idx_modules_teacher         on public.modules              (teacher_id);
create index if not exists idx_assignments_module      on public.assignments          (module_id);
create index if not exists idx_results_student         on public.student_results      (student_id);
create index if not exists idx_results_assignment      on public.student_results      (assignment_id);

-- New (v2)
create index if not exists idx_assignments_due         on public.assignments          (due_date);
create index if not exists idx_modules_key_stage       on public.modules              (key_stage);
create index if not exists idx_profiles_student        on public.student_profiles     (student_id);
create index if not exists idx_reports_teacher_date    on public.daily_reports        (teacher_id, report_date);
create index if not exists idx_reports_module          on public.daily_reports        (module_id);
create index if not exists idx_challenger_student      on public.challenger_sessions  (student_id);
create index if not exists idx_challenger_assignment   on public.challenger_sessions  (assignment_id);

-- Articles (v3)
create index if not exists idx_articles_teacher        on public.articles             (teacher_id);
create index if not exists idx_articles_status         on public.articles             (teacher_id, status);
