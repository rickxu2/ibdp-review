---
name: paper
description: 开始一套计时真题练习——选卷、建练习会话、记录开始时间、交代考试规则。用户说"刷一套卷/做套题/开始做真题/practice a past paper"或点名某套卷（如"做 2025 May 化学 P2"）时使用。做完要批改时转 mark skill。
argument-hint: [科目] [场次/paper号，可省略让我推荐]
---

## 选卷
1. 读 [profile.md](../../../profile.md) 和 [papers/index.md](../../../papers/index.md)。
2. 用户指定了就用指定的；没指定则从 ⬜ 未做卷中推荐一套并说明理由：优先薄弱科目（profile 弱项 + 错题本堆积多的科目）。
3. **旧卷平时练，新卷留模考**：最近两个 session 的真题尽量留作考前全真模考，平时优先消耗更早年份。

## 开卷前必须核实（读试卷 PDF 第 1 页封面，不要凭记忆）
- 考试时长（封面写着如 "1 hour 30 minutes"）
- 关键规则：允不允许计算器、是否提供 data booklet/formula booklet、答题要求

## 建立会话
1. 建文件夹 `practice/YYYY-MM-DD_<科目缩写>_<session>_P<N>/`（日期用 Get-Date）。
2. 在其中写 `session.md`：试卷路径、MS 路径、限时、开始时间（Get-Date 取真实时间）、状态 = 进行中。
3. 把 index.md 中该卷状态改为 🔄。

## 交代清楚，然后退场
告诉用户：
- 试卷 PDF 的可点击路径、限时、计时已开始
- 交答案的三种方式任选：(a) 直接在对话里打字；(b) 写进会话文件夹的 `answers.md`；(c) 手写拍照丢进会话文件夹（我能读图）
- 做完说一声"做完了"即可

然后**结束回合，安静等用户做题**——不要自顾自开始讲题或剧透考点。

## 用户回来交卷时
用 Get-Date 记结束时间，算出实际用时写入 session.md（超时也如实记录，这个数据对备考很重要），然后按 mark skill 的流程批改。
