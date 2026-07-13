/* IBDP Review — 纯前端，零构建。数据源：data/*.json（由 Claude 维护，原始记录唯一真源）
   所有聚合（掌握度/曲线）在此实时计算，绝不落盘。 */
"use strict";

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

/* ───────── theme ───────── */
const themeBtn = $("#themeBtn");
const applyTheme = t => { t ? document.documentElement.setAttribute("data-theme", t) : document.documentElement.removeAttribute("data-theme"); };
applyTheme(localStorage.getItem("ibdp-theme") || "");
themeBtn.onclick = () => {
  const cur = localStorage.getItem("ibdp-theme") || "";
  const next = cur === "" ? "dark" : cur === "dark" ? "light" : "";
  next ? localStorage.setItem("ibdp-theme", next) : localStorage.removeItem("ibdp-theme");
  applyTheme(next);
};

/* ───────── data ───────── */
const DB = { meta: null, syllabus: {}, tbmap: {}, attempts: [] };

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
}

/* KP 索引：id → {name, subtopicId, subtopicName, topicName, covered, subject} */
function kpIndex() {
  const idx = {};
  for (const [subj, syl] of Object.entries(DB.syllabus)) {
    for (const t of syl.topics) for (const st of t.subtopics) for (const kp of st.kps) {
      idx[kp.id] = { ...kp, subject: subj, subtopicId: st.id, subtopicName: st.name, topicName: t.name };
    }
  }
  return idx;
}

/* ───────── mastery（口径唯一定义处）─────────
   加权正确率 = Σ(w·earned/max)/Σw，w = 分值 × 0.5^(距今天数/半衰期)
   状态：未学(covered:false) / 未练(0次) / 薄弱(<ok_min) / 一般 / 掌握(≥master_min 且 ≥min_attempts)
   回潮：撇开最近一次本已达"掌握"，最近一次却非满分 → regressed */
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

const STATE_TXT = { mastered: "掌握", ok: "一般", weak: "薄弱", unpracticed: "未练", not_covered: "未学", regressed: "回潮" };
const stateChip = st => `<span class="chip state s-${st}">${STATE_TXT[st]}</span>`;

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

