-- IBDP Review private portal schema.
-- Run once in the Supabase SQL editor. All student-owned data is protected by RLS.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'student' check (role in ('student', 'supervisor')),
  created_at timestamptz not null default now()
);

create table if not exists public.supervisor_students (
  supervisor_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (supervisor_id, student_id),
  check (supervisor_id <> student_id)
);

create or replace function public.is_supervisor_of(target_student uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.supervisor_students ss
    where ss.supervisor_id = (select auth.uid()) and ss.student_id = target_student
  );
$$;

create or replace function public.can_access_student(target_student uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) = target_student or public.is_supervisor_of(target_student);
$$;

revoke all on function public.is_supervisor_of(uuid) from public;
revoke all on function public.can_access_student(uuid) from public;
grant execute on function public.is_supervisor_of(uuid) to authenticated;
grant execute on function public.can_access_student(uuid) to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)), 'student')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.attempts (
  id text primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  subject text not null,
  source jsonb not null default '{}'::jsonb,
  kps text[] not null default '{}',
  command_term text,
  max integer not null check (max > 0),
  earned integer not null check (earned >= 0 and earned <= max),
  verdict text not null check (verdict in ('correct', 'partial', 'wrong')),
  error_type text check (error_type is null or error_type in ('concept', 'calculation', 'misread', 'expression', 'time')),
  analysis text,
  textbook_ref jsonb,
  uncertain boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, student_id)
);
create index if not exists attempts_student_date_idx on public.attempts(student_id, date desc);

create table if not exists public.attempt_content (
  attempt_id text primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  question_text text,
  answer_text text,
  markscheme_text text,
  paper_key text,
  qp_page integer,
  ms_page integer,
  question_file_path text,
  markscheme_file_path text,
  answer_file_path text,
  textbook_file_path text,
  updated_at timestamptz not null default now(),
  foreign key (attempt_id, student_id) references public.attempts(id, student_id) on delete cascade
);

create table if not exists public.review_progress (
  attempt_id text primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  stage integer not null default 0 check (stage between 0 and 5),
  next_review date,
  done boolean not null default false,
  history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  foreign key (attempt_id, student_id) references public.attempts(id, student_id) on delete cascade
);
create index if not exists review_student_next_idx on public.review_progress(student_id, next_review);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  note text,
  status text not null default 'submitted' check (status in ('submitted', 'marking', 'marked', 'archived')),
  submitted_at timestamptz not null default now(),
  unique (id, student_id)
);
create index if not exists submissions_student_time_idx on public.submissions(student_id, submitted_at desc);

create table if not exists public.submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null,
  student_id uuid not null references public.profiles(id) on delete cascade,
  bucket_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  foreign key (submission_id, student_id) references public.submissions(id, student_id) on delete cascade
);

create table if not exists public.learning_resources (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('question_paper', 'markscheme', 'textbook', 'other')),
  subject text,
  bucket_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists resources_student_kind_idx on public.learning_resources(student_id, kind, created_at desc);

alter table public.profiles enable row level security;
alter table public.supervisor_students enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_content enable row level security;
alter table public.review_progress enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_files enable row level security;
alter table public.learning_resources enable row level security;

-- The project is created with "Automatically expose new tables" disabled.
-- Grant API access explicitly; RLS policies below still decide which rows each
-- authenticated user may read or change. Anonymous users receive no grants.
grant select on public.profiles, public.supervisor_students to authenticated;
grant select, insert, update, delete on public.attempts to authenticated;
grant select, insert, update on public.attempt_content to authenticated;
grant select, insert, update, delete on public.review_progress to authenticated;
grant select, insert, update on public.submissions to authenticated;
grant select, insert on public.submission_files to authenticated;
grant select, insert, delete on public.learning_resources to authenticated;

create policy "read own profile or linked profiles" on public.profiles for select to authenticated
using (id = (select auth.uid()) or public.is_supervisor_of(id) or exists (
  select 1 from public.supervisor_students ss where ss.student_id = (select auth.uid()) and ss.supervisor_id = profiles.id
));
create policy "read own supervision links" on public.supervisor_students for select to authenticated
using (supervisor_id = (select auth.uid()) or student_id = (select auth.uid()));

