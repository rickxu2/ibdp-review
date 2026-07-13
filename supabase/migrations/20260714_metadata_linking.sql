-- Link resources by explicit metadata rather than file names.
alter table public.attempt_content
  add column if not exists answer_file_path text,
  add column if not exists textbook_file_path text,
  add column if not exists submission_id uuid references public.submissions(id) on delete set null;

alter table public.submissions
  add column if not exists subject text,
  add column if not exists resource_key text,
  add column if not exists title text;

alter table public.learning_resources
  add column if not exists resource_key text,
  add column if not exists file_role text,
  add column if not exists page_start integer,
  add column if not exists page_end integer;

create index if not exists resources_student_key_idx
  on public.learning_resources(student_id, resource_key);

grant update on public.learning_resources to authenticated;

drop policy if exists "supervisor updates resources" on public.learning_resources;
create policy "supervisor updates resources" on public.learning_resources
  for update to authenticated
  using (public.is_supervisor_of(student_id))
  with check (public.is_supervisor_of(student_id) and uploaded_by = (select auth.uid()));

notify pgrst, 'reload schema';
