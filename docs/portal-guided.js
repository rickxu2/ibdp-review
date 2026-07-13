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
    const yearOptions = Array.from({ length: 12 }, (_, index) => new Date().getFullYear() + 1 - index)
      .map(year => `<option value="${year}" ${year === 2025 ? "selected" : ""}>${year}</option>`).join("");
    const submissionOptions = submissions.map(s => {
      const label = s.title || s.note || `${new Date(s.submitted_at).toLocaleString()} · ${(s.submission_files[0] || {}).file_name || "submission"}`;
      return `<option value="${I.html(s.id)}">${I.html(label)}</option>`;
    }).join("");

    const upload = profile.role === "supervisor" ? `
      <details class="card portal-form upload-panel"><summary><b>${tx("Upload textbook set", "上传课本分章")}</b></summary>
        <p>${tx("Choose a subject and select every PDF plus manifest.json from one split folder. The manifest supplies the original page ranges.", "选择科目，然后一次选中某个分章文件夹内的全部 PDF 和 manifest.json；原书页码范围由 manifest 自动提供。")}</p>
        <form id="guidedTextbookForm">
          <label>${tx("Subject", "科目")}<select id="guidedTextbookSubject" required>${subjects}</select></label>
          <label>${tx("Textbook title", "课本名称")}<input id="guidedTextbookTitle" required></label>
          <label>${tx("Folder files", "文件夹内容")}<input id="guidedTextbookFiles" type="file" accept=".pdf,.json" multiple required></label>
          <button class="portal-primary" type="submit">${tx("Upload textbook set", "上传整套分章")}</button>
        </form><div id="guidedTextbookStatus" class="note"></div>
      </details>
      <details class="card portal-form upload-panel"><summary><b>${tx("Upload and link a paper", "上传并关联试卷")}</b></summary>
        <p>${tx("Enter the paper identity here. The actual PDF file names can be anything.", "在这里填写试卷身份；PDF 本身可以使用任意文件名。")}</p>
        <form id="guidedPaperForm">
          <label>${tx("Subject", "科目")}<select id="guidedPaperSubject" required>${subjects}</select></label>
          <label>${tx("Year", "年份")}<select id="guidedPaperYear">${yearOptions}</select></label>
          <label>${tx("Session", "考季")}<select id="guidedPaperSession"><option value="May">May</option><option value="Nov">November</option></select></label>
          <label>${tx("Timezone", "时区")}<select id="guidedPaperTimezone"><option value="TZ0">TZ0</option><option value="TZ1" selected>TZ1</option><option value="TZ2">TZ2</option><option value="TZ3">TZ3</option></select></label>
          <label>${tx("Component", "试卷")}<select id="guidedPaperComponent"><option value="P1">Paper 1</option><option value="P1A">Paper 1A</option><option value="P1B">Paper 1B</option><option value="P2" selected>Paper 2</option><option value="P3">Paper 3</option></select></label>
          <div class="note">${tx("Paper key", "试卷编号")}: <b id="guidedPaperKeyPreview">—</b><br>${tx("Display title", "显示名称")}: <span id="guidedPaperTitlePreview">—</span></div>
          <label>${tx("Question booklet (optional)", "Question booklet / 题册（可选）")}<input id="guidedQuestionFile" type="file" accept=".pdf,image/*"></label>
          <label>${tx("Text/source booklet(s) (optional)", "Text/source booklet / 文本或材料册（可多选）")}<input id="guidedSourceFiles" type="file" accept=".pdf,image/*" multiple></label>
          <label>${tx("Markscheme (optional)", "Markscheme（可选）")}<input id="guidedMarkschemeFile" type="file" accept=".pdf,image/*"></label>
          <label>${tx("Student submission to bind (optional)", "对应学生提交（可选）")}<select id="guidedSubmission"><option value="">—</option>${submissionOptions}</select></label>
          <button class="portal-primary" type="submit">${tx("Upload and link", "上传并关联")}</button>
        </form><div id="guidedPaperStatus" class="note"></div>
      </details>` : "";

    const openButton = (path, label) => `<button class="mini-btn js-open-private" data-path="${I.html(path)}">${I.html(label)}</button>`;
    const subjectName = id => (I.db.meta.subjects[id] || {}).name || id || tx("Other", "其他");
    const subjectIds = [...new Set([
      ...resources.map(r => r.subject || ""),
      ...submissions.map(s => s.subject || "")
    ])].sort((a, b) => subjectName(a).localeCompare(subjectName(b)));
    const renderSubject = subject => {
      const subjectResources = resources.filter(r => (r.subject || "") === subject);
      const subjectSubmissions = submissions.filter(s => (s.subject || "") === subject);
      const textbookGroups = new Map();
      for (const r of subjectResources.filter(r => r.kind === "textbook")) {
        const key = r.resource_key || `textbook:${subject}`;
        if (!textbookGroups.has(key)) textbookGroups.set(key, []);
        textbookGroups.get(key).push(r);
      }
      const textbooks = [...textbookGroups.entries()].map(([key, parts]) => {
        parts.sort((a, b) => Number(a.page_start || 0) - Number(b.page_start || 0));
        const starts = parts.map(p => Number(p.page_start)).filter(Boolean), ends = parts.map(p => Number(p.page_end)).filter(Boolean);
        const pageSummary = starts.length ? ` · pp. ${Math.min(...starts)}–${Math.max(...ends)}` : "";
        const baseTitle = String(parts[0].title || tx("Textbook", "课本")).replace(/\s+pp\.\s*\d+[–-]\d+$/i, "");
        return `<details class="resource-group"><summary><b>${I.html(baseTitle)}</b><span>${parts.length} ${tx("sections", "个章节")}${pageSummary}</span></summary><div class="resource-group-body">${parts.map(part => `<div class="portal-row"><div><b>${I.html(part.title)}</b><div class="note">${part.page_start ? `pp. ${part.page_start}–${part.page_end}` : I.html(part.file_name)}</div></div>${openButton(part.bucket_path, tx("Open section", "打开章节"))}</div>`).join("")}</div></details>`;
      }).join("");

      const paperResources = subjectResources.filter(r => r.kind !== "textbook" && r.resource_key);
      const paperKeys = [...new Set([...paperResources.map(r => r.resource_key), ...subjectSubmissions.map(s => s.resource_key).filter(Boolean)])].sort().reverse();
      const papers = paperKeys.map(key => {
        const files = paperResources.filter(r => r.resource_key === key), matched = subjectSubmissions.filter(s => s.resource_key === key);
        const first = files.find(r => r.file_role === "question_booklet" || r.file_role === "question_paper") || files.find(r => r.kind !== "markscheme") || files[0];
        const title = first ? String(first.title).replace(/\s+(Question booklet|Markscheme|Text\/source booklet(?:\s+\d+)?)$/i, "") : key;
        const resourceRows = files.map((r, index) => {
          const role = r.kind === "markscheme" ? "Markscheme" : r.file_role === "source_booklet" ? `${tx("Text/source booklet", "文本/材料册")}${files.filter(x => x.file_role === "source_booklet").length > 1 ? ` ${index + 1}` : ""}` : tx("Question booklet", "题册");
          return `<div class="portal-row"><div><b>${I.html(role)}</b><div class="note">${I.html(r.file_name)}</div></div>${openButton(r.bucket_path, tx("Open", "打开"))}</div>`;
        }).join("");
        const answerRows = matched.flatMap(s => (s.submission_files || []).map(f => `<div class="portal-row submission-resource"><div><b>${tx("Student answer", "学生答卷")}</b><div class="note">${I.html(s.title || new Date(s.submitted_at).toLocaleString())} · ${I.html(f.file_name)}</div></div>${openButton(f.bucket_path, tx("Open answer", "打开答卷"))}</div>`)).join("");
        return `<details class="resource-group paper-group"><summary><b>${I.html(title)}</b><span>${I.html(key)} · ${files.length} ${tx("resources", "份资料")} · ${matched.length} ${tx("submissions", "份提交")}</span></summary><div class="resource-group-body">${resourceRows}${answerRows || `<div class="note resource-missing">${tx("No student answer matched yet.", "尚未匹配学生答卷。")}</div>`}</div></details>`;
      }).join("");

      const unmatchedResources = subjectResources.filter(r => r.kind !== "textbook" && !r.resource_key);
      const unmatchedSubmissions = subjectSubmissions.filter(s => !s.resource_key);
      const unmatched = [...unmatchedResources.map(r => `<div class="portal-row"><div><b>${I.html(r.title)}</b><div class="note">${I.html(r.kind)} · ${I.html(r.file_name)}</div></div>${openButton(r.bucket_path, tx("Open", "打开"))}</div>`),
        ...unmatchedSubmissions.flatMap(s => (s.submission_files || []).map(f => `<div class="portal-row"><div><b>${tx("Unmatched student submission", "未匹配的学生提交")}</b><div class="note">${I.html(s.title || s.note || "")} · ${I.html(f.file_name)}</div></div>${openButton(f.bucket_path, tx("Open", "打开"))}</div>`))].join("");
      return `<section class="card resource-subject"><h3>${I.html(subjectName(subject))}</h3>${textbooks ? `<div class="resource-category"><h4>${tx("Textbooks", "课本")}</h4>${textbooks}</div>` : ""}${papers ? `<div class="resource-category"><h4>${tx("Papers and submissions", "试卷与学生提交")}</h4>${papers}</div>` : ""}${unmatched ? `<details class="resource-group unmatched-group"><summary><b>${tx("Unmatched resources", "未匹配资料")}</b><span>${unmatchedResources.length + unmatchedSubmissions.length}</span></summary><div class="resource-group-body">${unmatched}</div></details>` : ""}</section>`;
    };
    const list = subjectIds.length ? `<div class="resource-groups">${subjectIds.map(renderSubject).join("")}</div>` : `<div class="empty">${tx("No resources uploaded yet.", "还没有上传资料。")}</div>`;
    document.getElementById("app").innerHTML = `<h2>${tx("Private resources", "私密资料库")}</h2><div class="note">${tx("Resources are grouped by subject, textbook and paper. Files are linked by metadata, never by their names.", "资料按科目、课本和试卷分组；关联依靠元数据，不依赖文件名。")}</div>${list}${upload}`;
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
    if (paperForm) {
      const paperIdentity = () => {
        const subjectSelect = document.getElementById("guidedPaperSubject"), subject = subjectSelect.value;
        const subjectName = subject ? subjectSelect.options[subjectSelect.selectedIndex].text : "—";
        const year = document.getElementById("guidedPaperYear").value, session = document.getElementById("guidedPaperSession").value;
        const timezone = document.getElementById("guidedPaperTimezone").value, component = document.getElementById("guidedPaperComponent").value;
        return { subject, key: `${year}_${session}_${timezone}_${component}`, title: `${subjectName} ${year} ${session} ${timezone} ${component}` };
      };
      const updatePaperPreview = () => {
        const identity = paperIdentity();
        document.getElementById("guidedPaperKeyPreview").textContent = identity.key;
        document.getElementById("guidedPaperTitlePreview").textContent = identity.title;
      };
      ["guidedPaperSubject", "guidedPaperYear", "guidedPaperSession", "guidedPaperTimezone", "guidedPaperComponent"].forEach(id => {
        document.getElementById(id).onchange = updatePaperPreview;
      });
      updatePaperPreview();
      paperForm.onsubmit = async event => {
      event.preventDefault();
      const button = event.target.querySelector("button"), status = document.getElementById("guidedPaperStatus");
      const qpFile = document.getElementById("guidedQuestionFile").files[0], sourceFiles = [...document.getElementById("guidedSourceFiles").files], msFile = document.getElementById("guidedMarkschemeFile").files[0];
      if (!qpFile && !sourceFiles.length && !msFile) { status.textContent = tx("Choose at least one booklet or markscheme.", "请至少选择一个题册、材料册或 markscheme。"); return; }
      button.disabled = true;
      try {
        const { subject, key, title } = paperIdentity();
        const base = `${studentId}/resources/papers/${subject}/${I.safeName(key)}`, links = {};
        if (qpFile) links.question_file_path = await storeResource(qpFile, { title: `${title} Question booklet`, kind: "question_paper", subject, resource_key: key, file_role: "question_booklet" }, `${base}/question-booklet.pdf`, p => { status.textContent = `Question booklet: ${p}%`; });
        if (sourceFiles.length) {
          links.supporting_file_paths = [];
          for (let index = 0; index < sourceFiles.length; index++) {
            const sourceFile = sourceFiles[index], sourceTitle = `${title} Text/source booklet${sourceFiles.length > 1 ? ` ${index + 1}` : ""}`;
            const sourcePath = await storeResource(sourceFile, { title: sourceTitle, kind: "question_paper", subject, resource_key: key, file_role: "source_booklet" }, `${base}/source-booklet-${index + 1}.pdf`, p => { status.textContent = `Text/source booklet ${index + 1}: ${p}%`; });
            links.supporting_file_paths.push({ path: sourcePath, title: sourceTitle, role: "source_booklet" });
          }
        }
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
    }
  };
})();