create policy "read accessible attempts" on public.attempts for select to authenticated using (public.can_access_student(student_id));
create policy "supervisor inserts attempts" on public.attempts for insert to authenticated with check (public.is_supervisor_of(student_id));
create policy "supervisor updates attempts" on public.attempts for update to authenticated using (public.is_supervisor_of(student_id)) with check (public.is_supervisor_of(student_id));
create policy "supervisor deletes attempts" on public.attempts for delete to authenticated using (public.is_supervisor_of(student_id));

create policy "read accessible attempt content" on public.attempt_content for select to authenticated using (public.can_access_student(student_id));
create policy "supervisor inserts attempt content" on public.attempt_content for insert to authenticated with check (public.is_supervisor_of(student_id));
create policy "supervisor updates attempt content" on public.attempt_content for update to authenticated using (public.is_supervisor_of(student_id)) with check (public.is_supervisor_of(student_id));

create policy "read accessible review progress" on public.review_progress for select to authenticated using (public.can_access_student(student_id));
create policy "student inserts review progress" on public.review_progress for insert to authenticated with check (student_id = (select auth.uid()));
create policy "student updates review progress" on public.review_progress for update to authenticated using (student_id = (select auth.uid())) with check (student_id = (select auth.uid()));
create policy "supervisor manages review progress" on public.review_progress for all to authenticated using (public.is_supervisor_of(student_id)) with check (public.is_supervisor_of(student_id));

create policy "student creates submissions" on public.submissions for insert to authenticated with check (student_id = (select auth.uid()));
create policy "read accessible submissions" on public.submissions for select to authenticated using (public.can_access_student(student_id));
create policy "supervisor updates submissions" on public.submissions for update to authenticated using (public.is_supervisor_of(student_id)) with check (public.is_supervisor_of(student_id));

create policy "student creates submission metadata" on public.submission_files for insert to authenticated with check (student_id = (select auth.uid()));
create policy "read accessible submission metadata" on public.submission_files for select to authenticated using (public.can_access_student(student_id));
create policy "read accessible resources" on public.learning_resources for select to authenticated using (public.can_access_student(student_id));
create policy "supervisor creates resources" on public.learning_resources for insert to authenticated with check (public.is_supervisor_of(student_id) and uploaded_by = (select auth.uid()));
create policy "supervisor deletes resources" on public.learning_resources for delete to authenticated using (public.is_supervisor_of(student_id));

insert into storage.buckets (id, name, public, file_size_limit)
values ('private-study-files', 'private-study-files', false, 524288000)
on conflict (id) do update set public = false, file_size_limit = 524288000;

alter table public.attempt_content add column if not exists answer_file_path text;
alter table public.attempt_content add column if not exists textbook_file_path text;

create policy "read accessible private study files" on storage.objects for select to authenticated
using (bucket_id = 'private-study-files' and (
  (storage.foldername(name))[1] = (select auth.uid())::text
  or public.is_supervisor_of(((storage.foldername(name))[1])::uuid)
));
create policy "student uploads submissions" on storage.objects for insert to authenticated
with check (bucket_id = 'private-study-files' and (storage.foldername(name))[1] = (select auth.uid())::text and (storage.foldername(name))[2] = 'submissions');
create policy "student uploads connection tests" on storage.objects for insert to authenticated
with check (bucket_id = 'private-study-files' and (storage.foldername(name))[1] = (select auth.uid())::text and (storage.foldername(name))[2] = 'connectivity');
create policy "student removes connection tests" on storage.objects for delete to authenticated
using (bucket_id = 'private-study-files' and (storage.foldername(name))[1] = (select auth.uid())::text and (storage.foldername(name))[2] = 'connectivity');
create policy "supervisor uploads resources" on storage.objects for insert to authenticated
with check (bucket_id = 'private-study-files' and (storage.foldername(name))[2] = 'resources' and public.is_supervisor_of(((storage.foldername(name))[1])::uuid));
create policy "supervisor deletes accessible files" on storage.objects for delete to authenticated
using (bucket_id = 'private-study-files' and public.is_supervisor_of(((storage.foldername(name))[1])::uuid));

-- Bootstrap after both users have signed in once (replace the UUIDs):
-- update public.profiles set role = 'supervisor' where id = '<SUPERVISOR_UUID>';
-- insert into public.supervisor_students(supervisor_id, student_id)
-- values ('<SUPERVISOR_UUID>', '<STUDENT_UUID>');
