---
name: mistake
description: 手动记一道错题进数据库——课上做错的、作业里没把握的、突然意识到的概念漏洞，都可以随手入库进入间隔复习循环。用户说"记一下这道错题/这题我错了/把这个记进错题本"时使用。/mark 批改产生的错题会自动入库，不需要再用本 skill。
argument-hint: [题目来源或直接粘贴题目]
---

## 流程
1. 问清/收集：题目原文（完整，含数据）、用户当时的做法、正确解法、来源（哪本书/哪张卷/课堂）。
2. 按 mark skill 定义的 attempt 记录 schema 写一条记录，特殊约定：
   - `source.type`: textbook / other（按实际）；`q` 填自由描述。
   - 没有正式分值的题：`max` 按题目合理估（如一个概念点 = 1），`earned: 0`，`verdict: "wrong"`。
   - `kps`、`error_type`、`analysis`、`textbook_ref`、`review` 全部照常必填——手动记的错题和批改产生的错题在系统里完全平等。
3. 追加到 `docs/data/attempts/YYYY-MM.json`，json.tool 验证，commit + push（`data: <subj> manual mistake +1`）。
4. 回复：已入库的 KP 标签、明天开始的复习计划、课本对应页。
