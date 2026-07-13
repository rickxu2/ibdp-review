-- Private links shown on each marked result.
alter table public.attempt_content add column if not exists answer_file_path text;
alter table public.attempt_content add column if not exists textbook_file_path text;

-- The largest current textbook is about 295 MB. The project-level global
-- Storage limit must also be at least 500 MB or this update will be rejected.
update storage.buckets
set public = false, file_size_limit = 524288000
where id = 'private-study-files';
