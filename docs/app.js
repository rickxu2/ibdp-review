/* IBDP Review — zero-build static site. Data: data/*.json (maintained by Claude; raw records are the single source of truth)
   All aggregates (mastery/curves) are computed here at runtime, never stored. */
"use strict";

/* ───────── i18n ───────── */
const L = {
  en: {
    nav_home: "Overview", nav_matrix: "Topics", nav_days: "Daily log",
    today: "Today",
    mock_label: "Mock exams (predicted grades)", final_label: "Final exams · May 2027",
    days: "days", approx: "approx.",
    review_label: "Reviews due", due_n: "due", overdue_n: n => `${n} overdue`, no_overdue: "none overdue",
    records_label: "Total records", q_unit: "questions", weighted: "Weighted score",
    chart_title: "Knowledge points mastered over time",
    chart_note: (p, h, n) => `Mastered = marks-weighted accuracy ≥ ${p}% (with ${h}-day half-life decay) over ≥ ${n} attempts. Same definition as the Topics page.`,
    mastered_unit: "mastered",
    subjects_title: "Subjects", score_rate: "score", view_matrix: "View topic matrix →",
    pending: list => `Not yet onboarded: ${list} (ask Claude to build the topic tree when needed)`,
    due_title: "Due for review (clear with /drill)", overdue_chip: "overdue ",
    no_data: "No attempts yet. Hand today's completed questions to Claude for marking (/mark) — this page comes alive with the first records.",
    matrix_title: "Topic mastery",
    st_mastered: "Mastered", st_ok: "OK", st_weak: "Weak", st_unpracticed: "Unpracticed", st_not_covered: "Not covered", st_regressed: "Regressed",
    times: "×", never_practiced: "No attempts on this point yet",
    days_title: "Daily log", all_correct: "all correct ✓", lost_on: n => `${n} with lost marks`,
    back_all: "← All days", q_count: "questions",
    v_correct: "✓ Full marks", v_partial: "Partial", v_wrong: "✗ Wrong", uncertain: "Marks in dispute",
    review_prog: (s, d) => `Review ${s}/5 · next ${d}`, review_done: "✅ Review complete (5 passes)",
    tb_hint: "Open the local site (scripts/serve.ps1) or add a cloud_url to open the book online",
    open_cloud: "open in cloud",
    no_day: d => `No records on ${d}`, no_records: "No attempts recorded yet",
    empty_chart: "Not enough data for a curve yet (needs two different days)",
    foot_local: "Local full version (textbook links active)", foot_online: "Online version",
    foot_records: "records", foot_last: "last attempt",
    loading: "Loading…",
    load_fail: "Failed to load data:",
    load_help: `• Locally: run <code>scripts\\serve.ps1</code> then open <a href="http://localhost:8788/docs/">http://localhost:8788/docs/</a> (opening index.html directly cannot fetch data)<br>• Or visit the GitHub Pages site`,
    err_concept: "Concept", err_calculation: "Calculation", err_misread: "Misread", err_expression: "Expression", err_time: "Time management",
    reveal_review: "Reveal question, answer & markscheme", collapse: "Collapse",
    lbl_question: "Question", lbl_your_answer: "Your answer", lbl_markscheme: "Markscheme", lbl_analysis: "Why / how to fix",
    content_local_only: "Question & markscheme are in the local version (run scripts/serve.ps1).",
    open_qp: "Question paper ↗", open_ms: "Markscheme ↗",
    mark_reviewed: "Mark reviewed", reviewed_on: d => `Reviewed ${d}`, review_gate: "Reveal the answer & markscheme first",
    quick_review_note: "Quick self-review only — real spaced repetition still runs through /drill.",
    edit_mark: "Edit grade", save_edit: "Copy correction", copied: "Copied — paste it to Claude to apply",
    fld_earned: "Marks earned", fld_verdict: "Verdict", fld_errtype: "Error type", cancel: "Cancel"
  },
  zh: {
    nav_home: "总览", nav_matrix: "知识点", nav_days: "每日记录",
    today: "今日",
    mock_label: "距模考（定预估分）", final_label: "距 May 2027 大考",
    days: "天", approx: "约",
    review_label: "错题复习", due_n: "道到期", overdue_n: n => `其中逾期 ${n} 道`, no_overdue: "无逾期",
    records_label: "累计记录", q_unit: "题", weighted: "加权得分率",
    chart_title: "掌握知识点数走势",
    chart_note: (p, h, n) => `掌握 = 按分值加权正确率 ≥ ${p}%（含 ${h} 天半衰期时间衰减）且练习 ≥ ${n} 次。口径与"知识点"页一致。`,
    mastered_unit: "个已掌握",
    subjects_title: "各科概况", score_rate: "得分率", view_matrix: "查看知识点矩阵 →",
    pending: list => `待接入：${list}（有需要时让 Claude 建对应知识点树）`,
    due_title: "到期复习（/drill 清账）", overdue_chip: "逾期 ",
    no_data: "还没有做题数据。把今天完成的题目交给 Claude 批改（/mark），第一批数据入库后这里就会活起来。",
    matrix_title: "知识点掌握度",
    st_mastered: "掌握", st_ok: "一般", st_weak: "薄弱", st_unpracticed: "未练", st_not_covered: "未学", st_regressed: "回潮",
    times: "次", never_practiced: "还没做过这个考点的题",
    days_title: "每日记录", all_correct: "全对 ✓", lost_on: n => `失分 ${n} 题`,
    back_all: "← 全部日期", q_count: "题",
    v_correct: "✓ 全对", v_partial: "部分", v_wrong: "✗ 错", uncertain: "给分待议",
    review_prog: (s, d) => `复习进度 ${s}/5 · 下次 ${d}`, review_done: "✅ 复习毕业（5 轮通过）",
    tb_hint: "本地站可直达 PDF（scripts/serve.ps1）；或在 textbook_map 配 cloud_url 在线打开",
    open_cloud: "云端打开",
    no_day: d => `${d} 没有记录`, no_records: "还没有做题记录",
    empty_chart: "数据还不够画曲线（至少两天记录）",
    foot_local: "本地完整版（课本可跳转）", foot_online: "公网版",
    foot_records: "条记录", foot_last: "最近做题",
    loading: "加载数据中…",
    load_fail: "数据加载失败：",
    load_help: `• 本地查看：运行 <code>scripts\\serve.ps1</code> 后打开 <a href="http://localhost:8788/docs/">http://localhost:8788/docs/</a>（直接双击 index.html 读不到数据）<br>• 或访问 GitHub Pages 线上版`,
    err_concept: "概念", err_calculation: "计算", err_misread: "审题", err_expression: "表达", err_time: "时间",
    reveal_review: "展开题目、答案与评分标准", collapse: "收起",
    lbl_question: "题目", lbl_your_answer: "你的答案", lbl_markscheme: "评分标准 (markscheme)", lbl_analysis: "错因与订正",
    content_local_only: "题目与 markscheme 仅本地版可见（运行 scripts/serve.ps1）。",
    open_qp: "打开试卷 ↗", open_ms: "打开评分标准 ↗",
    mark_reviewed: "标记已复习", reviewed_on: d => `已复习 ${d}`, review_gate: "先展开看到答案与评分标准",
    quick_review_note: "仅快速自查——真正的间隔重复仍走 /drill。",
    edit_mark: "编辑批改", save_edit: "复制订正", copied: "已复制——粘贴给 Claude 即可应用",
    fld_earned: "得分", fld_verdict: "判定", fld_errtype: "错误类型", cancel: "取消"
  }
};
let LANG = localStorage.getItem("ibdp-lang") || "en";
const t = k => { const v = L[LANG][k] ?? L.en[k] ?? k; return v; };
const errTxt = e => e ? (t("err_" + e) !== "err_" + e ? t("err_" + e) : e) : "";

