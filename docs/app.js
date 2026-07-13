/* IBDP Review — zero-build static site. Data: data/*.json (maintained by Claude; raw records are the single source of truth)
   All aggregates (mastery/curves) are computed here at runtime, never stored. */
"use strict";

/* ───────── i18n ───────── */
const L = {
  en: {
    nav_home: "Overview", nav_matrix: "Topics", nav_review: "Review", nav_files: "Resources", nav_submit: "Submit", nav_days: "Daily log",
    today: "Today",
    mock_label: "Mock exams (predicted grades)", final_label: "Final exams · May 2027",
    days: "days", approx: "approx.",
    review_label: "Reviews due", due_n: "due", overdue_n: n => `${n} overdue`, no_overdue: "none overdue",
    records_label: "Total records", q_unit: "questions", weighted: "Weighted score",
    chart_title: "Mastery mix over time",
    chart_note: (p, h, n) => `Mastered = marks-weighted accuracy ≥ ${p}% (with ${h}-day half-life decay) plus ≥ ${n} full-mark attempts. One correct answer is never enough. Review ratings never affect mastery; only marked exam and assignment attempts do.`,
    chart_status: (mastered, practiced) => `Current: ${mastered} mastered · ${practiced} practiced`,
    mastered_unit: "mastered",
    subjects_title: "Subjects", score_rate: "score", view_matrix: "View topic matrix →",
    pending: list => `Not yet onboarded: ${list} (ask Claude to build the topic tree when needed)`,
    due_title: "Due for review", overdue_chip: "overdue ", start_review: "Start review →",
    no_data: "No attempts yet. Hand today's completed questions to Claude for marking (/mark) — this page comes alive with the first records.",
    matrix_title: "Topic mastery",
    st_mastered: "Mastered", st_ok: "OK", st_weak: "Weak", st_unpracticed: "Unpracticed", st_not_covered: "Not covered", st_regressed: "Regressed",
    times: "×", full_marks_n: (x, n) => `${x}/${n} full-mark evidence`, never_practiced: "No attempts on this point yet",
    days_title: "Daily log", all_correct: "all correct ✓", lost_on: n => `${n} with lost marks`,
    back_all: "← All days", q_count: "questions",
    v_correct: "✓ Full marks", v_partial: "Partial", v_wrong: "✗ Wrong", uncertain: "Marks in dispute",
    review_prog: (s, d) => `Review ${s}/5 · next ${d}`, review_done: "✅ Review complete (5 passes)",
    tb_hint: "Open the local site (scripts/serve.ps1) or add a cloud_url to open the book online",
    open_cloud: "open in cloud",
    no_day: d => `No records on ${d}`, no_records: "No attempts recorded yet",
    empty_chart: "Mastery history will appear after the first attempt.",
    foot_local: "Local full version (textbook links active)", foot_online: "Online version",
    foot_records: "records", foot_last: "last attempt",
    loading: "Loading…",
    load_fail: "Failed to load data:",
    load_help: `• Locally: run <code>scripts\\serve.ps1</code> then open <a href="http://localhost:8788/docs/">http://localhost:8788/docs/</a> (opening index.html directly cannot fetch data)<br>• Or visit the GitHub Pages site`,
    err_concept: "Concept", err_calculation: "Calculation", err_misread: "Misread", err_expression: "Expression", err_time: "Time management",
    reveal_review: "Reveal question, answer & markscheme", collapse: "Collapse",
    lbl_question: "Question", lbl_your_answer: "Your answer", lbl_markscheme: "Markscheme", lbl_analysis: "Why / how to fix",
    content_local_only: "Question & markscheme are in the local version (run scripts/serve.ps1).",
    open_qp: "Question booklet ↗", open_source: "Text/source booklet ↗", open_ms: "Markscheme ↗",
    open_answer: "Submitted answer ↗", open_textbook: "Textbook ↗",
    mark_reviewed: "Mark reviewed", reviewed_on: d => `Reviewed ${d}`, review_gate: "Reveal the answer & markscheme first",
    quick_review_note: "Quick check only — use the Review page for scheduled spaced repetition.",
    edit_mark: "Edit grade", save_edit: "Copy correction", copied: "Copied — paste it to Claude to apply",
    fld_earned: "Marks earned", fld_verdict: "Verdict", fld_errtype: "Error type", cancel: "Cancel",
    review_title: "Spaced review", review_intro: "Answer from memory first. Reveal the answer only when you have committed to a response.",
    review_remaining: n => `${n} due`, review_none: "Nothing is due today.", review_next: d => `Next review: ${d}`,
    review_show_answer: "Reveal answer & markscheme", review_rate: "How did recall feel?",
    review_again: "Again", review_hard: "Hard", review_good: "Good", review_saved: "Progress saved on this device.",
    review_private_missing: "This review item contains protected question material. It is not available on the public site; the private student portal is required.",
    review_device_note: "Signed-in students sync review progress to their private account. Without sign-in, progress stays in this browser only."
  },
  zh: {
    nav_home: "总览", nav_matrix: "知识点", nav_review: "复习", nav_files: "资料库", nav_submit: "提交", nav_days: "每日记录",
    today: "今日",
    mock_label: "距模考（定预估分）", final_label: "距 May 2027 大考",
    days: "天", approx: "约",
    review_label: "错题复习", due_n: "道到期", overdue_n: n => `其中逾期 ${n} 道`, no_overdue: "无逾期",
    records_label: "累计记录", q_unit: "题", weighted: "加权得分率",
    chart_title: "各科掌握度构成走势",
    chart_note: (p, h, n) => `掌握 = 按分值加权正确率 ≥ ${p}%（含 ${h} 天半衰期时间衰减）且至少 ${n} 次拿满分。只对 1 次绝不会算掌握。复习评分不影响掌握度；只有正式批改入库的考卷和作业答题记录才计入。`,
    chart_status: (mastered, practiced) => `当前：${mastered} 个已掌握 · ${practiced} 个已练习`,
    mastered_unit: "个已掌握",
    subjects_title: "各科概况", score_rate: "得分率", view_matrix: "查看知识点矩阵 →",
    pending: list => `待接入：${list}（有需要时让 Claude 建对应知识点树）`,
    due_title: "到期复习", overdue_chip: "逾期 ", start_review: "开始复习 →",
    no_data: "还没有做题数据。把今天完成的题目交给 Claude 批改（/mark），第一批数据入库后这里就会活起来。",
    matrix_title: "知识点掌握度",
    st_mastered: "掌握", st_ok: "一般", st_weak: "薄弱", st_unpracticed: "未练", st_not_covered: "未学", st_regressed: "回潮",
    times: "次", full_marks_n: (x, n) => `${x}/${n} 次满分证据`, never_practiced: "还没做过这个考点的题",
    days_title: "每日记录", all_correct: "全对 ✓", lost_on: n => `失分 ${n} 题`,
    back_all: "← 全部日期", q_count: "题",
    v_correct: "✓ 全对", v_partial: "部分", v_wrong: "✗ 错", uncertain: "给分待议",
    review_prog: (s, d) => `复习进度 ${s}/5 · 下次 ${d}`, review_done: "✅ 复习毕业（5 轮通过）",
    tb_hint: "本地站可直达 PDF（scripts/serve.ps1）；或在 textbook_map 配 cloud_url 在线打开",
    open_cloud: "云端打开",
    no_day: d => `${d} 没有记录`, no_records: "还没有做题记录",
    empty_chart: "第一次做题后会显示掌握度历史。",
    foot_local: "本地完整版（课本可跳转）", foot_online: "公网版",
    foot_records: "条记录", foot_last: "最近做题",
    loading: "加载数据中…",
    load_fail: "数据加载失败：",
    load_help: `• 本地查看：运行 <code>scripts\\serve.ps1</code> 后打开 <a href="http://localhost:8788/docs/">http://localhost:8788/docs/</a>（直接双击 index.html 读不到数据）<br>• 或访问 GitHub Pages 线上版`,
    err_concept: "概念", err_calculation: "计算", err_misread: "审题", err_expression: "表达", err_time: "时间",
    reveal_review: "展开题目、答案与评分标准", collapse: "收起",
    lbl_question: "题目", lbl_your_answer: "你的答案", lbl_markscheme: "评分标准 (markscheme)", lbl_analysis: "错因与订正",
    content_local_only: "题目与 markscheme 仅本地版可见（运行 scripts/serve.ps1）。",
    open_qp: "打开题册 ↗", open_source: "打开文本/材料册 ↗", open_ms: "打开评分标准 ↗",
    open_answer: "打开提交答案 ↗", open_textbook: "打开课本 ↗",
    mark_reviewed: "标记已复习", reviewed_on: d => `已复习 ${d}`, review_gate: "先展开看到答案与评分标准",
    quick_review_note: "这里只做快速自查；定时的间隔复习请进入“复习”页。",
    edit_mark: "编辑批改", save_edit: "复制订正", copied: "已复制——粘贴给 Claude 即可应用",
    fld_earned: "得分", fld_verdict: "判定", fld_errtype: "错误类型", cancel: "取消",
    review_title: "间隔复习", review_intro: "先凭记忆作答，确定答案后再展开评分标准。",
    review_remaining: n => `今天到期 ${n} 道`, review_none: "今天没有到期复习。", review_next: d => `下次复习：${d}`,
    review_show_answer: "展开答案与评分标准", review_rate: "这次回忆得怎么样？",
    review_again: "不会", review_hard: "吃力", review_good: "掌握", review_saved: "进度已保存在这台设备。",
    review_private_missing: "这道复习题含受版权保护的题目内容，公网版不提供；需要迁移到学生私密门户后才能在线复习。",
    review_device_note: "学生登录后，复习进度会同步到私密账号；未登录时才只保存在当前浏览器。"
  }
};
let LANG = localStorage.getItem("ibdp-lang") || "en";
const t = k => { const v = L[LANG][k] ?? L.en[k] ?? k; return v; };
const errTxt = e => e ? (t("err_" + e) !== "err_" + e ? t("err_" + e) : e) : "";

