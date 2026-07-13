"use strict";

window.Portal = (() => {
  const C = window.IBDP_SUPABASE || {};
  const configured = !!(C.url && C.anonKey && window.supabase);
  let client = null, user = null, profile = null, studentId = null, db = null;
  const resources = [];
  const tx = (lang, en, zh) => lang === "zh" ? zh : en;
  const html = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const safeName = name => name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-100);

  async function init(targetDb) {
    db = targetDb;
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
    const [ar, cr, rr] = await Promise.all([
      client.from("attempts").select("*").eq("student_id", studentId).order("date").order("id"),
      client.from("attempt_content").select("*").eq("student_id", studentId),
      client.from("review_progress").select("*").eq("student_id", studentId)
    ]);
    if (ar.error) throw ar.error;
    if (cr.error) throw cr.error;
    if (rr.error) throw rr.error;
    db.attempts = (ar.data || []).map(a => ({ ...a, review: null }));
    for (const c of cr.data || []) db.content[c.attempt_id] = {
      q: c.question_text, ans: c.answer_text, ms: c.markscheme_text,
      paper: c.paper_key, qp_page: c.qp_page, ms_page: c.ms_page,
      qp_file: c.question_file_path, ms_file: c.markscheme_file_path
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
      <details class="magic-link"><summary>${tx(lang, "First sign-in or forgot password?", "首次登录或忘记密码？")}</summary>
        <p class="note">${tx(lang, "Email links are for account setup and recovery only; the built-in mail service is rate-limited.", "邮件链接只用于开户和找回密码；内置邮件服务有严格限流。")}</p>
        <button type="button" id="magicLinkBtn" class="mini-btn">${tx(lang, "Send one-time email link", "发送一次性邮件链接")}</button>
      </details>
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
    document.getElementById("magicLinkBtn").onclick = async () => {
      const status = document.getElementById("loginStatus");
      const email = document.getElementById("loginEmail").value.trim();
      if (!email) { status.textContent = tx(lang, "Enter your email first.", "请先填写邮箱。"); return; }
      status.textContent = tx(lang, "Sending…", "正在发送…");
      const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: false } });
      status.textContent = error ? error.message : tx(lang, "Check your email for the one-time link.", "一次性链接已发送，请检查邮箱。");
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
      <div class="card portal-form"><p>${tx(lang, "Upload clear photos or a PDF. Your supervisor will receive them for marking.", "上传清晰照片或 PDF，supervisor 会收到并批改。")}</p><p class="note"><a href="#/connection">${tx(lang, "Test connection from China", "测试中国大陆连接")}</a></p>
      <form id="submitWork"><label>${tx(lang, "Files", "文件")}<input id="workFiles" type="file" accept="image/*,.pdf" multiple required></label>
      <label>${tx(lang, "Note (optional)", "备注（可选）")}<textarea id="workNote" rows="3" placeholder="${tx(lang, "Subject, paper and question numbers", "科目、试卷和题号")}"></textarea></label>
      <button type="submit" class="portal-primary">${tx(lang, "Upload submission", "上传提交")}</button></form><div id="submitStatus" class="note"></div></div>`;
    document.getElementById("submitWork").onsubmit = async e => {
      e.preventDefault();
      const status = document.getElementById("submitStatus");
      const files = [...document.getElementById("workFiles").files];
      status.textContent = tx(lang, "Uploading…", "正在上传…");
      const submissionId = crypto.randomUUID();
      const { error: se } = await client.from("submissions").insert({ id: submissionId, student_id: user.id, note: document.getElementById("workNote").value.trim() || null });
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
    const { data, error } = await client.from("submissions").select("id,note,status,submitted_at,submission_files(file_name,bucket_path)").eq("student_id", studentId).order("submitted_at", { ascending: false });
    if (error) { document.getElementById("app").innerHTML = `<div class="card">${html(error.message)}</div>`; return; }
    document.getElementById("app").innerHTML = `<h2>${tx(lang, "Submission inbox", "提交收件箱")}</h2><div class="card">${(data || []).length ? data.map(s => `<div class="portal-row"><div><b>${new Date(s.submitted_at).toLocaleString()}</b><div class="note">${html(s.note || "")}</div></div><span class="chip">${html(s.status)}</span><div>${(s.submission_files || []).map(f => `<button class="mini-btn js-open-private" data-path="${html(f.bucket_path)}">${html(f.file_name)}</button>`).join(" ")}</div></div>`).join("") : `<div class="empty">${tx(lang, "No submissions yet.", "还没有提交。")}</div>`}</div>`;
    wirePrivateOpen(lang);
  }

  async function pageFiles(lang) {
    if (!configured || !user) return renderLogin(lang);
    if (!studentId) { document.getElementById("app").innerHTML = `<div class="card">${tx(lang, "No student is linked to this supervisor account yet.", "这个 supervisor 账号还没有关联学生。")}</div>`; return; }
    const { data, error } = await client.from("learning_resources").select("*").eq("student_id", studentId).order("created_at", { ascending: false });
    if (error) { document.getElementById("app").innerHTML = `<div class="card">${html(error.message)}</div>`; return; }
    resources.splice(0, resources.length, ...(data || []));
    let upload = "";
    if (profile.role === "supervisor") upload = `<div class="card portal-form"><h3>${tx(lang, "Add protected resource", "添加受保护资料")}</h3><form id="resourceForm">
      <label>${tx(lang, "Title", "标题")}<input id="resourceTitle" required></label>
      <label>${tx(lang, "Type", "类型")}<select id="resourceKind"><option value="question_paper">Question paper</option><option value="markscheme">Markscheme</option><option value="textbook">Textbook</option><option value="other">Other</option></select></label>
      <label>${tx(lang, "Subject", "科目")}<input id="resourceSubject"></label><label>${tx(lang, "File", "文件")}<input id="resourceFile" type="file" accept=".pdf,image/*" required></label>
      <button class="portal-primary" type="submit">${tx(lang, "Upload privately", "私密上传")}</button></form><div id="resourceStatus" class="note"></div></div>`;
    document.getElementById("app").innerHTML = `<h2>${tx(lang, "Private resources", "私密资料库")}</h2>${upload}<div class="card resource-list">${resources.length ? resources.map(r => `<div class="portal-row"><div><b>${html(r.title)}</b><div class="note">${html(r.kind)}${r.subject ? " · " + html(r.subject) : ""}</div></div><button class="mini-btn js-open-private" data-path="${html(r.bucket_path)}">${tx(lang, "Open", "打开")}</button></div>`).join("") : `<div class="empty">${tx(lang, "No resources uploaded yet.", "还没有上传资料。")}</div>`}</div>`;
    wirePrivateOpen(lang);
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
      btn.disabled = true;
      const { data, error } = await client.storage.from(C.bucket).createSignedUrl(btn.dataset.path, 300);
      btn.disabled = false;
      if (error) { alert(error.message); return; }
      window.open(data.signedUrl, "_blank", "noopener");
    });
  }

  return { configured, init, renderLogin, pageAccount, reviewState, saveReview, pageSubmit, pageFiles, pageConnection,
    get active() { return configured && !!user; }, get role() { return profile && profile.role; }, get targetStudentId() { return studentId; } };
})();
