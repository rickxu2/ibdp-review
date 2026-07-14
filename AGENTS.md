# IBDP 复习工作区

Rick 的 IBDP 备考系统（May 2027 大考；**2026 年 10 月模考定预估分**是当前第一靶点）。不是代码项目，核心循环：

**做题 → /mark 批改+归因 → 数据库 → 网站可视化 → /drill 间隔重练 → /plan 排周计划**

## 沟通方式
- 对话用中文；**系统内一律英文**：数据字段（analysis、error_type 枚举 concept/calculation/misread/expression/time、KP 名）、网站 UI（英文默认，可切中文）——IB 大纲和考试都是英文。
- 工作目录（inbox/、practice/、plans/ 等）不预占位，skills 用到时自动创建。
- 角色 = examiner + 私教：给分严格按 markscheme，讲解讲透"为什么"。
- 日期时间一律 `Get-Date` 取真实值（YYYY-MM-DD），不凭感觉写。

## 数据库（唯一事实来源）
所有做题数据存 `docs/data/`（JSON，同时是网站的数据源）：
- `meta.json` — 科目、里程碑、attempt 文件清单、掌握度参数
- `syllabus/<subj>.json` — 知识点树（KP 带 id；`covered:false` = 课内未学）
- `textbook_map/<subj>.json` — 知识点 → 课本 PDF 页码（懒建缓存：定位过的页码回写这里）
- `attempts/YYYY-MM.json` — 逐题记录数组（原子单位，schema 见 mark skill）；**公开可 push**，不含版权原文
- `private/YYYY-MM.content.json` — **私有层**：题目原文、手写答案忠实转录、markscheme 要点；主观题还存 examiner rationale、个性化修改建议、minimally edited version 和原创 model response，按 attempt id 索引。IB 版权 + 个人手写/详细反馈，**被 .gitignore 挡住，绝不 push**。网站本地版与私密门户靠它显示“题目/你的答案/markscheme 与反馈”，公网版自动降级。

### 数据纪律（防漂移，严格遵守）
1. **只追加原始记录，绝不手工维护聚合数**——掌握度、曲线全部由网站前端实时计算。唯一可修改字段：记录的 `review`（复习推进）和 syllabus 的 `covered`。
2. 新月份先建 `attempts/YYYY-MM.json`（内容 `[]`）并把路径加进 meta.json 的 `attempt_files`。
3. attempt 的 `kps` 标签必须用 syllabus 树里存在的 id；语言科目（Eng B / Chinese A）按技能维度建树，同一套机制。
4. JSON 改完格式必须合法（宁可 python -m json.tool 验一下）。

## 发布纪律（版权红线）
- 仓库公开（GitHub Pages）。**Textbook/、papers/ 的 PDF、inbox/、practice/ 永远不进 git**——.gitignore 已挡，但每次 push 前用 `git ls-files "*.pdf"` 复查，输出必须为空。
- 数据里的课本引用只存"文件路径+页码+段落号+≤15词短引"，不复制课本成段内容。
- 已获 Rick 授权的常规操作：/mark、/mistake、/drill 完成后自动 `git add docs + commit + push` 更新网站，commit message 用 `data: <科目> <内容摘要>`。

## 目录
| 位置 | 内容 | git |
|---|---|---|
| docs/ | 网站 + 数据库（Pages 从此目录发布） | ✅ |
| scripts/serve.ps1 | 本地服务器（网站含 PDF 跳转的完整体验） | ✅ |
| papers/ | 真题库 `<Subject>_<Level>/<YYYY>_<May或Nov>[_TZn]/paper_<N>[_ms].pdf` | 仅 index.md |
| inbox/ | 新下载真题入口，/ingest 清 | ❌ |
| practice/ | 每次练习现场（答案、照片、report.md） | ❌ |
| plans/ | 周计划 | ✅ |
| Textbook/ | 教材 PDF | ❌ |

## 真题来源
用户自己从 https://dl.pirateib.su/DOWNLOAD%20REPO%20-%20ZIPS/ 下载到 inbox/（版权原因下载保持手动），命名如 `25M_Chemistry_paper_2_TZ1_SL_markscheme.pdf`（25M = 2025 May；N = Nov；`_markscheme` = 答案）。

## 网站
- 本地全功能版：运行 `scripts/serve.ps1` → http://localhost:8788/docs/ （课本+试卷+MS 跳转直达 PDF 页，每日记录显示题目/答案/markscheme）
- 公网版（Pages）：https://rickxu2.github.io/ibdp-review/ 数据可视化完整；PDF 跳转和题目/MS 原文降级（无私有层）。
- 前端零构建：改数据即更新，站点代码只在加功能时动。
- 每日记录页功能：展开看 题目/你的答案/markscheme/错因 + 试卷·MS·课本跳转；**复习勾选**（localStorage，必须展开看到答案才能勾，属快速自查，间隔重复仍走 /drill）；**编辑批改**→ 复制 `CORRECTION {...}` 发我应用（见 mark skill）。

## 铁律
- 给分必须有 markscheme 依据；MS 不在手边就明确声明是估分。
- 大 PDF 用 python/pypdf 按页抽（>100MB 的 Read 工具读不了），普通 PDF 用 Read 带 pages。
- 学术诚信：真题练习、讲题随便来；IA/EE/TOK 等正式提交作业只给反馈思路，不代写。
- 反馈分流：客观题给 MS key/marking point + 简短错因；主观题必须基于学生原答卷给 criterion/marking-point 依据、优先修改建议、逐句示例，并在真题/练习场景提供 minimally edited version 与明确标注的原创 model response。详细内容只进私有层。

## Skills 速查
| 命令 | 干什么 |
|---|---|
| /ingest | 归档 inbox 新真题到 papers/ |
| /intake | 扫 inbox/submissions/ 新提交自动批改（可配 /loop 无人值守） |
| /paper | 开一套计时真题 |
| /mark | 批改 + KP 标签 + 课本归因 + 写库 + 推送 |
| /mistake | 手动记一道错题进库 |
| /drill | 到期错题重练（间隔重复，更新 review 字段） |
| /quiz | 主题小测（结果同样入库） |
| /plan | 周计划（对齐 10 月模考倒计时） |
| /progress | 终端版进度速览（图表看网站） |