/* ───────── utils ───────── */
const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtPct = x => (x == null || isNaN(x)) ? "–" : Math.round(x * 100) + "%";
let STUDENT_TIME_ZONE = "Asia/Shanghai";
const dateInTimeZone = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const value = type => parts.find(p => p.type === type).value;
  return `${value("year")}-${value("month")}-${value("day")}`;
};
const todayStr = () => {
  const override = new URLSearchParams(location.search).get("today");
  if (["localhost", "127.0.0.1"].includes(location.hostname) && /^\d{4}-\d{2}-\d{2}$/.test(override || "")) return override;
  return dateInTimeZone(new Date(), STUDENT_TIME_ZONE);
};
const dayDiff = (a, b) => Math.round((new Date(a + "T00:00") - new Date(b + "T00:00")) / 864e5);
const IS_LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);

/* ───────── theme & language ───────── */
const applyTheme = th => { th ? document.documentElement.setAttribute("data-theme", th) : document.documentElement.removeAttribute("data-theme"); };
applyTheme(localStorage.getItem("ibdp-theme") || "");
$("#themeBtn").onclick = () => {
  const cur = localStorage.getItem("ibdp-theme") || "";
  const next = cur === "" ? "dark" : cur === "dark" ? "light" : "";
  next ? localStorage.setItem("ibdp-theme", next) : localStorage.removeItem("ibdp-theme");
  applyTheme(next);
};
function applyChrome() {
  document.querySelector('[data-nav="home"]').textContent = t("nav_home");
  document.querySelector('[data-nav="matrix"]').textContent = t("nav_matrix");
  document.querySelector('[data-nav="review"]').textContent = t("nav_review");
  document.querySelector('[data-nav="files"]').textContent = t("nav_files");
  document.querySelector('[data-nav="submit"]').textContent = Portal.active && Portal.role === "supervisor" ? (LANG === "zh" ? "收件箱" : "Inbox") : t("nav_submit");
  document.querySelector('[data-nav="days"]').textContent = t("nav_days");
  const account = document.getElementById("accountBtn");
  if (account && account.style.display !== "none") account.textContent = LANG === "zh" ? "账户" : "Account";
  $("#langBtn").textContent = LANG === "en" ? "中" : "EN";
}
$("#langBtn").onclick = () => {
  LANG = LANG === "en" ? "zh" : "en";
  localStorage.setItem("ibdp-lang", LANG);
  applyChrome(); route(); renderFoot();
};

/* ───────── data ───────── */
const DB = { meta: null, syllabus: {}, tbmap: {}, attempts: [], content: {}, reviewProgress: {} };

/* review-checkbox state lives per-device in localStorage (distinct from DB spaced-repetition) */
const reviewedKey = id => "ibdp-reviewed-" + id;
const getReviewed = id => localStorage.getItem(reviewedKey(id));
const setReviewed = id => localStorage.setItem(reviewedKey(id), todayStr());
const clearReviewed = id => localStorage.removeItem(reviewedKey(id));

/* Student-facing spaced repetition. This is a browser-local bridge until the
   authenticated portal can persist progress server-side. */
