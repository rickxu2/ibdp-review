---
name: drill
description: 错题重练（间隔重复）——从数据库找出今天到期的复习条目，一题一题重新考用户，按结果推进或重置复习进度。用户说"复习错题/错题重练/drill/今天该复习什么"时使用；周计划里的错题时段也用它。
argument-hint: [科目，可省略=全部到期]
---

## 找题
1. 读 `docs/data/attempts/*.json`（清单在 meta.json），筛：`review` 非空 且 `review.done == false` 且 `review.next <= 今天`（Get-Date）。
2. 为空 → 报最近一批到期日，问要不要提前刷或按科目抽刷，不硬凑。
3. 默认一次最多 6 题，逾期最久优先；用户可指定科目/数量。

## 考法（一题一个回合）
- **concept / calculation 类：出变式题**——同考点换数字换情境（原题可能已被背住，变式才检验真会）。**misread / expression / time 类：用原题**——错的是习惯，在原题上验证。
- 流程：出题（标分值）→ **结束回合等作答** → 按 markscheme 风格批改讲解 → 更新记录 → 下一题。不要一次贴出全部题目。

## 每题批改后立即更新该记录的 review 字段
- **过了**：`stage` +1；`stage` 达到 5 → `done: true`（毕业）；否则 `next` = 今天 + 间隔（stage 1→3天, 2→7天, 3→14天, 4→30天）。
- **没过**：`stage` 归 0，`next` = 明天；把新暴露的问题补进该记录的 `analysis`。
- 两种情况都往 `history` 追加 `{"date":"…","pass":true/false}`。
- 只动 `review`/`analysis` 字段，不改当初的得分——历史就是历史。

## 收尾
1. json.tool 验证 → commit + push（`data: drill 6题 5过1重置`）。
2. 汇总：几过几重置；**连续两轮不过的考点点名**（建议回课本对应页精读或 /quiz 专练）；下一批到期日。
