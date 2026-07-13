---
name: quiz
description: 主题小测——针对某科某个 topic 出 IB 风格的题目，一题一题考，批改并把错题入错题本。用户说"考考我 XX/出几道 XX 的题/quiz me on kinematics/练一下 Topic 5"时使用。刷整卷用 paper，复习旧错题用 drill，本 skill 专攻单个 topic 的定点训练。
argument-hint: <科目> <topic> [题数]
---

## 出题
1. 确定科目和 topic 范围；对照 `docs/data/syllabus/<subj>.json` 的知识点树出题（SL 不考的不出；`covered:false` 的未学内容不出，除非用户点名要预习）。
2. 默认 4 题，难度爬坡：1 题基础概念 → 2 题标准考法 → 1 题冲 7 分档的难题。用户指定题数则按指定。
3. **题目要像真题，不要像教科书习题**：
   - 用 IB command terms（State / Outline / Deduce / Hence / Show that / Sketch / Evaluate…），每题标分值和建议用时（约 1 分钟/分）。
   - 理科给真实感数据，卡有效数字和单位；数学注明 calculator / non-calculator；Econ 给现实情境和图。
   - papers/ 里如有该 topic 的真题且用户没做过 → 优先抽真题并注明出处，不够再自己编。
4. 自编题在出题时就先想好自己的 marking points，批改才有依据。

## 考法
一题一个回合：出题 → **结束回合等作答** → 按 markscheme 风格批改讲解 → 下一题。中途用户说"停"就直接进收尾。

## 收尾
- 小结：得分、暴露的问题（概念性的还是熟练度的）。
- 每道题按 mark skill 的 attempt schema 入库：`source.type: "quiz"`（真题则照实标 paper），失分题照常带 analysis/textbook_ref/review——quiz 的数据和刷卷数据在系统里完全平等。commit + push。
- 全对且答得轻松 → 建议升难度再来一轮，或直接去刷含该 topic 的整卷；错得多 → 给出课本对应节的 PDF 页码区间（textbook_map 里查），建议精读。
