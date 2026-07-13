-- Link resources by explicit metadata rather than file names.
alter table public.attempt_content
  add column if not exists answer_file_path text,
  add column if not exists textbook_file_path text,
  add column if not exists supporting_file_paths jsonb not null default '[]'::jsonb,
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

-- One-time adoption of textbook parts uploaded by the previous importer.
-- Future uploads receive these values directly from manifest.json.
update public.learning_resources
set resource_key = coalesce(resource_key, 'textbook:' || subject),
    file_role = coalesce(file_role, 'textbook_part'),
    page_start = coalesce(page_start, ((regexp_match(file_name, '_p([0-9]+)-([0-9]+)\.pdf$', 'i'))[1])::integer),
    page_end = coalesce(page_end, ((regexp_match(file_name, '_p([0-9]+)-([0-9]+)\.pdf$', 'i'))[2])::integer)
where kind = 'textbook'
  and file_name ~* '_p[0-9]+-[0-9]+\.pdf$';

create index if not exists resources_student_key_idx
  on public.learning_resources(student_id, resource_key);

grant update on public.learning_resources to authenticated;

drop policy if exists "supervisor updates resources" on public.learning_resources;
create policy "supervisor updates resources" on public.learning_resources
  for update to authenticated
  using (public.is_supervisor_of(student_id))
  with check (public.is_supervisor_of(student_id) and uploaded_by = (select auth.uid()));

drop policy if exists "supervisor updates resource files" on storage.objects;
create policy "supervisor updates resource files" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'private-study-files'
    and (storage.foldername(name))[2] = 'resources'
    and public.is_supervisor_of(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'private-study-files'
    and (storage.foldername(name))[2] = 'resources'
    and public.is_supervisor_of(((storage.foldername(name))[1])::uuid)
  );

notify pgrst, 'reload schema';