/* ───────── utils ───────── */
const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtPct = x => (x == null || isNaN(x)) ? "–" : Math.round(x * 100) + "%";
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  document.querySelector('[data-nav="days"]').textContent = t("nav_days");
  $("#langBtn").textContent = LANG === "en" ? "中" : "EN";
}
$("#langBtn").onclick = () => {
  LANG = LANG === "en" ? "zh" : "en";
  localStorage.setItem("ibdp-lang", LANG);
  applyChrome(); route(); renderFoot();
};

/* ───────── data ───────── */
const DB = { meta: null, syllabus: {}, tbmap: {}, attempts: [], content: {} };

/* review-checkbox state lives per-device in localStorage (distinct from DB spaced-repetition) */
const reviewedKey = id => "ibdp-reviewed-" + id;
const getReviewed = id => localStorage.getItem(reviewedKey(id));
const setReviewed = id => localStorage.setItem(reviewedKey(id), todayStr());
const clearReviewed = id => localStorage.removeItem(reviewedKey(id));

async function j(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(url + " → " + r.status);
  return r.json();
}

async function loadAll() {
  DB.meta = await j("data/meta.json");
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
   states: not_covered / unpracticed / weak(<ok_min) / ok / mastered(≥master_min & ≥min_attempts)
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
  let state = (s >= P.master_min && rel.length >= P.min_attempts) ? "mastered" : (s >= P.ok_min ? "ok" : "weak");
  if (rel.length >= P.min_attempts + 1) {
    const prev = score(rel.slice(0, -1));
    const last = rel[rel.length - 1];
    if (prev >= P.master_min && last.verdict !== "correct") state = "regressed";
  }
  return { state, score: s, n: rel.length, last: rel[rel.length - 1].date };
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
    if (a.review && !a.review.done && a.review.next) {
      if (a.review.next < today) overdue.push(a);
      else if (a.review.next === today) due.push(a);
    }
  }
  return { due, overdue };
}

