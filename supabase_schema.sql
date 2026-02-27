-- ============================================================
-- Cronkite Education – Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Users profile table
--    Mirrors auth.users; auto-populated on signup via trigger below.
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


-- 2. Modules (created by teachers)
create table if not exists public.modules (
  id          uuid        default gen_random_uuid() primary key,
  teacher_id  uuid        references public.users(id) on delete cascade not null,
  title       text        not null,
  description text        not null default '',
  focus_point text        not null default '',
  created_at  timestamptz not null default now()
);


-- 3. Assignments (articles attached to a module)
create table if not exists public.assignments (
  id            uuid        default gen_random_uuid() primary key,
  module_id     uuid        references public.modules(id) on delete cascade not null,
  article_url   text        not null,
  article_title text        not null default '',
  created_at    timestamptz not null default now()
);


-- 4. Student results
create table if not exists public.student_results (
  id            uuid        default gen_random_uuid() primary key,
  student_id    uuid        references public.users(id) on delete cascade not null,
  assignment_id uuid        references public.assignments(id) on delete cascade not null,
  analysis_json jsonb,
  completed_at  timestamptz not null default now(),
  unique (student_id, assignment_id)   -- one submission per student per assignment
);


-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.users           enable row level security;
alter table public.modules         enable row level security;
alter table public.assignments     enable row level security;
alter table public.student_results enable row level security;


-- ── users ────────────────────────────────────────────────────────────────────
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
-- Teachers have full control over their own modules
create policy "modules: teacher full" on public.modules
  for all using (auth.uid() = teacher_id);

-- Students can read a module if they have any result for one of its assignments
create policy "modules: student read" on public.modules
  for select using (
    exists (
      select 1
      from   public.assignments     a
      join   public.student_results sr on sr.assignment_id = a.id
      where  a.module_id   = modules.id
        and  sr.student_id = auth.uid()
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

-- Students can read an assignment if they have a result for it
create policy "assignments: student read" on public.assignments
  for select using (
    exists (
      select 1 from public.student_results sr
      where  sr.assignment_id = assignments.id
        and  sr.student_id    = auth.uid()
    )
  );


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


-- ============================================================
-- Indexes
-- ============================================================
create index if not exists idx_modules_teacher         on public.modules         (teacher_id);
create index if not exists idx_assignments_module      on public.assignments     (module_id);
create index if not exists idx_results_student         on public.student_results (student_id);
create index if not exists idx_results_assignment      on public.student_results (assignment_id);
