"use strict";

window.Portal = (() => {
  const C = window.IBDP_SUPABASE || {};
  const configured = !!(C.url && C.anonKey && window.supabase);
  let client = null, user = null, profile = null, studentId = null, db = null, localSeed = null;
  const resources = [];
  const tx = (lang, en, zh) => lang === "zh" ? zh : en;
  const html = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const safeName = name => name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-100);
  // `supporting_file_paths` is jsonb. Normalize historical rows that were
  // saved as a single object or a JSON string before exposing them to app.js.
  const sourceFiles = value => {
    if (value == null || value === "") return [];
    if (typeof value === "string") {
      try { return sourceFiles(JSON.parse(value)); }
      catch (_) { return [{ path: value }]; }
    }
    return (Array.isArray(value) ? value : [value])
      .filter(item => item && typeof item === "object");
  };
  const subjectOptions = selected => Object.entries((db && db.meta && db.meta.subjects) || {})
    .map(([id, item]) => `<option value="${html(id)}" ${id === selected ? "selected" : ""}>${html(item.name || id)}</option>`).join("");
  const paperChoices = subject => {
    const seen = new Map();
    const priority = r => r.file_role === "question_booklet" || r.file_role === "question_paper" ? 0 : r.kind === "question_paper" ? 1 : 2;
    for (const r of resources) if (r.subject === subject && r.resource_key && ["question_paper", "markscheme"].includes(r.kind)) {
      const previous = seen.get(r.resource_key);
      if (!previous || priority(r) < priority(previous)) seen.set(r.resource_key, r);
    }
    return [...seen.values()].sort((a, b) => String(a.title || a.resource_key).localeCompare(String(b.title || b.resource_key)));
  };
  const paperLabel = r => String(r.title || r.resource_key)
    .replace(/\s+(Question booklet|Text\/source booklet(?:\s+\d+)?|Markscheme)$/i, "");
  const librarySpec = fileName => {
    const n = fileName.toLowerCase();
    const split = n.match(/^(chem_sl|econ_sl|phys_hl)_.+_p(\d+)-(\d+)\.pdf$/);
    if (split) {
      const names = { chem_sl: "Chemistry", econ_sl: "Economics", phys_hl: "Physics" };
      return { kind: "textbook", subject: split[1], title: `${names[split[1]]} textbook pp. ${split[2]}–${split[3]}`, object: `textbooks/${split[1]}/${safeName(fileName)}` };
    }
    if (n.includes("economics") && n.includes("course companion")) return { kind: "textbook", subject: "econ_sl", title: "Economics Course Companion", object: "textbooks/econ_sl.pdf" };
    if (n.includes("english b") && n.includes("course companion")) return { kind: "textbook", subject: "eng_b_hl", title: "English B Course Companion", object: "textbooks/eng_b_hl.pdf" };
    if (n.includes("mathematics") && n.includes("analysis")) return { kind: "textbook", subject: "math_aa_hl", title: "Mathematics Analysis and Approaches HL 2", object: "textbooks/math_aa_hl.pdf" };
    if (n.includes("oxford_resources_for_ib_dp_chemistry")) return { kind: "textbook", subject: "chem_sl", title: "Chemistry Course Book", object: "textbooks/chem_sl.pdf" };
    if (n.includes("physics") && n.includes("course_companion")) return { kind: "textbook", subject: "phys_hl", title: "Physics Course Companion", object: "textbooks/phys_hl.pdf" };
    if (n === "paper_2_ms.pdf") return { kind: "markscheme", subject: "chem_sl", title: "Chemistry 2025 May TZ1 Paper 2 Markscheme", object: "papers/chem_sl/2025_May_TZ1_P2/markscheme.pdf" };
    if (n === "paper_2.pdf") return { kind: "question_paper", subject: "chem_sl", title: "Chemistry 2025 May TZ1 Paper 2", object: "papers/chem_sl/2025_May_TZ1_P2/question-paper.pdf" };
    return null;
  };

  async function resumableUpload(file, objectPath, onProgress) {
    const { data: { session } } = await client.auth.getSession();
    if (!session) throw new Error("Session expired. Sign in again.");
    const projectRef = new URL(C.url).hostname.split(".")[0];
    const endpoint = `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`;
    const b64 = value => btoa(unescape(encodeURIComponent(String(value))));
    const meta = { bucketName: C.bucket, objectName: objectPath, contentType: file.type || "application/pdf", cacheControl: "3600" };
    const create = await fetch(endpoint, { method: "POST", headers: {
      authorization: `Bearer ${session.access_token}`, "Tus-Resumable": "1.0.0", "Upload-Length": String(file.size), "x-upsert": "true",
      "Upload-Metadata": Object.entries(meta).map(([k, v]) => `${k} ${b64(v)}`).join(",")
    }});
    if (!create.ok) throw new Error(`${file.name}: ${create.status} ${await create.text()}`);
    const location = create.headers.get("location");
    if (!location) throw new Error(`${file.name}: no resumable upload URL returned`);
    const uploadUrl = new URL(location, endpoint).toString();
    const chunk = 6 * 1024 * 1024;
    let offset = 0;
    while (offset < file.size) {
      const body = file.slice(offset, Math.min(offset + chunk, file.size));
      let response;
      for (let attempt = 1; attempt <= 5; attempt++) {
        response = await fetch(uploadUrl, { method: "PATCH", headers: {
          authorization: `Bearer ${session.access_token}`, "Tus-Resumable": "1.0.0", "Upload-Offset": String(offset), "Content-Type": "application/offset+octet-stream"
        }, body });
        if (response.ok) break;
        if (attempt === 5) throw new Error(`${file.name}: ${response.status} ${await response.text()}`);
        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
      }
      offset = Number(response.headers.get("upload-offset") || offset + body.size);
      onProgress(Math.floor(offset / file.size * 100));
    }
  }

  async function init(targetDb) {
    db = targetDb;
    if (["localhost", "127.0.0.1"].includes(location.hostname)) {
      localSeed = { attempts: targetDb.attempts.map(a => ({ ...a })), content: { ...targetDb.content } };
    }
    if (!configured) return true;
    client = window.supabase.createClient(C.url, C.anonKey, { auth: { persistSession: true, detectSessionInUrl: true } });
    const { data: { session } } = await client.auth.getSession();
    if (!session) {
      client.auth.onAuthStateChange((event, next) => { if (event === "SIGNED_IN" && next) location.reload(); });
      return false;
    }
    user = session.user;
    const { data: p, error: pe } = await client.from("profiles").select("id,display_name,role").eq("id", user.id).single();
    if (pe) throw pe;
    profile = p;
    if (profile.role === "student") studentId = user.id;
    else {
      const { data: links, error } = await client.from("supervisor_students").select("student_id").eq("supervisor_id", user.id).limit(1);
      if (error) throw error;
      studentId = links && links[0] && links[0].student_id;
    }
    document.getElementById("accountBtn").style.display = "inline-block";
    document.getElementById("accountBtn").textContent = "Account";
    document.getElementById("accountBtn").onclick = () => { location.hash = "#/account"; };
    await syncData();
    return true;
  }

  async function syncData() {
    db.attempts = [];
    db.content = {};
    db.reviewProgress = {};
    if (!studentId) return;
    const [ar, cr, rr, lr] = await Promise.all([
      client.from("attempts").select("*").eq("student_id", studentId).order("date").order("id"),
      client.from("attempt_content").select("*").eq("student_id", studentId),
      client.from("review_progress").select("*").eq("student_id", studentId),
      client.from("learning_resources").select("*").eq("student_id", studentId)
    ]);
    if (ar.error) throw ar.error;
    if (cr.error) throw cr.error;
    if (rr.error) throw rr.error;
    if (lr.error) throw lr.error;
    resources.splice(0, resources.length, ...(lr.data || []));
    db.attempts = (ar.data || []).map(a => ({ ...a, review: null }));
    for (const c of cr.data || []) db.content[c.attempt_id] = {
      q: c.question_text, ans: c.answer_text, ms: c.markscheme_text,
      paper: c.paper_key, qp_page: c.qp_page, ms_page: c.ms_page,
      qp_file: c.question_file_path, ms_file: c.markscheme_file_path,
      source_files: sourceFiles(c.supporting_file_paths),
      answer_file: c.answer_file_path, textbook_file: c.textbook_file_path,
      submission_id: c.submission_id
    };
    for (const r of rr.data || []) db.reviewProgress[r.attempt_id] = {
      stage: r.stage, next: r.next_review, done: r.done, history: r.history || []
    };
    db.attempts.sort((a, b) => a.id.localeCompare(b.id));
  }

  function renderLogin(lang) {
    document.querySelector(".topbar nav").style.display = "none";
    if (!configured) {
      document.getElementById("app").innerHTML = `<div class="portal-login card"><h2>${tx(lang, "Private portal setup pending", "私密门户尚未连接")}</h2><p>${tx(lang, "The private database has not been connected yet. The public dashboard remains available.", "私有数据库尚未连接，目前仍可使用公开数据看板。")}</p></div>`;
      return;
    }
    document.getElementById("app").innerHTML = `<div class="portal-login card">
      <h2>${tx(lang, "Private student portal", "私密学生门户")}</h2>
      <p>${tx(lang, "Sign in to view submissions, protected questions, markschemes and textbooks.", "登录后查看提交、受保护的题目、markscheme 和课本。")}</p>
      <form id="loginForm"><label>${tx(lang, "Email", "邮箱")}<input id="loginEmail" type="email" required autocomplete="email"></label>
      <label>${tx(lang, "Password", "密码")}<input id="loginPassword" type="password" required autocomplete="current-password"></label>
      <button type="submit" class="portal-primary">${tx(lang, "Sign in", "登录")}</button></form>
      <p class="note">${tx(lang, "Accounts are created by the supervisor. There is no public sign-up or email-link login.", "账号由 supervisor 创建，不开放公开注册或邮件链接登录。")}</p>
      <div id="loginStatus" class="note"></div></div>`;
    document.getElementById("loginForm").onsubmit = async e => {
      e.preventDefault();
      const status = document.getElementById("loginStatus");
      status.textContent = tx(lang, "Signing in…", "正在登录…");
      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) status.textContent = error.message;
      else location.reload();
    };
  }

  function pageAccount(lang) {
    if (!configured || !user) return renderLogin(lang);
    document.getElementById("app").innerHTML = `<h2>${tx(lang, "Account", "账户")}</h2><div class="card portal-form account-card">
      <div><b>${html(user.email || "")}</b><div class="note">${tx(lang, "Role", "角色")}: ${html(profile.role)}</div></div>
      <h3>${tx(lang, "Set or change password", "设置或修改密码")}</h3>
      <form id="passwordForm"><label>${tx(lang, "New password", "新密码")}<input id="newPassword" type="password" minlength="10" required autocomplete="new-password"></label>
      <label>${tx(lang, "Confirm password", "确认密码")}<input id="confirmPassword" type="password" minlength="10" required autocomplete="new-password"></label>
      <button type="submit" class="portal-primary">${tx(lang, "Save password", "保存密码")}</button></form>
      <div id="passwordStatus" class="note"></div>
      ${profile.role === "supervisor" && localSeed ? `<p><a href="#/migrate">${tx(lang, "Migrate local records to the linked student", "把本地旧记录迁移给已关联学生")}</a></p>` : ""}
      <button id="signOutBtn" class="mini-btn">${tx(lang, "Sign out on this device", "在这台设备退出")}</button>
    </div>`;
    document.getElementById("passwordForm").onsubmit = async e => {
      e.preventDefault();
      const status = document.getElementById("passwordStatus");
      const password = document.getElementById("newPassword").value;
      if (password !== document.getElementById("confirmPassword").value) { status.textContent = tx(lang, "Passwords do not match.", "两次密码不一致。"); return; }
      status.textContent = tx(lang, "Saving…", "正在保存…");
      const { error } = await client.auth.updateUser({ password });
      status.textContent = error ? error.message : tx(lang, "Password saved. You can now sign in without an email link.", "密码已保存，以后无需邮件链接即可登录。");
      if (!error) e.target.reset();
    };
    document.getElementById("signOutBtn").onclick = async () => { await client.auth.signOut({ scope: "local" }); location.reload(); };
  }

  async function pageMigrate(lang) {
    if (!configured || !user) return renderLogin(lang);
    if (profile.role !== "supervisor" || !localSeed) {
      document.getElementById("app").innerHTML = `<div class="card">${tx(lang, "Migration is available only to a supervisor on localhost.", "迁移功能只允许 supervisor 在 localhost 使用。")}</div>`;
      return;
    }
    if (!studentId) {
      document.getElementById("app").innerHTML = `<div class="card">${tx(lang, "Link the student account before migrating records.", "请先关联学生账号，再迁移记录。")}</div>`;
      return;
    }
    const privateCount = Object.keys(localSeed.content).length;
    document.getElementById("app").innerHTML = `<h2>${tx(lang, "Migrate existing records", "迁移现有记录")}</h2><div class="card portal-form">
      <p>${tx(lang, `This will upsert ${localSeed.attempts.length} attempts and ${privateCount} private content records to the linked student. Existing IDs are updated, never duplicated.`, `将把 ${localSeed.attempts.length} 条 attempt 和 ${privateCount} 条私有内容写入已关联学生。相同 ID 只更新，不会重复。`)}</p>
      <button id="runMigration" class="portal-primary">${tx(lang, "Migrate now", "开始迁移")}</button><div id="migrationStatus" class="note"></div></div>`;
    document.getElementById("runMigration").onclick = async e => {
      const status = document.getElementById("migrationStatus");
      e.target.disabled = true;
      status.textContent = tx(lang, "Migrating…", "正在迁移…");
      try {
        const attemptRows = localSeed.attempts.map(a => {
          const { review, ...record } = a;
          return { ...record, student_id: studentId };
        });
        const contentRows = Object.entries(localSeed.content).map(([id, c]) => {
          const attempt = localSeed.attempts.find(a => a.id === id);
          return { attempt_id: id, student_id: studentId, question_text: c.q || null, answer_text: c.ans || null, markscheme_text: c.ms || null, paper_key: c.paper || (attempt && attempt.source && attempt.source.paper) || null, qp_page: c.qp_page || null, ms_page: c.ms_page || null };
        });
        const reviewRows = localSeed.attempts.filter(a => a.review).map(a => ({ attempt_id: a.id, student_id: studentId, stage: a.review.stage || 0, next_review: a.review.next || null, done: !!a.review.done, history: a.review.history || [] }));
        const aResult = await client.from("attempts").upsert(attemptRows, { onConflict: "id" });
        if (aResult.error) throw aResult.error;
        if (contentRows.length) {
          const cResult = await client.from("attempt_content").upsert(contentRows, { onConflict: "attempt_id" });
          if (cResult.error) throw cResult.error;
        }
        if (reviewRows.length) {
          const rResult = await client.from("review_progress").upsert(reviewRows, { onConflict: "attempt_id" });
          if (rResult.error) throw rResult.error;
        }
        await syncData();
        status.textContent = tx(lang, `Migration complete: ${attemptRows.length} attempts and ${contentRows.length} private records.`, `迁移完成：${attemptRows.length} 条 attempt，${contentRows.length} 条私有内容。`);
      } catch (error) {
        status.textContent = error.message;
      } finally { e.target.disabled = false; }
    };
  }

  function reviewState(attemptId) { return db && db.reviewProgress && db.reviewProgress[attemptId]; }
  async function saveReview(attemptId, state) {
    if (!configured || !user || profile.role !== "student") return false;
    const row = { attempt_id: attemptId, student_id: user.id, stage: state.stage, next_review: state.next, done: state.done, history: state.history, updated_at: new Date().toISOString() };
    const { error } = await client.from("review_progress").upsert(row, { onConflict: "attempt_id" });
    if (error) throw error;
    db.reviewProgress[attemptId] = state;
    return true;
  }

  function pageSubmit(lang) {
    if (!configured || !user) return renderLogin(lang);
    if (profile.role === "supervisor") return pageInbox(lang);
    document.getElementById("app").innerHTML = `<h2>${tx(lang, "Submit work", "提交作业")}</h2>
      <div class="card portal-form"><p>${tx(lang, "Choose what this work belongs to, then upload the completed answer. File names do not matter.", "先选择这份作业属于哪套试卷或哪个科目，再上传完成的答案；文件名不影响关联。")}</p><p class="note"><a href="#/connection">${tx(lang, "Test connection from China", "测试中国大陆连接")}</a></p>
      <form id="submitWork"><label>${tx(lang, "Subject", "科目")}<select id="workSubject" required><option value="">—</option>${subjectOptions()}</select></label>
      <label>${tx(lang, "Related paper (optional)", "对应试卷（可选）")}<select id="workResource" disabled><option value="">${tx(lang, "Choose a subject first", "请先选择科目")}</option></select></label>
      <label>${tx(lang, "Assignment title", "作业名称")}<input id="workTitle" placeholder="e.g. Topic 4 homework" required></label>
      <label>${tx(lang, "Files", "文件")}<input id="workFiles" type="file" accept="image/*,.pdf" multiple required></label>
      <label>${tx(lang, "Note (optional)", "备注（可选）")}<textarea id="workNote" rows="3" placeholder="${tx(lang, "Subject, paper and question numbers", "科目、试卷和题号")}"></textarea></label>
      <button type="submit" class="portal-primary">${tx(lang, "Upload submission", "上传提交")}</button></form><div id="submitStatus" class="note"></div></div>`;
    const subjectField = document.getElementById("workSubject"), resourceField = document.getElementById("workResource");
    const renderPaperChoices = () => {
      const papers = paperChoices(subjectField.value);
      resourceField.disabled = !subjectField.value;
      resourceField.innerHTML = `<option value="">${tx(lang, "Other assignment", "其他作业")}</option>` + papers
        .map(r => `<option value="${html(r.resource_key)}">${html(paperLabel(r))}</option>`).join("");
    };
    subjectField.onchange = renderPaperChoices;
    renderPaperChoices();
    document.getElementById("submitWork").onsubmit = async e => {
      e.preventDefault();
      const status = document.getElementById("submitStatus");
      const files = [...document.getElementById("workFiles").files];
      status.textContent = tx(lang, "Uploading…", "正在上传…");
      const submissionId = crypto.randomUUID();
      const { error: se } = await client.from("submissions").insert({ id: submissionId, student_id: user.id,
        subject: document.getElementById("workSubject").value,
        resource_key: document.getElementById("workResource").value || null,
        title: document.getElementById("workTitle").value.trim(),
        note: document.getElementById("workNote").value.trim() || null });
      if (se) { status.textContent = se.message; return; }
      for (const file of files) {
        const path = `${user.id}/submissions/${submissionId}/${crypto.randomUUID()}-${safeName(file.name)}`;
        const { error: ue } = await client.storage.from(C.bucket).upload(path, file, { contentType: file.type || undefined });
        if (ue) { status.textContent = ue.message; return; }
        const { error: me } = await client.from("submission_files").insert({ submission_id: submissionId, student_id: user.id, bucket_path: path, file_name: file.name, mime_type: file.type || null, size_bytes: file.size });
        if (me) { status.textContent = me.message; return; }
      }
      e.target.reset();
      status.textContent = tx(lang, "Submitted successfully. Your supervisor can now see it.", "提交成功，supervisor 现在可以看到。")
    };
  }

  async function pageInbox(lang) {
    if (!studentId) { document.getElementById("app").innerHTML = `<div class="card">${tx(lang, "No student is linked to this supervisor account yet.", "这个 supervisor 账号还没有关联学生。")}</div>`; return; }
    const { data, error } = await client.from("submissions").select("id,title,subject,resource_key,note,status,submitted_at,submission_files(file_name,bucket_path)").eq("student_id", studentId).order("submitted_at", { ascending: false });
    if (error) { document.getElementById("app").innerHTML = `<div class="card">${html(error.message)}</div>`; return; }
    const actionFor = s => {
      if (s.status === "submitted") return `<button class="mini-btn js-submission-status" data-id="${html(s.id)}" data-status="marking">${tx(lang, "Start marking", "开始批改")}</button>`;
      if (s.status === "marking") return `<button class="mini-btn js-submission-status" data-id="${html(s.id)}" data-status="marked">${tx(lang, "Mark complete", "批改完成")}</button>`;
      if (s.status === "marked") return `<button class="mini-btn js-submission-status" data-id="${html(s.id)}" data-status="archived">${tx(lang, "Archive", "归档")}</button>`;
      return `<button class="mini-btn js-submission-status" data-id="${html(s.id)}" data-status="marking">${tx(lang, "Reopen", "重新打开")}</button>`;
    };
    document.getElementById("app").innerHTML = `<h2>${tx(lang, "Submission inbox", "提交收件箱")}</h2><div class="card">${(data || []).length ? data.map(s => `<div class="portal-row"><div><b>${html(s.title || tx(lang, "Untitled submission", "未命名提交"))}</b><div class="note">${new Date(s.submitted_at).toLocaleString()} · ${html(s.subject || "")} ${s.resource_key ? "· " + html(s.resource_key) : ""}<br>${html(s.note || "")}</div></div><span class="chip">${html(s.status)}</span><div>${(s.submission_files || []).map(f => `<button class="mini-btn js-open-private" data-path="${html(f.bucket_path)}">${html(f.file_name)}</button>`).join(" ")}</div><div>${actionFor(s)}</div></div>`).join("") : `<div class="empty">${tx(lang, "No submissions yet.", "还没有提交。")}</div>`}</div>`;
    wirePrivateOpen(lang);
    document.querySelectorAll(".js-submission-status").forEach(btn => btn.onclick = async () => {
      btn.disabled = true;
      const { error: updateError } = await client.from("submissions").update({ status: btn.dataset.status }).eq("id", btn.dataset.id).eq("student_id", studentId);
      if (updateError) { btn.disabled = false; alert(updateError.message); return; }
      await pageInbox(lang);
    });
  }

  async function pageFiles(lang) {
    if (!configured || !user) return renderLogin(lang);
    if (!studentId) { document.getElementById("app").innerHTML = `<div class="card">${tx(lang, "No student is linked to this supervisor account yet.", "这个 supervisor 账号还没有关联学生。")}</div>`; return; }
    const { data, error } = await client.from("learning_resources").select("*").eq("student_id", studentId).order("created_at", { ascending: false });
    if (error) { document.getElementById("app").innerHTML = `<div class="card">${html(error.message)}</div>`; return; }
    resources.splice(0, resources.length, ...(data || []));
    let upload = "";
    if (profile.role === "supervisor") upload = `<div class="card portal-form"><h3>${tx(lang, "Import project library", "导入项目资料库")}</h3>
      <p>${tx(lang, "Select the PDFs from Textbook/ and papers/. Recognized files are uploaded privately in resumable 6 MB chunks and linked automatically.", "选择 Textbook/ 和 papers/ 中的 PDF。系统会识别文件，以 6 MB 分块私密上传并自动建立链接。")}</p>
      <form id="libraryForm"><label>${tx(lang, "Project PDFs", "项目 PDF")}<input id="libraryFiles" type="file" accept=".pdf" multiple required></label>
      <button class="portal-primary" type="submit">${tx(lang, "Import recognized files", "导入已识别文件")}</button></form><div id="libraryStatus" class="note"></div></div>
      <div class="card portal-form"><h3>${tx(lang, "Add one protected resource", "添加单个受保护资料")}</h3><form id="resourceForm">
      <label>${tx(lang, "Title", "标题")}<input id="resourceTitle" required></label>
      <label>${tx(lang, "Type", "类型")}<select id="resourceKind"><option value="question_paper">Question paper</option><option value="markscheme">Markscheme</option><option value="textbook">Textbook</option><option value="other">Other</option></select></label>
      <label>${tx(lang, "Subject", "科目")}<input id="resourceSubject"></label><label>${tx(lang, "File", "文件")}<input id="resourceFile" type="file" accept=".pdf,image/*" required></label>
      <button class="portal-primary" type="submit">${tx(lang, "Upload privately", "私密上传")}</button></form><div id="resourceStatus" class="note"></div></div>`;
    document.getElementById("app").innerHTML = `<h2>${tx(lang, "Private resources", "私密资料库")}</h2><div class="note">${tx(lang, "Your long-term study library: textbooks, question papers, markschemes and supervisor-provided materials. Submit completed work through Submit instead.", "这里是长期学习资料库：课本、试卷、markscheme 和 supervisor 提供的资料。做完待批改的作业请通过“提交”上传。")}</div>${upload}<div class="card resource-list">${resources.length ? resources.map(r => `<div class="portal-row"><div><b>${html(r.title)}</b><div class="note">${html(r.kind)}${r.subject ? " · " + html(r.subject) : ""}</div></div><button class="mini-btn js-open-private" data-path="${html(r.bucket_path)}">${tx(lang, "Open", "打开")}</button></div>`).join("") : `<div class="empty">${tx(lang, "No resources uploaded yet.", "还没有上传资料。")}</div>`}</div>`;
    wirePrivateOpen(lang);
    const libraryForm = document.getElementById("libraryForm");
    if (libraryForm) libraryForm.onsubmit = async e => {
      e.preventDefault();
      const status = document.getElementById("libraryStatus");
      const selected = [...document.getElementById("libraryFiles").files].map(file => ({ file, spec: librarySpec(file.name) }));
      const unknown = selected.filter(x => !x.spec).map(x => x.file.name);
      if (unknown.length) { status.textContent = tx(lang, `Unrecognized: ${unknown.join(", ")}`, `无法识别：${unknown.join("、")}`); return; }
      e.target.querySelector("button").disabled = true;
      try {
        for (const { file, spec } of selected) {
          const objectPath = `${studentId}/resources/${spec.object}`;
          await resumableUpload(file, objectPath, pct => { status.textContent = `${spec.title}: ${pct}%`; });
          const { data: existing, error: findError } = await client.from("learning_resources").select("id").eq("bucket_path", objectPath).limit(1);
          if (findError) throw findError;
          if (!existing || !existing.length) {
            const { error: resourceError } = await client.from("learning_resources").insert({ student_id: studentId, title: spec.title, kind: spec.kind, subject: spec.subject, bucket_path: objectPath, file_name: file.name, mime_type: file.type || "application/pdf", size_bytes: file.size, uploaded_by: user.id });
            if (resourceError) throw resourceError;
          }
        }
        const qp = `${studentId}/resources/papers/chem_sl/2025_May_TZ1_P2/question-paper.pdf`;
        const ms = `${studentId}/resources/papers/chem_sl/2025_May_TZ1_P2/markscheme.pdf`;
        const { data: submitted } = await client.from("submission_files").select("bucket_path").eq("student_id", studentId).order("created_at", { ascending: false }).limit(1);
        const links = { question_file_path: qp, markscheme_file_path: ms, textbook_file_path: `${studentId}/resources/textbooks/chem_sl.pdf` };
        if (submitted && submitted[0]) links.answer_file_path = submitted[0].bucket_path;
        if (localSeed) {
          const attemptRows = localSeed.attempts.map(a => {
            const { review, ...record } = a;
            return { ...record, student_id: studentId };
          });
          const contentRows = Object.entries(localSeed.content).map(([id, c]) => {
            const attempt = localSeed.attempts.find(a => a.id === id);
            return { attempt_id: id, student_id: studentId, question_text: c.q || null, answer_text: c.ans || null, markscheme_text: c.ms || null,
              paper_key: c.paper || (attempt && attempt.source && attempt.source.paper) || null, qp_page: c.qp_page || null, ms_page: c.ms_page || null, ...links };
          });
          const aResult = await client.from("attempts").upsert(attemptRows, { onConflict: "id" });
          if (aResult.error) throw aResult.error;
          const cResult = await client.from("attempt_content").upsert(contentRows, { onConflict: "attempt_id" });
          if (cResult.error) throw cResult.error;
        } else {
          const { error: linkError } = await client.from("attempt_content").update(links).eq("student_id", studentId).eq("paper_key", "2025_May_TZ1_P2");
          if (linkError) throw linkError;
        }
        status.textContent = tx(lang, `Import complete: ${selected.length} files. Marked results are linked.`, `导入完成：${selected.length} 个文件，批改结果链接已建立。`);
        await syncData();
      } catch (error) { status.textContent = error.message; }
      finally { e.target.querySelector("button").disabled = false; }
    };
    const form = document.getElementById("resourceForm");
    if (form) form.onsubmit = async e => {
      e.preventDefault();
      const status = document.getElementById("resourceStatus"), file = document.getElementById("resourceFile").files[0];
      status.textContent = tx(lang, "Uploading…", "正在上传…");
      const path = `${studentId}/resources/${crypto.randomUUID()}-${safeName(file.name)}`;
      const { error: ue } = await client.storage.from(C.bucket).upload(path, file, { contentType: file.type || undefined });
      if (ue) { status.textContent = ue.message; return; }
      const { error: me } = await client.from("learning_resources").insert({ student_id: studentId, title: document.getElementById("resourceTitle").value.trim(), kind: document.getElementById("resourceKind").value, subject: document.getElementById("resourceSubject").value.trim() || null, bucket_path: path, file_name: file.name, mime_type: file.type || null, size_bytes: file.size, uploaded_by: user.id });
      if (me) { status.textContent = me.message; return; }
      await pageFiles(lang);
    };
  }

  function pageConnection(lang) {
    if (!configured || !user) return renderLogin(lang);
    document.getElementById("app").innerHTML = `<h2>${tx(lang, "China connection test", "中国大陆连接测试")}</h2><div class="card portal-form">
      <p>${tx(lang, "Run this on the student's usual Wi-Fi and mobile network before relying on the portal.", "请学生分别用平时的 Wi-Fi 和手机网络测试，再决定是否正式使用。")}</p>
      <button id="runConnectionTest" class="portal-primary">${tx(lang, "Run API and upload test", "测试 API 与上传")}</button>
      <div id="connectionResult" class="connection-result note"></div></div>`;
    document.getElementById("runConnectionTest").onclick = async e => {
      e.target.disabled = true;
      const out = document.getElementById("connectionResult");
      out.textContent = tx(lang, "Testing…", "正在测试…");
      const apiTimes = [];
      try {
        const session = (await client.auth.getSession()).data.session;
        for (let i = 0; i < 3; i++) {
          const start = performance.now();
          const r = await fetch(`${C.url}/rest/v1/profiles?select=id&limit=1`, { headers: { apikey: C.anonKey, Authorization: `Bearer ${session.access_token}` } });
          if (!r.ok) throw new Error(`API ${r.status}`);
          apiTimes.push(Math.round(performance.now() - start));
        }
        const path = `${user.id}/connectivity/${crypto.randomUUID()}.bin`;
        const blob = new Blob([new Uint8Array(256 * 1024)], { type: "application/octet-stream" });
        const upStart = performance.now();
        const { error: upError } = await client.storage.from(C.bucket).upload(path, blob);
        if (upError) throw upError;
        const uploadMs = Math.round(performance.now() - upStart);
        await client.storage.from(C.bucket).remove([path]);
        const pass = Math.max(...apiTimes) < 3000 && uploadMs < 15000;
        out.innerHTML = `<b class="${pass ? "test-pass" : "test-warn"}">${pass ? tx(lang, "PASS", "通过") : tx(lang, "UNSTABLE", "可能不稳定")}</b><br>API: ${apiTimes.join(" / ")} ms<br>256 KB upload: ${uploadMs} ms`;
      } catch (error) {
        out.innerHTML = `<b class="test-fail">${tx(lang, "FAILED", "失败")}</b><br>${html(error.message)}`;
      } finally { e.target.disabled = false; }
    };
  }

  function wirePrivateOpen(lang) {
    document.querySelectorAll(".js-open-private").forEach(btn => btn.onclick = async () => {
      // Open synchronously so the browser does not block the tab after the
      // asynchronous signed-URL request finishes.
      const popup = window.open("about:blank", "_blank");
      btn.disabled = true;
      const { data, error } = await client.storage.from(C.bucket).createSignedUrl(btn.dataset.path, 300);
      btn.disabled = false;
      if (error) {
        if (popup) popup.close();
        alert(error.message);
        return;
      }
      if (popup) {
        popup.opener = null;
        popup.location.replace(data.signedUrl + (btn.dataset.page ? `#page=${btn.dataset.page}` : ""));
      } else {
        location.href = data.signedUrl;
      }
    });
  }

  function resourceTarget(subject, kind, page) {
    const matches = resources.filter(r => r.subject === subject && r.kind === kind);
    if (kind === "textbook" && page) {
      for (const item of matches) {
        if (item.page_start && item.page_end && page >= Number(item.page_start) && page <= Number(item.page_end)) {
          return { path: item.bucket_path, page: page - Number(item.page_start) + 1 };
        }
        const range = String(item.file_name || "").match(/_p(\d+)-(\d+)\.pdf$/i);
        if (range && page >= Number(range[1]) && page <= Number(range[2])) {
          return { path: item.bucket_path, page: page - Number(range[1]) + 1 };
        }
      }
    }
    const item = matches.find(r => !/_p\d+-\d+\.pdf$/i.test(String(r.file_name || ""))) || matches[0];
    return item ? { path: item.bucket_path, page } : null;
  }

  const internal = { tx, html, safeName, resumableUpload, syncData, subjectOptions,
    get client() { return client; }, get user() { return user; }, get profile() { return profile; },
    get studentId() { return studentId; }, get resources() { return resources; }, get db() { return db; }, get config() { return C; } };

  return { configured, init, renderLogin, pageAccount, pageMigrate, reviewState, saveReview, pageSubmit, pageFiles, pageConnection, wirePrivateOpen, resourceTarget, _internal: internal,
    get active() { return configured && !!user; }, get role() { return profile && profile.role; }, get targetStudentId() { return studentId; } };
})();