const SRS_KEY = "ibdp-srs-v1";
const SRS_INTERVALS = [1, 3, 7, 14, 30];
const getSrsStore = () => {
  try { return JSON.parse(localStorage.getItem(SRS_KEY) || "{}"); }
  catch { return {}; }
};
const saveSrsStore = store => localStorage.setItem(SRS_KEY, JSON.stringify(store));
const addDays = (date, n) => {
  const d = new Date(date + "T00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
function reviewState(a) {
  const saved = getSrsStore()[a.id];
  // A supervisor's ratings are a private preview and must never be replaced
  // by the linked student's cloud state after a page reload.
  if (window.Portal && Portal.role === "supervisor" && saved) return saved;
  const cloud = window.Portal && Portal.reviewState(a.id);
  if (cloud) return cloud;
  if (saved) return saved;
  if (a.review) return { stage: a.review.stage || 0, next: a.review.next || todayStr(), done: !!a.review.done, history: a.review.history || [] };
  return { stage: 0, next: todayStr(), done: false, history: [] };
}
async function recordReview(id, rating) {
  const a = DB.attempts.find(x => x.id === id);
  if (!a) return;
  const store = getSrsStore();
  const cur = reviewState(a);
  const nextState = nextReviewState(cur, rating, todayStr());
  if (window.Portal && await Portal.saveReview(id, nextState)) return;
  store[id] = nextState;
  saveSrsStore(store);
  // Supervisors use a device-local preview. Keep the loaded portal cache in
  // sync too, otherwise its older cloud state wins and the same card repeats.
  DB.reviewProgress[id] = nextState;
}
function nextReviewState(cur, rating, date) {
  let stage = cur.stage || 0;
  let wait = 1;
  if (rating === "again") { stage = 0; wait = 1; }
  else if (rating === "hard") { wait = Math.max(1, SRS_INTERVALS[Math.max(0, stage - 1)] || 1); }
  else { stage += 1; wait = SRS_INTERVALS[Math.min(stage - 1, SRS_INTERVALS.length - 1)]; }
  return {
    stage,
    next: addDays(date, wait),
    done: stage >= SRS_INTERVALS.length,
    history: [...(cur.history || []), { date, rating }]
  };
}

async function j(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(url + " → " + r.status);
  return r.json();
}

async function loadAll() {
  DB.meta = await j("data/meta.json");
  STUDENT_TIME_ZONE = DB.meta.time_zone || STUDENT_TIME_ZONE;
  const active = Object.entries(DB.meta.subjects).filter(([, s]) => s.active).map(([id]) => id);
  await Promise.all([
    ...active.map(async id => { DB.syllabus[id] = await j(`data/syllabus/${id}.json`); }),
    ...active.map(async id => { DB.tbmap[id] = await j(`data/textbook_map/${id}.json`).catch(() => null); }),
    ...DB.meta.attempt_files.map(async f => {
      const arr = await j(f).catch(() => []);
      DB.attempts.push(...arr);
    })
  ]);
  DB.attempts.sort((a, b) => a.id < b.id ? -1 : 1);
  // private content layer (question/answer/markscheme) — local only, gitignored; absent on public site
  await Promise.all(DB.meta.attempt_files.map(async f => {
    const pf = f.replace("attempts/", "private/").replace(/\.json$/, ".content.json");
    const doc = await j(pf).catch(() => null);
    if (!doc || !doc.items) return;
    const papers = doc.papers || {};
    for (const [id, c] of Object.entries(doc.items)) {
      const pk = c.paper || (DB.attempts.find(a => a.id === id)?.source?.paper);
      DB.content[id] = { ...c, ...(papers[pk] || {}) };
    }
  }));
}

const hasContent = () => Object.keys(DB.content).length > 0;

/* KP index: id → {name, subtopicId, …} */
function kpIndex() {
  const idx = {};
  for (const [subj, syl] of Object.entries(DB.syllabus)) {
    for (const tp of syl.topics) for (const st of tp.subtopics) for (const kp of st.kps) {
      idx[kp.id] = { ...kp, subject: subj, subtopicId: st.id, subtopicName: st.name, topicName: tp.name };
    }
  }
  return idx;
}

/* ───────── mastery (single definition of the metric) ─────────
   weighted accuracy = Σ(w·earned/max)/Σw, w = marks × 0.5^(age_days/half-life)
   states: not_covered / unpracticed / weak(<ok_min) / ok /
           mastered(≥master_min & ≥min_correct_attempts full-mark attempts)
   regressed: was mastered before the latest attempt, latest attempt not full marks */
function masteryOf(kpId, covered, atDate, pool) {
  const P = DB.meta.mastery;
  const rel = (pool || DB.attempts).filter(a => a.kps && a.kps.includes(kpId) && a.date <= atDate);
  if (!covered) return { state: "not_covered", n: rel.length };
  if (!rel.length) return { state: "unpracticed", n: 0 };
  const score = arr => {
    let ws = 0, we = 0;
    for (const a of arr) {
      const w = Math.pow(0.5, Math.max(0, dayDiff(atDate, a.date)) / P.halflife_days) * a.max;
      ws += w; we += w * (a.earned / a.max);
    }
    return ws ? we / ws : 0;
  };
  const s = score(rel);
  const minCorrect = P.min_correct_attempts || P.min_attempts || 3;
  const correctN = rel.filter(a => a.verdict === "correct").length;
  let state = (s >= P.master_min && correctN >= minCorrect) ? "mastered" : (s >= P.ok_min ? "ok" : "weak");
  const before = rel.slice(0, -1);
  const last = rel[rel.length - 1];
  const prevWasMastered = before.length && score(before) >= P.master_min && before.filter(a => a.verdict === "correct").length >= minCorrect;
  if (prevWasMastered && last.verdict !== "correct") state = "regressed";
  return { state, score: s, n: rel.length, correctN, last: last.date };
}

const stateChip = st => `<span class="chip state s-${st}">${t("st_" + st)}</span>`;

function allKpStates(atDate) {
  const idx = kpIndex();
  return Object.values(idx).map(kp => ({ kp, m: masteryOf(kp.id, kp.covered, atDate) }));
}

/* ───────── review queue ───────── */
function reviewQueue() {
  const today = todayStr();
  const due = [], overdue = [];
  for (const a of DB.attempts) {
    if (a.verdict !== "correct") {
      const s = reviewState(a);
      if (!s.done && s.next) {
        if (s.next < today) overdue.push(a);
        else if (s.next === today) due.push(a);
      }
    }
  }
  return { due, overdue };
}

/* ───────── SVG line chart (single series, crosshair + tooltip) ───────── */
function lineChart(container, pts, { yLabel = "", fmt = v => v } = {}) {
  if (!pts.length) { container.innerHTML = `<div class="empty">${t("empty_chart")}</div>`; return; }
  const W = 720, H = 250, Lm = 44, R = 14, T = 14, B = 30;
  const xs = pts.map(p => +new Date(p.date + "T00:00"));
  const yMax = Math.max(4, Math.max(...pts.map(p => p.value)));
  const X = v => Lm + (v - xs[0]) / (xs[xs.length - 1] - xs[0] || 1) * (W - Lm - R);
  const Y = v => H - B - v / yMax * (H - T - B);
  const yTicks = []; const step = Math.max(1, Math.ceil(yMax / 4));
  for (let v = 0; v <= yMax; v += step) yTicks.push(v);
  const xTickN = Math.min(6, pts.length);
  const xTicks = xTickN === 1 ? [xs[0]] : Array.from({ length: xTickN }, (_, i) => xs[0] + (xs[xs.length - 1] - xs[0]) * i / (xTickN - 1));
  const path = pts.map((p, i) => `${i ? "L" : "M"}${X(xs[i]).toFixed(1)},${Y(p.value).toFixed(1)}`).join("");
  const fdate = ms => { const d = new Date(ms); return `${d.getMonth() + 1}/${d.getDate()}`; };

  container.innerHTML = `
  <div class="chartwrap">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(yLabel)}">
      ${yTicks.map(v => `<line x1="${Lm}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--grid)" stroke-width="1"/>
        <text x="${Lm - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${fmt(v)}</text>`).join("")}
      <line x1="${Lm}" x2="${W - R}" y1="${H - B}" y2="${H - B}" stroke="var(--axis)" stroke-width="1"/>
      ${xTicks.map(ms => `<text x="${X(ms)}" y="${H - B + 18}" text-anchor="middle" font-size="11" fill="var(--muted)">${fdate(ms)}</text>`).join("")}
      <path d="${path}" fill="none" stroke="var(--series-1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${pts.map((p, i) => `<circle cx="${X(xs[i])}" cy="${Y(p.value)}" r="3" fill="var(--series-1)" stroke="var(--surface)" stroke-width="1.5"/>`).join("")}
      <line id="ch-x" y1="${T}" y2="${H - B}" stroke="var(--axis)" stroke-width="1" visibility="hidden"/>
      <circle id="ch-dot" r="4.5" fill="var(--series-1)" stroke="var(--surface)" stroke-width="2" visibility="hidden"/>
      <rect id="ch-hit" x="${Lm}" y="${T}" width="${W - Lm - R}" height="${H - T - B}" fill="transparent"/>
    </svg>
    <div class="tooltip" id="ch-tip"></div>
  </div>`;

  const svg = container.querySelector("svg"), hit = container.querySelector("#ch-hit"),
    cx = container.querySelector("#ch-x"), dot = container.querySelector("#ch-dot"),
    tip = container.querySelector("#ch-tip");
  const move = ev => {
    const r = svg.getBoundingClientRect();
    const mx = (ev.clientX - r.left) / r.width * W;
    let best = 0, bd = Infinity;
    pts.forEach((p, i) => { const d = Math.abs(X(xs[i]) - mx); if (d < bd) { bd = d; best = i; } });
    const px = X(xs[best]), py = Y(pts[best].value);
    cx.setAttribute("x1", px); cx.setAttribute("x2", px); cx.setAttribute("visibility", "visible");
    dot.setAttribute("cx", px); dot.setAttribute("cy", py); dot.setAttribute("visibility", "visible");
    tip.style.display = "block";
    tip.style.left = (px / W * r.width) + "px";
    tip.style.top = (py / H * r.height) + "px";
    tip.innerHTML = `${pts[best].date} · <b>${fmt(pts[best].value)}</b>${yLabel ? " " + esc(yLabel) : ""}`;
  };
  const out = () => { cx.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden"); tip.style.display = "none"; };
  hit.addEventListener("mousemove", move); hit.addEventListener("mouseleave", out);
  hit.addEventListener("touchstart", e => move(e.touches[0]), { passive: true });
}

/* mastered-count series: replay by day (weekly sampling beyond 120 days) */
function masteredSeries(subject) {
  const attempts = subject ? DB.attempts.filter(a => a.subject === subject) : DB.attempts;
  if (!attempts.length) return [{ date: addDays(todayStr(), -1), value: 0 }, { date: todayStr(), value: 0 }];
  const first = attempts.reduce((m, a) => a.date < m ? a.date : m, todayStr());
  const span = dayDiff(todayStr(), first);
  const stepDays = span > 120 ? 7 : 1;
  const idx = Object.values(kpIndex()).filter(k => k.covered && (!subject || k.subject === subject));
  // A zero baseline makes growth visible even when all attempts are from one day.
  const out = [{ date: addDays(first, -1), value: 0 }];
  for (let d = 0; ; d += stepDays) {
    const cur = new Date(first + "T00:00"); cur.setDate(cur.getDate() + d);
    const ds = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
    out.push({ date: ds, value: idx.filter(kp => masteryOf(kp.id, true, ds).state === "mastered").length });
    if (ds >= todayStr() || out.length > 400) break;
  }
  return out;
}

/* 100% stacked history across the five student-facing mastery states.
   Regressed points are counted as weak in this overview; the topic matrix
   keeps the more specific regressed label. */
const MASTERY_MIX = [
  { key: "mastered", color: "var(--good)" },
  { key: "ok", color: "var(--warn)" },
  { key: "weak", color: "var(--serious)" },
  { key: "unpracticed", color: "var(--muted)" },
  { key: "not_covered", color: "var(--axis)" }
];

function masteryMixSeries(subject) {
  const kps = Object.values(kpIndex()).filter(kp => !subject || kp.subject === subject);
  return masteredSeries(subject).map(p => {
    const counts = { mastered: 0, ok: 0, weak: 0, unpracticed: 0, not_covered: 0 };
    for (const kp of kps) {
      const state = masteryOf(kp.id, kp.covered, p.date).state;
      counts[state === "regressed" ? "weak" : state] += 1;
    }
    return { date: p.date, counts, total: kps.length };
  });
}

function masteryMixChart(container, pts) {
  if (!pts.length) { container.innerHTML = `<div class="empty">${t("empty_chart")}</div>`; return; }
  const W = 720, H = 260, Lm = 44, R = 14, T = 14, B = 30;
  const xs = pts.map(p => +new Date(p.date + "T00:00"));
  const X = v => Lm + (v - xs[0]) / (xs[xs.length - 1] - xs[0] || 1) * (W - Lm - R);
  const Y = v => H - B - v / 100 * (H - T - B);
  const xTickN = Math.min(6, pts.length);
  const xTicks = xTickN === 1 ? [xs[0]] : Array.from({ length: xTickN }, (_, i) => xs[0] + (xs[xs.length - 1] - xs[0]) * i / (xTickN - 1));
  const fdate = ms => { const d = new Date(ms); return `${d.getMonth() + 1}/${d.getDate()}`; };
  let cumulative = pts.map(() => 0);
  const layers = MASTERY_MIX.map(item => {
    const bottom = [...cumulative];
    const top = pts.map((p, i) => bottom[i] + (p.total ? p.counts[item.key] / p.total * 100 : 0));
    cumulative = top;
    const upper = top.map((v, i) => `${i ? "L" : "M"}${X(xs[i]).toFixed(1)},${Y(v).toFixed(1)}`).join("");
    const lower = bottom.map((v, i) => `L${X(xs[bottom.length - 1 - i]).toFixed(1)},${Y(bottom[bottom.length - 1 - i]).toFixed(1)}`).join("");
    return `<path d="${upper}${lower}Z" fill="${item.color}" opacity=".9"/>`;
  }).join("");
  const current = pts[pts.length - 1];

  container.innerHTML = `<div class="mix-legend">${MASTERY_MIX.map(item => {
      const pct = current.total ? Math.round(current.counts[item.key] / current.total * 100) : 0;
      return `<span><i style="background:${item.color}"></i>${t("st_" + item.key)} <b>${pct}%</b></span>`;
    }).join("")}</div>
    <div class="chartwrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t("chart_title"))}">
      ${[0, 25, 50, 75, 100].map(v => `<line x1="${Lm}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--grid)" stroke-width="1"/><text x="${Lm - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${v}%</text>`).join("")}
      ${layers}
      ${xTicks.map(ms => `<text x="${X(ms)}" y="${H - B + 18}" text-anchor="middle" font-size="11" fill="var(--muted)">${fdate(ms)}</text>`).join("")}
      <line id="mix-x" y1="${T}" y2="${H - B}" stroke="var(--ink)" stroke-width="1" visibility="hidden"/>
      <rect id="mix-hit" x="${Lm}" y="${T}" width="${W - Lm - R}" height="${H - T - B}" fill="transparent"/>
    </svg><div class="tooltip mix-tip"></div></div>`;

  const svg = container.querySelector("svg"), hit = container.querySelector("#mix-hit"), cross = container.querySelector("#mix-x"), tip = container.querySelector(".mix-tip");
  const move = ev => {
    const rect = svg.getBoundingClientRect();
    const mx = (ev.clientX - rect.left) / rect.width * W;
    let best = 0, distance = Infinity;
    pts.forEach((p, i) => { const d = Math.abs(X(xs[i]) - mx); if (d < distance) { distance = d; best = i; } });
    const px = X(xs[best]);
    cross.setAttribute("x1", px); cross.setAttribute("x2", px); cross.setAttribute("visibility", "visible");
    tip.style.display = "block"; tip.style.left = (px / W * rect.width) + "px"; tip.style.top = "8px";
    tip.innerHTML = `<b>${pts[best].date}</b><br>${MASTERY_MIX.map(item => `${esc(t("st_" + item.key))}: ${pts[best].counts[item.key]} (${Math.round(pts[best].counts[item.key] / pts[best].total * 100)}%)`).join("<br>")}`;
  };
  const out = () => { cross.setAttribute("visibility", "hidden"); tip.style.display = "none"; };
  hit.addEventListener("mousemove", move); hit.addEventListener("mouseleave", out);
  hit.addEventListener("touchstart", e => move(e.touches[0]), { passive: true });
}

/* ───────── textbook reference chip ─────────
   local site → deep link into the PDF page; online → cloud_url if configured, else text chip */
function tbRef(ref, subject) {
  if (!ref) return "";
  const map = DB.tbmap[subject];
  const file = ref.file || (map && map.file);
  const label = `📖 ${esc(ref.section || "")} · PDF p.${ref.pdf_page}${ref.para ? " · ¶" + ref.para : ""}`;
  const privateTarget = window.Portal && Portal.active && Portal.resourceTarget(subject, "textbook", ref.pdf_page);
  if (privateTarget) {
    return `<button class="tbref js-open-private" data-path="${esc(privateTarget.path)}" data-page="${privateTarget.page}">${label} ↗</button>`;
  }
  if (IS_LOCAL && file) {
    return `<a class="tbref" target="_blank" href="/${encodeURI(file)}#page=${ref.pdf_page}">${label} ↗</a>`;
  }
  if (!IS_LOCAL && map && map.cloud_url) {
    return `<a class="tbref" target="_blank" href="${esc(map.cloud_url)}">${label} ↗ ${t("open_cloud")}</a>`;
  }
  return `<span class="tbref dead" title="${esc(t("tb_hint"))}">${label}</span>`;
}

/* ───────── pages ───────── */
function pageHome() {
  const today = todayStr();
  const m = DB.meta;
  const q = reviewQueue();
  const totMax = DB.attempts.reduce((s, a) => s + a.max, 0);
  const totEarned = DB.attempts.reduce((s, a) => s + a.earned, 0);
  const mock = m.milestones && m.milestones[0];
  const states = allKpStates(today);

  let html = `<h2>${t("today")}</h2><div class="tiles">`;
  if (mock) html += `<div class="tile"><div class="t-label">${t("mock_label")}</div><div class="t-value">${dayDiff(mock.date, today)}<small> ${t("days")}</small></div><div class="t-sub">${mock.date}${mock.estimate ? " · " + t("approx") : ""}</div></div>`;
  html += `<div class="tile"><div class="t-label">${t("final_label")}</div><div class="t-value">${dayDiff(m.exams_start, today)}<small> ${t("days")}</small></div><div class="t-sub">${m.exams_start}${m.exams_start_estimate ? " · " + t("approx") : ""}</div></div>`;
  html += `<div class="tile ${q.overdue.length ? "alert" : ""}"><div class="t-label">${t("review_label")}</div><div class="t-value">${q.due.length + q.overdue.length}<small> ${t("due_n")}</small></div><div class="t-sub">${q.overdue.length ? t("overdue_n")(q.overdue.length) : t("no_overdue")}</div></div>`;
  html += `<div class="tile"><div class="t-label">${t("records_label")}</div><div class="t-value">${DB.attempts.length}<small> ${t("q_unit")}</small></div><div class="t-sub">${t("weighted")} ${totMax ? Math.round(totEarned / totMax * 100) + "%" : "–"}</div></div>`;
  html += `</div>`;

  if (!DB.attempts.length) {
    html += `<div class="card" style="margin-top:14px">${t("no_data")}</div>`;
    $("#app").innerHTML = html;
    return;
  }

  html += `<h2>${t("subjects_title")}</h2>`;
  for (const [id, s] of Object.entries(m.subjects)) {
    if (!s.active) continue;
    const sub = states.filter(x => x.kp.subject === id);
    const cnt = st => sub.filter(x => x.m.state === st).length;
    const rel = DB.attempts.filter(a => a.subject === id);
    const sm = rel.reduce((x, a) => x + a.max, 0), se = rel.reduce((x, a) => x + a.earned, 0);
    html += `<div class="card"><b>${esc(s.name)} ${s.level}</b>
      <span class="kp-meta" style="margin-left:8px">${rel.length} ${t("q_unit")} · ${t("score_rate")} ${sm ? Math.round(se / sm * 100) + "%" : "–"}</span>
      <div class="legend" style="margin:8px 0 0">
        ${stateChip("mastered")} ${cnt("mastered")}　${stateChip("ok")} ${cnt("ok")}　${stateChip("weak")} ${cnt("weak")}
        ${cnt("regressed") ? "　" + stateChip("regressed") + " " + cnt("regressed") : ""}
        　${stateChip("unpracticed")} ${cnt("unpracticed")}　${stateChip("not_covered")} ${cnt("not_covered")}
      </div>
      <div style="margin-top:8px"><a href="#/matrix/${id}">${t("view_matrix")}</a></div></div>`;
  }
  const inactive = Object.values(m.subjects).filter(s => !s.active).map(s => `${s.name} ${s.level}`);
  if (inactive.length) html += `<div class="note">${t("pending")(esc(inactive.join(" · ")))}</div>`;

  if (q.due.length + q.overdue.length) {
    const idx = kpIndex();
    html += `<h2>${t("due_title")}</h2><div class="card"><div style="margin-bottom:10px"><a class="review-start" href="#/review">${t("start_review")}</a></div>` +
      [...q.overdue, ...q.due].slice(0, 8).map(a => {
        const kpn = (a.kps || []).map(k => idx[k] ? idx[k].name : k).join("; ");
        const next = reviewState(a).next;
        return `<div class="att-head" style="padding:4px 0">
          <span class="chip ${next < today ? "err" : ""}">${next < today ? t("overdue_chip") : ""}${next}</span>
          <span>${esc(a.source && a.source.paper || a.source && a.source.type || "")} ${esc(a.source && a.source.q || "")}</span>
          <span class="kp-meta">${esc(kpn)}</span></div>`;
      }).join("") + `</div>`;
  }

  $("#app").innerHTML = html;
}

function pageReview() {
  const q = reviewQueue();
  const items = [...q.overdue, ...q.due];
  const upcoming = DB.attempts
    .filter(a => a.verdict !== "correct")
    .map(a => reviewState(a))
    .filter(s => !s.done && s.next > todayStr())
    .sort((a, b) => a.next.localeCompare(b.next));
  let html = `<h2>${t("review_title")}</h2><div class="note review-intro">${t("review_intro")}</div>`;
  if (!items.length) {
    html += `<div class="card review-empty"><b>${t("review_none")}</b>${upcoming.length ? `<div class="note">${t("review_next")(upcoming[0].next)}</div>` : ""}</div>`;
    html += `<div class="note">${t("review_device_note")}</div>`;
    $("#app").innerHTML = html;
    return;
  }
  const a = items[0];
  const c = DB.content[a.id];
  const idx = kpIndex();
  const kpn = (a.kps || []).map(k => idx[k] ? idx[k].name : k).join(" · ");
  html += `<div class="review-count">${t("review_remaining")(items.length)}</div>
    <div class="card review-card" data-id="${esc(a.id)}">
      <div class="att-head"><span class="att-src">${esc(a.source && (a.source.paper || a.source.type) || "")} ${esc(a.source && a.source.q ? "Q" + a.source.q : "")}</span><span class="kp-meta">${esc(kpn)}</span></div>`;
  if (!c) {
    html += `<div class="review-locked">${t("review_private_missing")}</div>`;
  } else {
    html += `<div class="rv-field review-question"><span class="rv-lbl">${t("lbl_question")}</span><div class="rv-val">${esc(c.q)}</div></div>
      <button class="reveal-btn review-reveal">${t("review_show_answer")}</button>
      <div class="review-answer" style="display:none">
        <div class="rv-field"><span class="rv-lbl">${t("lbl_your_answer")}</span><div class="rv-val yours">${esc(c.ans)}</div></div>
        <div class="rv-field"><span class="rv-lbl">${t("lbl_markscheme")}</span><div class="rv-val ms">${esc(c.ms)}</div></div>
        <div class="rv-field"><span class="rv-lbl">${t("lbl_analysis")}</span><div class="rv-val">${esc(a.analysis || "")}</div></div>
        ${attemptSourceLinks(c)}
        ${tbRef(a.textbook_ref, a.subject)}
        <div class="review-rate"><b>${t("review_rate")}</b><div class="review-actions">
          <button data-rating="again" class="rate-again">${t("review_again")}</button>
          <button data-rating="hard" class="rate-hard">${t("review_hard")}</button>
          <button data-rating="good" class="rate-good">${t("review_good")}</button>
        </div></div>
      </div>`;
  }
  html += `</div><div class="note">${t("review_device_note")}</div>`;
  $("#app").innerHTML = html;
  if (window.Portal) Portal.wirePrivateOpen(LANG);
  const reveal = document.querySelector(".review-reveal");
  if (reveal) reveal.onclick = () => { reveal.style.display = "none"; document.querySelector(".review-answer").style.display = "block"; };
  document.querySelectorAll("[data-rating]").forEach(btn => btn.onclick = async () => {
    await recordReview(a.id, btn.dataset.rating);
    pageReview();
  });
}

function pageMatrix(subj) {
  const active = Object.entries(DB.meta.subjects).filter(([, s]) => s.active);
  if (!subj || !DB.syllabus[subj]) subj = active[0] && active[0][0];
  const syl = DB.syllabus[subj];
  if (!syl) { $("#app").innerHTML = `<div class="empty">${t("no_records")}</div>`; return; }
  const today = todayStr();
  const tbm = DB.tbmap[subj];

  let html = `<h2>${t("matrix_title")}</h2><div class="subject-tabs">` +
    active.map(([id, s]) => `<a href="#/matrix/${id}" class="${id === subj ? "on" : ""}">${esc(s.name)} ${s.level}</a>`).join("") + `</div>`;

  html += `<div class="card topic-mastery-chart"><div id="topic-chart"></div>
    <div class="note">${t("chart_note")(Math.round(DB.meta.mastery.master_min * 100), DB.meta.mastery.halflife_days, DB.meta.mastery.min_correct_attempts || DB.meta.mastery.min_attempts)}</div></div>`;
  html += `<div class="legend">${["mastered", "ok", "weak", "regressed", "unpracticed", "not_covered"].map(stateChip).join(" ")}</div>`;

  for (const tp of syl.topics) {
    html += `<div class="topic-block"><h3>${esc(tp.name)}</h3>`;
    for (const st of tp.subtopics) {
      const range = tbm && tbm.subtopics && tbm.subtopics[st.id];
      let pref = "";
      if (range) {
        const lbl = `📖 PDF p.${range.pdf_start}–${range.pdf_end}`;
        if (IS_LOCAL && tbm.file) pref = `<a class="pageref" target="_blank" href="/${encodeURI(tbm.file)}#page=${range.pdf_start}">${lbl} ↗</a>`;
        else if (tbm.cloud_url) pref = `<a class="pageref" target="_blank" href="${esc(tbm.cloud_url)}">${lbl} ↗</a>`;
        else pref = `<span class="pageref">${lbl}</span>`;
      }
      html += `<div class="subtopic"><h4>${esc(st.id)} · ${esc(st.name)} ${pref}</h4>`;
      for (const kp of st.kps) {
        const m = masteryOf(kp.id, kp.covered, today);
        const minCorrect = DB.meta.mastery.min_correct_attempts || DB.meta.mastery.min_attempts;
        const meta = m.n ? `${m.n}${t("times")}${m.score != null ? " · " + fmtPct(m.score) : ""} · ${t("full_marks_n")(m.correctN || 0, minCorrect)}` : "";
        html += `<div class="kp-row" data-kp="${esc(kp.id)}">${stateChip(m.state)}
          <span class="kp-name">${esc(kp.id)} — ${esc(kp.name)}</span>
          <span class="kp-meta">${meta}</span></div>
          <div class="kp-detail" id="kd-${esc(kp.id)}" style="display:none"></div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
  }
  $("#app").innerHTML = html;
  masteryMixChart(document.getElementById("topic-chart"), masteryMixSeries(subj));

  document.querySelectorAll(".kp-row").forEach(row => {
    row.onclick = () => {
      const id = row.dataset.kp;
      const box = document.getElementById("kd-" + id);
      if (box.style.display === "none") {
        const rel = DB.attempts.filter(a => a.kps && a.kps.includes(id));
        box.innerHTML = rel.length
          ? rel.map(a => `<div class="att"><span>${a.date}</span>
              <span>${esc(a.source && (a.source.paper || a.source.type) || "")} ${esc(a.source && a.source.q || "")}</span>
              <span class="chip v-${a.verdict}">${a.earned}/${a.max}</span>
              ${a.textbook_ref ? tbRef(a.textbook_ref, a.subject) : ""}</div>`).join("")
          : `<div class="att">${t("never_practiced")}</div>`;
        box.style.display = "block";
      } else box.style.display = "none";
    };
  });
}

function pageDays() {
  const byDate = {};
  for (const a of DB.attempts) (byDate[a.date] = byDate[a.date] || []).push(a);
  const dates = Object.keys(byDate).sort().reverse();
  if (!dates.length) { $("#app").innerHTML = `<div class="empty">${t("no_records")}</div>`; return; }
  $("#app").innerHTML = `<h2>${t("days_title")}</h2><div class="day-list">` + dates.map(d => {
    const arr = byDate[d];
    const e = arr.reduce((s, a) => s + a.earned, 0), mx = arr.reduce((s, a) => s + a.max, 0);
    const subs = [...new Set(arr.map(a => DB.meta.subjects[a.subject] ? DB.meta.subjects[a.subject].name : a.subject))];
    const wrong = arr.filter(a => a.verdict !== "correct").length;
    return `<a class="day-item" href="#/day/${d}"><span class="d-date">${d}</span>
      <span>${arr.length} ${t("q_unit")} · ${e}/${mx} (${mx ? Math.round(e / mx * 100) : 0}%)</span>
      <span class="d-meta">${esc(subs.join(" · "))} · ${wrong ? t("lost_on")(wrong) : t("all_correct")}</span></a>`;
  }).join("") + `</div>`;
}

const VERDICTS = ["correct", "partial", "wrong"];
const ERRTYPES = ["concept", "calculation", "misread", "expression", "time"];

function attemptSourceLinks(c) {
  if (!c) return "";
  const privateLink = (path, label, page) => path ? `<button class="tbref js-open-private" data-path="${esc(path)}"${page ? ` data-page="${page}"` : ""}>${label}</button>` : "";
  const localLink = (path, label, page) => path ? `<a class="tbref" target="_blank" href="/${encodeURI(path)}${page ? `#page=${page}` : ""}">${label}</a>` : "";
  const supporting = (c.source_files || []).map((item, index) => Portal.active
    ? privateLink(item.path, esc(item.title || `${t("open_source")} ${index + 1}`), item.page)
    : localLink(item.path, esc(item.title || `${t("open_source")} ${index + 1}`), item.page)).join("");
  const links = Portal.active
    ? `${privateLink(c.qp_file, t("open_qp"), c.qp_page)}${supporting}${privateLink(c.ms_file, t("open_ms"), c.ms_page)}${privateLink(c.answer_file, t("open_answer"), c.qp_page)}`
    : `${localLink(c.qp_file, t("open_qp"), c.qp_page)}${supporting}${localLink(c.ms_file, t("open_ms"), c.ms_page)}`;
  return links ? `<div class="src-links">${links}</div>` : "";
}

function attemptPanel(a, idx) {
  const c = DB.content[a.id];
  const errored = a.verdict !== "correct";
  const reviewedOn = getReviewed(a.id);
  const kpn = (a.kps || []).map(k => idx[k] ? `${k} ${idx[k].name}` : k);
  const links = attemptSourceLinks(c);
  const contentBlock = c
    ? `<div class="rv-field"><span class="rv-lbl">${t("lbl_question")}</span><div class="rv-val">${esc(c.q)}</div></div>
       <div class="rv-field"><span class="rv-lbl">${t("lbl_your_answer")}</span><div class="rv-val yours">${esc(c.ans)}</div></div>
       <div class="rv-field"><span class="rv-lbl">${t("lbl_markscheme")}</span><div class="rv-val ms">${esc(c.ms)}</div></div>
       ${links}`
    : `<div class="note">${t("content_local_only")}</div>`;
  const analysisBlock = (errored || a.analysis)
    ? `<div class="rv-field"><span class="rv-lbl">${t("lbl_analysis")}</span>
         <div class="rv-val">${a.error_type ? `<span class="chip err">${esc(errTxt(a.error_type))}</span> ` : ""}${esc(a.analysis || "")}</div>
         ${a.review && !a.review.done ? `<div class="review-note">${t("review_prog")(a.review.stage, esc(a.review.next))}</div>`
           : a.review && a.review.done ? `<div class="review-note">${t("review_done")}</div>` : ""}
       </div>` : "";
  const reviewChk = errored
    ? `<label class="rv-check"><input type="checkbox" class="js-review-chk" data-id="${a.id}" ${reviewedOn ? "checked" : ""}>
         <span>${reviewedOn ? t("reviewed_on")(reviewedOn) : t("mark_reviewed")}</span></label>
       <div class="note">${t("quick_review_note")}</div>` : "";
  const editBlock = `
    <button class="mini-btn js-edit" data-id="${a.id}">${t("edit_mark")}</button>
    <div class="edit-form" id="ef-${a.id}" style="display:none">
      <label>${t("fld_earned")} <input type="number" min="0" max="${a.max}" step="1" class="ef-earned" value="${a.earned}"> / ${a.max}</label>
      <label>${t("fld_verdict")} <select class="ef-verdict">${VERDICTS.map(v => `<option value="${v}" ${a.verdict === v ? "selected" : ""}>${t("v_" + v)}</option>`).join("")}</select></label>
      <label>${t("fld_errtype")} <select class="ef-errtype"><option value="">—</option>${ERRTYPES.map(v => `<option value="${v}" ${a.error_type === v ? "selected" : ""}>${errTxt(v)}</option>`).join("")}</select></label>
      <label class="ef-wide">${t("lbl_analysis")}<textarea class="ef-analysis" rows="3">${esc(a.analysis || "")}</textarea></label>
      <div class="ef-actions">
        <button class="mini-btn primary js-copy" data-id="${a.id}">${t("save_edit")}</button>
        <button class="mini-btn js-cancel" data-id="${a.id}">${t("cancel")}</button>
        <span class="copied-note" id="cp-${a.id}"></span>
      </div>
    </div>`;

  return `<div class="attempt" data-id="${a.id}">
    <div class="att-head">
      <span class="att-src">${esc(a.source && (a.source.paper || a.source.type) || "")} ${esc(a.source && a.source.q ? "Q" + a.source.q : "")}</span>
      ${a.command_term ? `<span class="chip">${esc(a.command_term)}</span>` : ""}
      <span class="att-marks">${a.earned}/${a.max}</span>
      <span class="chip v-${a.verdict}">${t("v_" + a.verdict)}</span>
      ${a.uncertain ? `<span class="chip">${t("uncertain")}</span>` : ""}
      ${reviewedOn ? `<span class="chip v-correct">✓ ${esc(reviewedOn)}</span>` : ""}
    </div>
    <div class="kp-meta" style="margin-top:4px">${kpn.map(esc).join("　")}</div>
    <button class="reveal-btn js-reveal" data-id="${a.id}">${t("reveal_review")}</button>
    <div class="rv-panel" id="rv-${a.id}" style="display:none">
      ${contentBlock}
      ${analysisBlock}
      ${tbRef(a.textbook_ref, a.subject)}
      ${reviewChk}
      ${editBlock}
    </div>
  </div>`;
}

function pageDay(date) {
  const arr = DB.attempts.filter(a => a.date === date);
  if (!arr.length) { $("#app").innerHTML = `<div class="empty">${esc(t("no_day")(date))}</div>`; return; }
  const idx = kpIndex();
  const e = arr.reduce((s, a) => s + a.earned, 0), mx = arr.reduce((s, a) => s + a.max, 0);
  $("#app").innerHTML = `<h2>${esc(date)}　<span class="kp-meta">${arr.length} ${t("q_count")} · ${e}/${mx} (${mx ? Math.round(e / mx * 100) : 0}%)</span></h2>
    <div style="margin-bottom:10px"><a href="#/days">${t("back_all")}</a></div>
    <div class="card">${arr.map(a => attemptPanel(a, idx)).join("")}</div>`;
  wireDayHandlers();
}

function wireDayHandlers() {
  if (window.Portal) Portal.wirePrivateOpen(LANG);
  document.querySelectorAll(".js-reveal").forEach(btn => btn.onclick = () => {
    const p = document.getElementById("rv-" + btn.dataset.id);
    const open = p.style.display !== "none";
    p.style.display = open ? "none" : "block";
    btn.textContent = open ? t("reveal_review") : t("collapse");
  });
  document.querySelectorAll(".js-review-chk").forEach(chk => chk.onchange = () => {
    chk.checked ? setReviewed(chk.dataset.id) : clearReviewed(chk.dataset.id);
    const span = chk.parentElement.querySelector("span");
    span.textContent = chk.checked ? t("reviewed_on")(getReviewed(chk.dataset.id)) : t("mark_reviewed");
    const head = chk.closest(".attempt").querySelector(".att-head");
    let tag = head.querySelector(".rv-done-tag");
    if (chk.checked && !tag) {
      tag = document.createElement("span"); tag.className = "chip v-correct rv-done-tag";
      tag.textContent = "✓ " + getReviewed(chk.dataset.id); head.appendChild(tag);
    } else if (!chk.checked && tag) tag.remove();
  });
  document.querySelectorAll(".js-edit").forEach(btn => btn.onclick = () => {
    const f = document.getElementById("ef-" + btn.dataset.id);
    f.style.display = f.style.display === "none" ? "block" : "none";
  });
  document.querySelectorAll(".js-cancel").forEach(btn => btn.onclick = () => {
    document.getElementById("ef-" + btn.dataset.id).style.display = "none";
  });
  document.querySelectorAll(".js-copy").forEach(btn => btn.onclick = async () => {
    const f = document.getElementById("ef-" + btn.dataset.id);
    const correction = {
      id: btn.dataset.id,
      earned: Number(f.querySelector(".ef-earned").value),
      verdict: f.querySelector(".ef-verdict").value,
      error_type: f.querySelector(".ef-errtype").value || null,
      analysis: f.querySelector(".ef-analysis").value
    };
    const text = "CORRECTION " + JSON.stringify(correction);
    try { await navigator.clipboard.writeText(text); }
    catch { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
    document.getElementById("cp-" + btn.dataset.id).textContent = t("copied");
  });
}

/* ───────── router ───────── */
function route() {
  const h = location.hash.replace(/^#\/?/, "");
  const [p, arg] = h.split("/");
  document.querySelectorAll("[data-nav]").forEach(a => a.classList.remove("on"));
  const nav = n => { const el = document.querySelector(`[data-nav="${n}"]`); if (el) el.classList.add("on"); };
  if (p === "matrix") { nav("matrix"); pageMatrix(arg); }
  else if (p === "review") { nav("review"); pageReview(); }
  else if (p === "files") { nav("files"); Portal.pageFiles(LANG); }
  else if (p === "submit") { nav("submit"); Portal.pageSubmit(LANG); }
  else if (p === "account") { Portal.pageAccount(LANG); }
  else if (p === "migrate") { Portal.pageMigrate(LANG); }
  else if (p === "connection") { Portal.pageConnection(LANG); }
  else if (p === "days") { nav("days"); pageDays(); }
  else if (p === "day" && arg) { nav("days"); pageDay(arg); }
  else { nav("home"); pageHome(); }
  window.scrollTo(0, 0);
}

function renderFoot() {
  const last = DB.attempts.length ? DB.attempts[DB.attempts.length - 1].date : "–";
  $("#footInfo").textContent = `${IS_LOCAL ? t("foot_local") : t("foot_online")} · ${DB.attempts.length} ${t("foot_records")} · ${t("foot_last")} ${last}`;
}

(async () => {
  applyChrome();
  $("#app").innerHTML = `<div class="loading">${t("loading")}</div>`;
  try {
    await loadAll();
    const signedIn = await Portal.init(DB);
    if (!signedIn && Portal.configured) { Portal.renderLogin(LANG); return; }
    applyChrome();
    renderFoot();
    window.addEventListener("hashchange", route);
    route();
  } catch (err) {
    $("#app").innerHTML = `<div class="card">${t("load_fail")} ${esc(err.message)}<br><br>${t("load_help")}</div>`;
  }
})();
