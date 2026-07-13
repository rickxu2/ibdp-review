---
name: ingest
description: 归档新真题——把 inbox/ 里下载的 IB 真题 ZIP 或散装 PDF 解压、重命名、归入 papers/ 并更新索引。只要用户说"归档/整理真题/我下了新卷子/ingest"，或提到刚从 pirateib 下载了东西、或发现 inbox/ 里有未处理文件，就使用本 skill。
argument-hint: [可选：只处理指定文件]
---

## 目标
inbox/ 是真题进入题库的唯一入口：用户把下载件丢进去，你把它们变成规范题库。规范的意义在于让 /paper、/mark 能靠路径直接定位卷子和答案，所以归位的准确性比速度重要。

## 步骤
1. 列出 inbox/ 内容（忽略 processed/ 子文件夹）。ZIP 先用 `Expand-Archive` 解压到 scratchpad 临时目录再处理。
2. 识别每个文件的元信息（科目、年份、月份、TZ、paper 号、级别、试卷还是答案）。信息优先级：**文件名 > ZIP 内文件夹路径 > ZIP 文件名**。
   - 本站命名：`25M_Chemistry_paper_2_TZ1_SL_markscheme.pdf`（`25M` = 2025 May；`N` = November，Nov 无 TZ）
   - IB 官方原始命名也可能出现：`Chemistry_paper_2__TZ1_SL.pdf`
   - `_markscheme` = 答案；无此后缀 = 试卷（`_1` 之类的杂尾忽略）
   - 语言变体 `_FRE`/`_SPA` 直接跳过（考试用英文卷）
3. 归位并重命名：
   `papers/<Subject>_<Level>/<YYYY>_<May或Nov>[_TZn]/paper_<N>[_ms].pdf`
   例：`papers/Chemistry_SL/2025_May_TZ1/paper_2_ms.pdf`
   - 附属文件用说明性名字：`data_booklet.pdf`、`case_study.pdf`、`paper_2_audio.mp3`（English B 听力）
   - 不在 profile.md 科目里的卷子照样归档，汇报时提一句
   - 实在识别不了的放 `papers/_unsorted/`，汇报时列出来
4. 更新 [papers/index.md](../../../papers/index.md)：每份试卷一行，答案归到同一行的 MS 列，新卷状态 ⬜，严格匹配既有表格列。
5. 处理完的 ZIP 移到 `inbox/processed/`（不要删用户的下载件，让用户自己决定何时清理）；散装 PDF 归位即算处理完。
6. 汇报：本次入库多少试卷、多少答案，按科目列出；**缺答案的试卷单独点名**（没有 MS 的卷子批改质量会打折，用户可能想补下）。

## 注意
- 同一卷子已存在 → 跳过并说明，不要覆盖（旧文件里可能有批注）。
- 路径含空格（"Rick Xu"），所有 PowerShell 命令记得加引号。
