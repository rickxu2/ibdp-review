---
name: mark
description: 按 IB markscheme 批改并写入数据库——逐题给分、打知识点标签、错题归因到课本页码、追加 attempt 记录、推送更新网站。用户交答案、说"批改/改卷/mark/我做完了/今天做了几道题"时使用，整卷和零散题都算。这是整个复习系统的数据引擎，所有做题结果必须经它入库。
argument-hint: [可选：练习文件夹或题目说明]
---

## 输入
1. 定位来源：practice/ 里最新的 🔄 会话，或用户指定，或零散题目（无会话直接改）。
2. 收集答案（三处都查）：对话文字、会话文件夹 `answers.md`、文件夹里的照片（Read 读图）。手写辨认要仔细，**看不清的关键字符先问用户，不要因笔迹误判扣分**。
3. 打开对应 markscheme：路径在 session.md 或 papers/index.md。普通 PDF 用 Read 带 pages 按需读页；>100MB 用 python/pypdf 抽页。

## 批改原则（严格但讲理的 examiner）
- 每一分都要指向 MS 里的 marking point，不凭感觉。
- 理科/数学：M(method)/A(accuracy)/R(reasoning)；A 分依赖对应 M 分；**ECF/FT** 按 MS 标注执行（经常能挽回分，别漏）；Misread 扣 1 后 FT；有效数字、单位、"Show that" 完整性按 MS 惯例页。
- Essay 类：按 markband 定档，引用档位描述语说明"为什么是这档而不是上一档"。
- 拿不准的分：给宽严两判并说明 examiner 更可能的判法，记录里标 `"uncertain": true`。

## 每道题生成一条 attempt 记录（系统的原子单位）
```json
{
  "id": "A-20260713-001",
  "date": "2026-07-13",
  "subject": "chem_sl",
  "source": { "type": "paper", "paper": "2025_May_TZ1_P2", "q": "3b" },
  "kps": ["R1.2.b"],
  "command_term": "Calculate",
  "max": 3, "earned": 1,
  "verdict": "partial",
  "error_type": "概念",
  "analysis": "为什么错：把键焓计算的符号约定记反了（断键吸热为正）……",
  "textbook_ref": { "section": "R1.2", "pdf_page": 421, "para": 2, "quote": "bond enthalpy is the energy required to break one mole" },
  "review": { "stage": 0, "next": "2026-07-14", "done": false, "history": [] },
  "uncertain": false
}
```
字段规则：
- `id` = A-日期-当日序号（查同日已有记录取下一号）；日期用 Get-Date。
- `kps`：从 `docs/data/syllabus/<subj>.json` 选**已存在的 id**（1–3 个，主考点在前）。没有合适的 → 用最接近的并在对话里提出，需要时先给 syllabus 加 KP 再引用。做到的 KP 若原 `covered:false` 说明已学过 → 顺手改 true。
- `verdict`：correct（满分）/ partial / wrong（0 分）。
- `source.type`：paper / quiz / textbook / other。
- 满分题：`error_type`、`textbook_ref`、`review` 置 null，`analysis` 可一句带过或省略。
- 失分题必填 `analysis`（为什么错，写给两个月后的自己）、`error_type`（概念/计算/审题/表达/时间）、`textbook_ref`、`review`（固定初值 `{"stage":0,"next":"明天","done":false,"history":[]}`）。

## 课本归因（textbook_ref）
1. 查 `docs/data/textbook_map/<subj>.json`：KP 所属 subtopic 的 `pdf_start`–`pdf_end` 区间；`kp_overrides` 里有精确页就直接用。
2. 没有精确页时：用 pypdf 在该区间内检索关键词定位到页，读该页文本确认段落号；**把结果回写 `kp_overrides`**（懒建缓存，同一考点第二次零成本）。区间内实在定位不到就填 `pdf_start` 页并注明 "节首"。
3. `quote` ≤15 个英文词（课本受版权保护，只存定位用短引）。
4. `textbook_ref` 的 `file` 字段可省略——网站会自动用该科 textbook_map 的书；只有引用了别的书（如 Haese 数学第二册之外的）才需要显式填 `file`。

## 写库（顺序固定）
1. 记录追加到 `docs/data/attempts/YYYY-MM.json`（新月份：建 `[]` 文件 + 加进 meta.json 的 `attempt_files`）。
2. `python -m json.tool` 验证改过的每个 JSON。
3. 整卷练习：写人类可读的 `report.md` 到会话文件夹（逐题表+3条改进建议+用时分析）；更新 papers/index.md（✅+得分）。
4. `git add -A` → **`git ls-files "*.pdf"` 输出必须为空**（版权红线复查）→ commit（`data: chem_sl 2025May P2 Q1-8 (+8 records)`）→ push。

## 回给用户的摘要
总分/百分比、估计等级（标注"单卷估算"）、失分点一览、最值钱的 1–3 条建议、网站当日页链接。图表细节不用复述——网站会算。
