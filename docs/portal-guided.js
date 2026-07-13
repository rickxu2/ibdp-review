"use strict";

// Metadata-driven resource upload. Files are linked by explicit subject,
// resource key, role and page range; their original names are display-only.
(() => {
  const P = window.Portal;
  if (!P || !P._internal) return;
  const I = P._internal;

  P.pageFiles = async lang => {
    const { client, user, profile, studentId } = I;
    const tx = (en, zh) => I.tx(lang, en, zh);
    if (!P.configured || !user) return P.renderLogin(lang);
    if (!studentId) {
      document.getElementById("app").innerHTML = `<div class="card">${tx("No student is linked to this supervisor account yet.", "这个 supervisor 账号还没有关联学生。")}</div>`;
      return;
    }

    const [resourceResult, submissionResult] = await Promise.all([
      client.from("learning_resources").select("*").eq("student_id", studentId).order("created_at", { ascending: false }),
      client.from("submissions").select("*,submission_files(bucket_path,file_name)").eq("student_id", studentId).order("submitted_at", { ascending: false })
    ]);
    if (resourceResult.error || submissionResult.error) {
      const error = resourceResult.error || submissionResult.error;
      document.getElementById("app").innerHTML = `<div class="card">${I.html(error.message)}</div>`;
      return;
    }
    const resources = resourceResult.data || [], submissions = submissionResult.data || [];
    I.resources.splice(0, I.resources.length, ...resources);
    const subjects = `<option value="">—</option>${I.subjectOptions()}`;
    const submissionOptions = submissions.map(s => {
      const label = s.title || s.note || `${new Date(s.submitted_at).toLocaleString()} · ${(s.submission_files[0] || {}).file_name || "submission"}`;
      return `<option value="${I.html(s.id)}">${I.html(label)}</option>`;
    }).join("");

    const upload = profile.role === "supervisor" ? `
      <div class="card portal-form"><h3>${tx("1. Upload textbook set", "1. 上传课本分章")}</h3>
        <p>${tx("Choose a subject and select every PDF plus manifest.json from one split folder. The manifest supplies the original page ranges.", "选择科目，然后一次选中某个分章文件夹内的全部 PDF 和 manifest.json；原书页码范围由 manifest 自动提供。")}</p>
        <form id="guidedTextbookForm">
          <label>${tx("Subject", "科目")}<select id="guidedTextbookSubject" required>${subjects}</select></label>
          <label>${tx("Textbook title", "课本名称")}<input id="guidedTextbookTitle" required></label>
          <label>${tx("Folder files", "文件夹内容")}<input id="guidedTextbookFiles" type="file" accept=".pdf,.json" multiple required></label>
          <button class="portal-primary" type="submit">${tx("Upload textbook set", "上传整套分章")}</button>
        </form><div id="guidedTextbookStatus" class="note"></div>
      </div>
      <div class="card portal-form"><h3>${tx("2. Upload and link a paper", "2. 上传并关联试卷")}</h3>
        <p>${tx("Enter the paper identity here. The actual PDF file names can be anything.", "在这里填写试卷身份；PDF 本身可以使用任意文件名。")}</p>
        <form id="guidedPaperForm">
          <label>${tx("Subject", "科目")}<select id="guidedPaperSubject" required>${subjects}</select></label>
          <label>${tx("Paper key", "试卷编号")}<input id="guidedPaperKey" placeholder="2025_May_TZ1_P2" required></label>
          <label>${tx("Display title", "显示名称")}<input id="guidedPaperTitle" placeholder="Chemistry 2025 May TZ1 Paper 2" required></label>
          <label>${tx("Question paper (optional)", "空白试卷（可选）")}<input id="guidedQuestionFile" type="file" accept=".pdf,image/*"></label>
          <label>${tx("Markscheme (optional)", "Markscheme（可选）")}<input id="guidedMarkschemeFile" type="file" accept=".pdf,image/*"></label>
          <label>${tx("Student submission to bind (optional)", "对应学生提交（可选）")}<select id="guidedSubmission"><option value="">—</option>${submissionOptions}</select></label>
          <button class="portal-primary" type="submit">${tx("Upload and link", "上传并关联")}</button>
        </form><div id="guidedPaperStatus" class="note"></div>
      </div>` : "";

    const list = resources.length ? resources.map(r => `<div class="portal-row"><div><b>${I.html(r.title)}</b><div class="note">${I.html(r.kind)}${r.subject ? " · " + I.html(r.subject) : ""}${r.resource_key ? " · " + I.html(r.resource_key) : ""}${r.page_start ? ` · pp. ${r.page_start}–${r.page_end}` : ""}</div></div><button class="mini-btn js-open-private" data-path="${I.html(r.bucket_path)}">${tx("Open", "打开")}</button></div>`).join("") : `<div class="empty">${tx("No resources uploaded yet.", "还没有上传资料。")}</div>`;
    document.getElementById("app").innerHTML = `<h2>${tx("Private resources", "私密资料库")}</h2><div class="note">${tx("Resources are linked by metadata, never by their file names.", "资料通过科目、试卷编号和提交记录关联，不再依赖文件名。")}</div>${upload}<div class="card resource-list">${list}</div>`;
    P.wirePrivateOpen(lang);

    const storeResource = async (file, meta, objectPath, progress) => {
      const { data: existing, error: findError } = await client.from("learning_resources").select("id").eq("bucket_path", objectPath).limit(1);
      if (findError) throw findError;
      const row = { student_id: studentId, bucket_path: objectPath, file_name: file.name, mime_type: file.type || "application/pdf", size_bytes: file.size, uploaded_by: user.id, ...meta };
      if (existing && existing.length) {
        const { error } = await client.from("learning_resources").update(row).eq("id", existing[0].id);
        if (error) throw error;
        progress(100);
      } else {
        await I.resumableUpload(file, objectPath, progress);
        const { error } = await client.from("learning_resources").insert(row);
        if (error) throw error;
      }
      return objectPath;
    };

    const textbookForm = document.getElementById("guidedTextbookForm");
    if (textbookForm) textbookForm.onsubmit = async event => {
      event.preventDefault();
      const button = event.target.querySelector("button"), status = document.getElementById("guidedTextbookStatus");
      const chosen = [...document.getElementById("guidedTextbookFiles").files], manifestFile = chosen.find(f => f.name.toLowerCase() === "manifest.json");
      if (!manifestFile) { status.textContent = tx("Select manifest.json together with the PDFs.", "请把 manifest.json 与全部 PDF 一起选中。"); return; }
      button.disabled = true;
      try {
        const manifest = JSON.parse(await manifestFile.text()), entries = manifest.files || [];
        const pdfs = new Map(chosen.filter(f => f.name.toLowerCase().endsWith(".pdf")).map(f => [f.name, f]));
        const missing = entries.filter(item => !pdfs.has(item.file)).map(item => item.file);
        if (!entries.length || missing.length) throw new Error(missing.length ? `Missing: ${missing.join(", ")}` : "Manifest contains no files.");
        const subject = document.getElementById("guidedTextbookSubject").value, title = document.getElementById("guidedTextbookTitle").value.trim();
        for (let index = 0; index < entries.length; index++) {
          const item = entries[index], file = pdfs.get(item.file), objectPath = `${studentId}/resources/textbooks/${subject}/${I.safeName(item.file)}`;
          await storeResource(file, { title: `${title} pp. ${item.page_start}–${item.page_end}`, kind: "textbook", subject, resource_key: `textbook:${subject}`, file_role: "textbook_part", page_start: item.page_start, page_end: item.page_end }, objectPath,
            percent => { status.textContent = `${index + 1}/${entries.length} · ${file.name}: ${percent}%`; });
        }
        await I.syncData();
        status.textContent = tx(`Textbook set uploaded: ${entries.length} parts.`, `课本上传完成：${entries.length} 个分章。`);
      } catch (error) { status.textContent = error.message; }
      finally { button.disabled = false; }
    };

    const paperForm = document.getElementById("guidedPaperForm");
    if (paperForm) paperForm.onsubmit = async event => {
      event.preventDefault();
      const button = event.target.querySelector("button"), status = document.getElementById("guidedPaperStatus");
      const qpFile = document.getElementById("guidedQuestionFile").files[0], msFile = document.getElementById("guidedMarkschemeFile").files[0];
      if (!qpFile && !msFile) { status.textContent = tx("Choose a question paper or markscheme.", "请至少选择空白试卷或 markscheme 之一。"); return; }
      button.disabled = true;
      try {
        const subject = document.getElementById("guidedPaperSubject").value, key = document.getElementById("guidedPaperKey").value.trim(), title = document.getElementById("guidedPaperTitle").value.trim();
        const base = `${studentId}/resources/papers/${subject}/${I.safeName(key)}`, links = {};
        if (qpFile) links.question_file_path = await storeResource(qpFile, { title, kind: "question_paper", subject, resource_key: key, file_role: "question_paper" }, `${base}/question-paper.pdf`, p => { status.textContent = `Question paper: ${p}%`; });
        if (msFile) links.markscheme_file_path = await storeResource(msFile, { title: `${title} Markscheme`, kind: "markscheme", subject, resource_key: key, file_role: "markscheme" }, `${base}/markscheme.pdf`, p => { status.textContent = `Markscheme: ${p}%`; });
        const submissionId = document.getElementById("guidedSubmission").value;
        if (submissionId) {
          const submission = submissions.find(s => s.id === submissionId), answer = submission && submission.submission_files[0];
          if (answer) {
            links.answer_file_path = answer.bucket_path;
            if (!links.question_file_path) links.question_file_path = answer.bucket_path;
          }
          links.submission_id = submissionId;
          const { error } = await client.from("submissions").update({ subject, resource_key: key }).eq("id", submissionId).eq("student_id", studentId);
          if (error) throw error;
        }
        const { error } = await client.from("attempt_content").update(links).eq("student_id", studentId).eq("paper_key", key);
        if (error) throw error;
        await I.syncData();
        status.textContent = tx("Paper uploaded and linked by metadata.", "试卷资料已按元数据上传并关联。");
      } catch (error) { status.textContent = error.message; }
      finally { button.disabled = false; }
    };
  };
})();
