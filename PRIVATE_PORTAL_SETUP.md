# Private portal setup

The portal keeps IB questions, markschemes, textbooks, student submissions, and review progress outside the public Git repository. Only an authenticated student and their linked supervisor can access them.

## 1. Create the Supabase project

1. Create a Supabase project in **Southeast Asia (Singapore)**.
   - Enable Data API: **on**
   - Automatically expose new tables: **off**
   - Enable automatic RLS: **on**
2. In the SQL editor, run `supabase/schema.sql` once.
3. In Authentication settings, enable email/password sign-in and disable **Allow new users to sign up**. Accounts are provisioned only by the supervisor from Authentication > Users; the portal never sends magic links.
4. Add the final GitHub Pages URL and `http://localhost:8788/docs/` to the allowed redirect URLs.

## 2. Connect the website

Copy the project URL and the browser-safe anon/publishable key into `docs/supabase-config.js`.

Never put a Supabase secret key or service-role key in `docs/`, Git, a browser, or a message to the student. RLS protects the public browser key; the secret key bypasses RLS.

## 3. Create and link the two users

1. In Authentication > Users, create each account with an email and temporary password, and mark the email confirmed. Creating the Auth user also creates its profile row automatically.
2. In Supabase Authentication > Users, copy both UUIDs.
3. In the SQL editor, run:

```sql
update public.profiles
set role = 'supervisor'
where id = '<SUPERVISOR_UUID>';

insert into public.supervisor_students(supervisor_id, student_id)
values ('<SUPERVISOR_UUID>', '<STUDENT_UUID>');
```

For the single-student MVP, create the student in Authentication > Users with a temporary password and email confirmation enabled. The student signs in with that password, then changes it on the portal's Account page. This avoids depending on Supabase's rate-limited demonstration email service for daily access.

## 4. Import existing records

Keep the service-role key only in the supervisor's terminal session, then run:

```powershell
$env:SUPABASE_URL = 'https://PROJECT.supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY = 'SECRET_KEY'
.\scripts\sync-supabase.ps1 -StudentId '<STUDENT_UUID>'
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
```

The sync tool uploads structured attempts, private question/answer/markscheme text, and review state. It does not upload local PDFs automatically. Protected PDFs are uploaded through the supervisor's Files page.

## 5. China connectivity gate

Before normal use, the student opens `#/connection` on both their usual Wi-Fi and mobile data and runs the test. Continue with Supabase only if login, all three API requests, and the upload test pass consistently. If either network repeatedly fails, migrate the same product workflow to Tencent CloudBase Shanghai before importing the full file library.

## Copyright boundary

Private storage and access controls prevent public distribution; they do not create a licence. Upload only material the supervisor and student are legally entitled to possess and use, restrict access to the linked student, and remove access when supervision ends.
