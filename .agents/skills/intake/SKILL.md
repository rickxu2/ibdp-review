---
name: intake
description: 看守提交文件夹并自动批改——扫描 inbox/submissions/ 里新拍照/新答案，逐份按 mark skill 批改入库，处理完归档。用户说"处理我的提交/看一下 submissions/收作业"时使用；也可配 /loop 定时自动跑，实现"拍照丢进文件夹→自动批改上网"的无人值守流程。
argument-hint: [可选：指定某个文件]
---

## 这是 feature 2 的落地方式
公网静态网站的"上传按钮"无法启动 Codex，所以自动批改走**看守文件夹**：用户把手机照片（可经云盘同步）丢进 `inbox/submissions/`，本 skill 扫描并批改。配合 `/loop`（见下）即成无人值守。

## 流程
1. 列 `inbox/submissions/`（忽略 `processed/` 和 README）。按文件名或修改时间分组——**同一份练习的多张照片要合在一起批**（用户可命名如 `chem_2024May_P1_q3-5_*.jpg`，或丢进同名子文件夹）。每组先分配一个公开 `source.assignment_id`（`ASG-YYYYMMDD-NNN`），该组全部逐题 attempts 共用，绝不直接公开 submission UUID。
2. 每份需要知道：哪套卷/哪些题、对应 question paper、source/text booklet 和 markscheme。信息来源优先级：文件名/子文件夹名 > 图片里的卷头 > 问用户；资源查找同时覆盖 `papers/` 和提交元数据指向的私有资源库。开始批改前逐页确认题目依赖的材料齐全，不能只凭文件名或资源记录存在就视为完整。**MS 缺失、source/text booklet 缺页，或正文显示 `Removed for copyright reasons` 时，不得把受影响题目按空白或错误计分；从可作答分母中排除，并在结果中明确说明。**
3. 逐份按 [mark skill](../mark/SKILL.md) 全流程批改：给分、KP 标签、错因、课本归因、按客观/主观题分流生成反馈、写 attempts + **私有内容层** + push。主观题没有完成个性化建议与适用的 minimally edited/model response，不视为批改完成。
4. 处理完的原图移到 `inbox/submissions/processed/`（不删用户文件）。
5. 汇总：处理了几份、各得分、网站当日页链接；识别不了的留在原地并点名。

## 无人值守（/loop）
用户想"拍照就自动批改"时，让他开一个 Codex 会话跑：
```
/loop 10m /intake
```
每 10 分钟扫一次，有新提交就批改上网，没有就跳过。注意：**需要这个会话/电脑保持开着**——静态托管做不到真正的服务端触发，这是唯一诚实可行的自动化。不想常开电脑，就用手机 Codex.ai/code 连仓库手动发起。

## 铁律
沿用 mark skill 的全部规则：给分靠 markscheme、大 PDF 按页读、push 前 `git ls-files "*.pdf"` 和 `docs/data/private/*` 必须为空、看不清的手写先问再判。整卷手写、作文/开放题或任何低置信度识别必须执行 mark skill 的独立双读复核；复核未收敛就 Release，不自动 Complete。