/* ───────── SVG line chart（单系列，含 crosshair+tooltip 悬停层）───────── */
function lineChart(container, pts, { yLabel = "", fmt = v => v } = {}) {
  if (pts.length < 2) { container.innerHTML = `<div class="empty">数据还不够画曲线（至少两天记录）</div>`; return; }
  const W = 720, H = 250, L = 44, R = 14, T = 14, B = 30;
  const xs = pts.map(p => +new Date(p.date + "T00:00"));
  const ys = pts.map(p => p.value);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const yMax = Math.max(4, Math.max(...ys));
  const X = v => L + (v - x0) / (x1 - x0 || 1) * (W - L - R);
  const Y = v => H - B - v / yMax * (H - T - B);
  const yTicks = []; const step = Math.max(1, Math.ceil(yMax / 4));
  for (let v = 0; v <= yMax; v += step) yTicks.push(v);
  const xTickN = Math.min(6, pts.length);
  const xTicks = Array.from({ length: xTickN }, (_, i) => x0 + (x1 - x0) * i / (xTickN - 1));
  const path = pts.map((p, i) => `${i ? "L" : "M"}${X(xs[i]).toFixed(1)},${Y(p.value).toFixed(1)}`).join("");
  const fdate = ms => { const d = new Date(ms); return `${d.getMonth() + 1}/${d.getDate()}`; };

  container.innerHTML = `
  <div class="chartwrap">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(yLabel)}走势">
      ${yTicks.map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--grid)" stroke-width="1"/>
        <text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${fmt(v)}</text>`).join("")}
      <line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" stroke="var(--axis)" stroke-width="1"/>
      ${xTicks.map(ms => `<text x="${X(ms)}" y="${H - B + 18}" text-anchor="middle" font-size="11" fill="var(--muted)">${fdate(ms)}</text>`).join("")}
      <path d="${path}" fill="none" stroke="var(--series-1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <line id="ch-x" y1="${T}" y2="${H - B}" stroke="var(--axis)" stroke-width="1" visibility="hidden"/>
      <circle id="ch-dot" r="4.5" fill="var(--series-1)" stroke="var(--surface)" stroke-width="2" visibility="hidden"/>
      <rect id="ch-hit" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent"/>
    </svg>
    <div class="tooltip" id="ch-tip"></div>
  </div>`;

  const svg = container.querySelector("svg"), hit = container.querySelector("#ch-hit"),
    cx = container.querySelector("#ch-x"), dot = container.querySelector("#ch-dot"),
    tip = container.querySelector("#ch-tip"), wrap = container.querySelector(".chartwrap");
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

/* 掌握数走势：按天回放（>120 天改为每周采样） */
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
    const n = idx.filter(kp => masteryOf(kp.id, true, ds).state === "mastered").length;
    out.push({ date: ds, value: n });
    if (ds >= todayStr()) break;
    if (out.length > 400) break;
  }
  return out;
}

/* ───────── textbook ref chip ───────── */
function tbRef(ref, subject) {
  if (!ref) return "";
  const file = ref.file || (DB.tbmap[subject] && DB.tbmap[subject].file);
  const label = `📖 ${esc(ref.section || "")} · PDF p.${ref.pdf_page}${ref.para ? " · 第" + ref.para + "段" : ""}`;
  if (IS_LOCAL && file) {
    return `<a class="tbref" target="_blank" href="/${encodeURI(file)}#page=${ref.pdf_page}">${label} ↗</a>`;
  }
  return `<span class="tbref dead" title="课本 PDF 只在本地版可打开（运行 scripts/serve.ps1）">${label}</span>`;
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

  let html = `<h2>今日</h2><div class="tiles">`;
  if (mock) html += `<div class="tile"><div class="t-label">距模考（定预估分）</div><div class="t-value">${dayDiff(mock.date, today)}<small> 天</small></div><div class="t-sub">${mock.date}${mock.estimate ? " ·约" : ""}</div></div>`;
  html += `<div class="tile"><div class="t-label">距 May 2027 大考</div><div class="t-value">${dayDiff(m.exams_start, today)}<small> 天</small></div><div class="t-sub">${m.exams_start}${m.exams_start_estimate ? " ·约" : ""}</div></div>`;
  html += `<div class="tile ${q.overdue.length ? "alert" : ""}"><div class="t-label">错题复习</div><div class="t-value">${q.due.length + q.overdue.length}<small> 道到期</small></div><div class="t-sub">${q.overdue.length ? "其中逾期 " + q.overdue.length + " 道" : "无逾期"}</div></div>`;
  html += `<div class="tile"><div class="t-label">累计记录</div><div class="t-value">${DB.attempts.length}<small> 题</small></div><div class="t-sub">加权得分率 ${totMax ? Math.round(totEarned / totMax * 100) + "%" : "–"}</div></div>`;
  html += `</div>`;

  if (!DB.attempts.length) {
    html += `<div class="card" style="margin-top:14px">还没有做题数据。把今天完成的题目交给 Claude 批改（/mark），第一批数据入库后这里就会活起来。</div>`;
    $("#app").innerHTML = html;
    return;
  }

  html += `<h2>掌握知识点数走势</h2><div class="card"><div id="chart1"></div>
    <div class="note">掌握 = 按分值加权正确率 ≥ ${Math.round(m.mastery.master_min * 100)}%（含 ${m.mastery.halflife_days} 天半衰期时间衰减）且练习 ≥ ${m.mastery.min_attempts} 次。口径与"知识点"页一致。</div></div>`;

  html += `<h2>各科概况</h2>`;
  for (const [id, s] of Object.entries(m.subjects)) {
    if (!s.active) continue;
    const sub = states.filter(x => x.kp.subject === id);
    const cnt = st => sub.filter(x => x.m.state === st).length;
    const rel = DB.attempts.filter(a => a.subject === id);
    const sm = rel.reduce((x, a) => x + a.max, 0), se = rel.reduce((x, a) => x + a.earned, 0);
    html += `<div class="card"><b>${esc(s.name)} ${s.level}</b>
      <span class="kp-meta" style="margin-left:8px">${rel.length} 题 · 得分率 ${sm ? Math.round(se / sm * 100) + "%" : "–"}</span>
      <div class="legend" style="margin:8px 0 0">
        ${stateChip("mastered")} ${cnt("mastered")}　${stateChip("ok")} ${cnt("ok")}　${stateChip("weak")} ${cnt("weak")}
        ${cnt("regressed") ? "　" + stateChip("regressed") + " " + cnt("regressed") : ""}
        　<span class="chip s-unpracticed state">未练</span> ${cnt("unpracticed")}　<span class="chip s-not_covered state">未学</span> ${cnt("not_covered")}
      </div>
      <div style="margin-top:8px"><a href="#/matrix/${id}">查看知识点矩阵 →</a></div></div>`;
  }
  const inactive = Object.values(m.subjects).filter(s => !s.active).map(s => `${s.name} ${s.level}`);
  if (inactive.length) html += `<div class="note">待接入：${esc(inactive.join(" · "))}（有做题需求时让 Claude 建对应知识点树即可）</div>`;

  if (q.due.length + q.overdue.length) {
    const idx = kpIndex();
    html += `<h2>到期复习（/drill 清账）</h2><div class="card">` +
      [...q.overdue, ...q.due].slice(0, 8).map(a => {
        const kpn = (a.kps || []).map(k => idx[k] ? idx[k].name : k).join("; ");
        return `<div class="att-head" style="padding:4px 0">
          <span class="chip ${a.review.next < today ? "err" : ""}">${a.review.next < today ? "逾期 " : ""}${a.review.next}</span>
          <span>${esc(a.source && a.source.paper || a.source && a.source.type || "")} ${esc(a.source && a.source.q || "")}</span>
          <span class="kp-meta">${esc(kpn)}</span></div>`;
      }).join("") + `</div>`;
  }

  $("#app").innerHTML = html;
  const c1 = $("#chart1");
  if (c1) lineChart(c1, masteredSeries(), { yLabel: "个已掌握" });
}

function pageMatrix(subj) {
  const active = Object.entries(DB.meta.subjects).filter(([, s]) => s.active);
  if (!subj || !DB.syllabus[subj]) subj = active[0] && active[0][0];
  const syl = DB.syllabus[subj];
  if (!syl) { $("#app").innerHTML = `<div class="empty">还没有接入任何科目的知识点树</div>`; return; }
  const today = todayStr();
  const tbm = DB.tbmap[subj];

  let html = `<h2>知识点掌握度</h2><div class="subject-tabs">` +
    active.map(([id, s]) => `<a href="#/matrix/${id}" class="${id === subj ? "on" : ""}">${esc(s.name)} ${s.level}</a>`).join("") + `</div>`;

  const states = [];
  html += `<div class="legend">${["mastered", "ok", "weak", "regressed", "unpracticed", "not_covered"].map(stateChip).join(" ")}</div>`;

  for (const t of syl.topics) {
    html += `<div class="topic-block"><h3>${esc(t.name)}</h3>`;
    for (const st of t.subtopics) {
      const range = tbm && tbm.subtopics && tbm.subtopics[st.id];
      const pref = range
        ? (IS_LOCAL
          ? `<a class="pageref" target="_blank" href="/${encodeURI(tbm.file)}#page=${range.pdf_start}">📖 PDF p.${range.pdf_start}–${range.pdf_end} ↗</a>`
          : `<span class="pageref">📖 PDF p.${range.pdf_start}–${range.pdf_end}</span>`)
        : "";
      html += `<div class="subtopic"><h4>${esc(st.id)} · ${esc(st.name)} ${pref}</h4>`;
      for (const kp of st.kps) {
        const m = masteryOf(kp.id, kp.covered, today);
        states.push(m.state);
        const meta = m.n ? `${m.n} 次${m.score != null ? " · " + fmtPct(m.score) : ""}` : "";
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
          : `<div class="att">还没做过这个考点的题</div>`;
        box.style.display = "block";
      } else box.style.display = "none";
    };
  });
}

function pageDays() {
  const byDate = {};
  for (const a of DB.attempts) (byDate[a.date] = byDate[a.date] || []).push(a);
  const dates = Object.keys(byDate).sort().reverse();
  if (!dates.length) { $("#app").innerHTML = `<div class="empty">还没有做题记录</div>`; return; }
  $("#app").innerHTML = `<h2>每日记录</h2><div class="day-list">` + dates.map(d => {
    const arr = byDate[d];
    const e = arr.reduce((s, a) => s + a.earned, 0), mx = arr.reduce((s, a) => s + a.max, 0);
    const subs = [...new Set(arr.map(a => DB.meta.subjects[a.subject] ? DB.meta.subjects[a.subject].name : a.subject))];
    const wrong = arr.filter(a => a.verdict !== "correct").length;
    return `<a class="day-item" href="#/day/${d}"><span class="d-date">${d}</span>
      <span>${arr.length} 题 · ${e}/${mx}（${mx ? Math.round(e / mx * 100) : 0}%）</span>
      <span class="d-meta">${esc(subs.join(" · "))}${wrong ? " · 失分 " + wrong + " 题" : " · 全对 ✓"}</span></a>`;
  }).join("") + `</div>`;
}

function pageDay(date) {
  const arr = DB.attempts.filter(a => a.date === date);
  if (!arr.length) { $("#app").innerHTML = `<div class="empty">${esc(date)} 没有记录</div>`; return; }
  const idx = kpIndex();
  const e = arr.reduce((s, a) => s + a.earned, 0), mx = arr.reduce((s, a) => s + a.max, 0);
  let html = `<h2>${esc(date)}　<span class="kp-meta">${arr.length} 题 · ${e}/${mx}（${mx ? Math.round(e / mx * 100) : 0}%）</span></h2>
    <div style="margin-bottom:10px"><a href="#/days">← 全部日期</a></div><div class="card">`;
  for (const a of arr) {
    const kpn = (a.kps || []).map(k => idx[k] ? `${k} ${idx[k].name}` : k);
    html += `<div class="attempt">
      <div class="att-head">
        <span class="att-src">${esc(a.source && (a.source.paper || a.source.type) || "")} ${esc(a.source && a.source.q ? "Q" + a.source.q : "")}</span>
        ${a.command_term ? `<span class="chip">${esc(a.command_term)}</span>` : ""}
        <span class="att-marks">${a.earned}/${a.max}</span>
        <span class="chip v-${a.verdict}">${a.verdict === "correct" ? "✓ 全对" : a.verdict === "partial" ? "部分" : "✗ 错"}</span>
        ${a.uncertain ? `<span class="chip">给分待议</span>` : ""}
      </div>
      <div class="kp-meta" style="margin-top:4px">${kpn.map(esc).join("　")}</div>`;
    if (a.verdict !== "correct") {
      html += `<div class="att-body">
        ${a.error_type ? `<span class="chip err">${esc(a.error_type)}</span>` : ""}
        ${a.analysis ? `<div class="why">${esc(a.analysis)}</div>` : ""}
        ${tbRef(a.textbook_ref, a.subject)}
        ${a.review && !a.review.done ? `<div class="review-note">复习进度 ${a.review.stage}/5 · 下次 ${esc(a.review.next)}</div>`
          : a.review && a.review.done ? `<div class="review-note">✅ 复习毕业（5 轮通过）</div>` : ""}
      </div>`;
    } else if (a.analysis) {
      html += `<div class="att-body"><div class="why">${esc(a.analysis)}</div></div>`;
    }
    html += `</div>`;
  }
  html += `</div>`;
  $("#app").innerHTML = html;
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

(async () => {
  try {
    await loadAll();
    const last = DB.attempts.length ? DB.attempts[DB.attempts.length - 1].date : "–";
    $("#footInfo").textContent = `${IS_LOCAL ? "本地完整版（课本可跳转）" : "公网版（课本跳转需本地站）"} · ${DB.attempts.length} 条记录 · 最近做题 ${last}`;
    window.addEventListener("hashchange", route);
    route();
  } catch (err) {
    $("#app").innerHTML = `<div class="card">数据加载失败：${esc(err.message)}<br><br>
      • 本地查看：运行 <code>scripts\\serve.ps1</code>，然后打开 <a href="http://localhost:8788/docs/">http://localhost:8788/docs/</a>（直接双击 index.html 是读不到数据的）<br>
      • 或访问 GitHub Pages 线上版</div>`;
  }
})();