/* ───────── SVG line chart (single series, crosshair + tooltip) ───────── */
function lineChart(container, pts, { yLabel = "", fmt = v => v } = {}) {
  if (pts.length < 2) { container.innerHTML = `<div class="empty">${t("empty_chart")}</div>`; return; }
  const W = 720, H = 250, Lm = 44, R = 14, T = 14, B = 30;
  const xs = pts.map(p => +new Date(p.date + "T00:00"));
  const yMax = Math.max(4, Math.max(...pts.map(p => p.value)));
  const X = v => Lm + (v - xs[0]) / (xs[xs.length - 1] - xs[0] || 1) * (W - Lm - R);
  const Y = v => H - B - v / yMax * (H - T - B);
  const yTicks = []; const step = Math.max(1, Math.ceil(yMax / 4));
  for (let v = 0; v <= yMax; v += step) yTicks.push(v);
  const xTickN = Math.min(6, pts.length);
  const xTicks = Array.from({ length: xTickN }, (_, i) => xs[0] + (xs[xs.length - 1] - xs[0]) * i / (xTickN - 1));
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
function masteredSeries() {
  if (!DB.attempts.length) return [];
  const first = DB.attempts.reduce((m, a) => a.date < m ? a.date : m, todayStr());
  const span = dayDiff(todayStr(), first);
  const stepDays = span > 120 ? 7 : 1;
  const idx = Object.values(kpIndex()).filter(k => k.covered);
  const out = [];
  for (let d = 0; ; d += stepDays) {
    const cur = new Date(first + "T00:00"); cur.setDate(cur.getDate() + d);
    const ds = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
    out.push({ date: ds, value: idx.filter(kp => masteryOf(kp.id, true, ds).state === "mastered").length });
    if (ds >= todayStr() || out.length > 400) break;
  }
  return out;
}

/* ───────── textbook reference chip ─────────
   local site → deep link into the PDF page; online → cloud_url if configured, else text chip */
function tbRef(ref, subject) {
  if (!ref) return "";
  const map = DB.tbmap[subject];
  const file = ref.file || (map && map.file);
  const label = `📖 ${esc(ref.section || "")} · PDF p.${ref.pdf_page}${ref.para ? " · ¶" + ref.para : ""}`;
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

  html += `<h2>${t("chart_title")}</h2><div class="card"><div id="chart1"></div>
    <div class="note">${t("chart_note")(Math.round(m.mastery.master_min * 100), m.mastery.halflife_days, m.mastery.min_attempts)}</div></div>`;

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
    html += `<h2>${t("due_title")}</h2><div class="card">` +
      [...q.overdue, ...q.due].slice(0, 8).map(a => {
        const kpn = (a.kps || []).map(k => idx[k] ? idx[k].name : k).join("; ");
        return `<div class="att-head" style="padding:4px 0">
          <span class="chip ${a.review.next < today ? "err" : ""}">${a.review.next < today ? t("overdue_chip") : ""}${a.review.next}</span>
          <span>${esc(a.source && a.source.paper || a.source && a.source.type || "")} ${esc(a.source && a.source.q || "")}</span>
          <span class="kp-meta">${esc(kpn)}</span></div>`;
      }).join("") + `</div>`;
  }

  $("#app").innerHTML = html;
  const c1 = $("#chart1");
  if (c1) lineChart(c1, masteredSeries(), { yLabel: t("mastered_unit") });
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
        const meta = m.n ? `${m.n}${t("times")}${m.score != null ? " · " + fmtPct(m.score) : ""}` : "";
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

function attemptPanel(a, idx) {
  const c = DB.content[a.id];
  const errored = a.verdict !== "correct";
  const reviewedOn = getReviewed(a.id);
  const kpn = (a.kps || []).map(k => idx[k] ? `${k} ${idx[k].name}` : k);
  const links = c && c.qp_file
    ? `<div class="src-links">
         <a class="tbref" target="_blank" href="/${encodeURI(c.qp_file)}#page=${c.qp_page}">${t("open_qp")}</a>
         <a class="tbref" target="_blank" href="/${encodeURI(c.ms_file)}#page=${c.ms_page}">${t("open_ms")}</a>
       </div>` : "";
  const contentBlock = c
    ? `<div class="rv-field"><span class="rv-lbl">${t("lbl_question")}</span><div class="rv-val">${esc(c.q)}</div></div>
       <div class="rv-field"><span class="rv-lbl">${t("lbl_your_answer")}</span><div class="rv-val yours">${esc(c.ans)}</div></div>
       <div class="rv-field"><span class="rv-lbl">${t("lbl_markscheme")}</span><div class="rv-val ms">${esc(c.ms)}</div></div>
       ${links}`
    : `<div class="note">${t("content_local_only")}</div>`;
  const analysisBlock = (errored || a.analysis)
    ? `<div class="rv-field"><span class="rv-lbl">${t("lbl_analysis")}</span>
         <div class="rv-val">${a.error_type ? `<span class="chip err">${esc(errTxt(a.error_type))}</span> ` : ""}${esc(a.analysis || "")}</div>
         ${tbRef(a.textbook_ref, a.subject)}
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
    renderFoot();
    window.addEventListener("hashchange", route);
    route();
  } catch (err) {
    $("#app").innerHTML = `<div class="card">${t("load_fail")} ${esc(err.message)}<br><br>${t("load_help")}</div>`;
  }
})();
