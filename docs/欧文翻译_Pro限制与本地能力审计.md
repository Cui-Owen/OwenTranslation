# 欧文翻译 0.3：Pro 限制与本地能力审计

审计日期：2026-10-23。对象：当前 `extension/`（1.34.3 + Owen 0.3）、`upstream/` 裁剪前品牌版基线、构建补丁及官方功能文档。本次只整理和核验，没有修改功能代码。

## 实施状态（2026-10-23 更新）

第 6 节第 1–5 项中的本地门禁已由 [`scripts/patch-unlock.cjs`](../scripts/patch-unlock.cjs) 解除，测试见 [`tests/test-unlock.cjs`](../tests/test-unlock.cjs)。账号层仍为 `isPro=false`，原厂付费分支保持关闭。

| 项目 | 状态 | 实施方式 |
|---|---|---|
| YouTube 直播 1 分钟限制 | 已完成 | YouTube `checkLiveSubtitleTrialLimit` 改为放行；直播升级菜单与“仅会员”标题隐藏 |
| 文章术语自动抽取 | 已完成 | 五个 bundle 的 `Cc` 去掉 `isPro` 条件；侧栏开关去门禁；options `e3e` 设置组件恢复，去掉 Pro 标识与升级文案 |
| 字幕本地导出 | 已完成 | `Wdt` 删除 `Ga()` 拦截；`Xhe` 改为页内对话框，导出双语/译文/原文 × SRT/VTT（UTF-8 BOM，Blob 下载） |
| 智能上下文 | 已完成 | `ip()` 去掉会员与 token 条件；原厂 POST 换成 `jo()` 构造的所选 AI 服务 `sendMessage()`，返回 JSON 校验后进入原缓存与 Prompt 注入；content/popup 开关与 options 字段去门禁 |
| 字幕 Prompt 字段 | 已完成 | options `dae` 不再隐藏 `subtitlePrompt` |
| 原厂 AI 断句开关 | 已隐藏 | options `EFe` 中依赖原厂 ASR 的开关隐藏；YouTube 分句使用 Magpie |
| 本地专家目录 | 未做 | 运行时仍读取 `customAiAssistants`，管理界面未恢复 |
| OCR / ASR | 未做 | 需新增处理链，不属于解除门禁 |

验证：`npm test` 全部通过（含 6 项解锁检查，均在构建产物的真实函数上执行）；真实 Edge 回归 37/37 通过，无原厂域名请求。尚未在真实 YouTube 直播、真实文章术语抽取或真实模型摘要上实测。

## 结论

**当前版仍有会员判断阻挡已经保留的本地能力。优先处理 YouTube 直播一分钟限制、文章术语自动抽取、字幕本地导出。Magpie AI 断句已经脱离原厂会员和服务器，不需要再次解锁。**

智能上下文属于另一类：开关、摘要缓存、Prompt 注入在客户端，但摘要生成仍依赖原厂接口和登录 token。只改会员判断不能工作，需要把摘要请求接入自己的模型。

无字幕视频识别、Pro 图片/漫画、PDF Pro、原厂托管模型和云同步存在真实的外部服务依赖。当前包不包含这些原厂后端；其中多数功能可以另接本地模型或自建服务，但这是补实现，不是解除现有开关。

“本地”分三层：扩展内算法、调用 localhost 的适配器、模型在本机推理。Magpie 已实现前两层；默认模型名为 `auto/gemini-3.8-flash`，仅凭 localhost 地址不能认定第三层成立。

## 1. 对比材料与版本边界

- 当前发布目录是 `extension/`；`upstream/` 是品牌与 Magpie 改造后的 1.34.3 基线，不是完整原厂开发仓库。品牌记录标明 background、offscreen、PDF bridge、Tesseract 等 JavaScript 保持字节一致，其他大包记录了品牌组件变更，因此可针对未改业务函数对比。
- 官方 GitHub 仓库用于发布和反馈；官方说明当前产品未开源，公开旧代码停留在 2023 年。不能拿旧开源版推断 1.34.3 的 Pro 调用链。[官方仓库说明](https://github.com/immersive-translate/immersive-translate#关于这个仓库)
- 官网当前套餐用于核对商业权益；本报告中“当前欧文翻译是否受限”以当前安装包函数为准。官网动态价格表不反推旧版本代码。
- 可读代码证据：[`local-content_main.js`](../work/pro-audit/temporary/local-content_main.js)、[`local-options.js`](../work/pro-audit/temporary/local-options.js) 是当前包格式化读本；[`remote-evidence.js`](../work/pro-audit/remote-evidence.js) 从基线按 AST 提取函数，注释保留原文件与字节位置。原始执行包未修改。

## 2. 当前还受限制、能够本地处理的项目

| 功能 | 当前实际状态 | 能否直接解除 | 应做的改动 |
|---|---|---|---|
| Magpie 视频 AI 断句 | 独立设置、缓存和请求协议；非 Pro 可进入；原厂服务器合并分支已关闭 | **已经解除** | 保持独立能力。配置可用的本机分句服务即可；译文服务另行配置 |
| YouTube 直播已有字幕翻译 | 仍有 `checkLiveSubtitleTrialLimit()`：非 Pro 默认超过 60 秒即停止；`allowFreeUserLive` 为真则放行 | **可以直接解除本地时长限制** | 去掉计时拒绝与对应升级提示，保留字幕捕获、翻译和显示。该改动不增加语音识别能力 |
| 文章术语自动抽取 | `Cc()` 认定功能可用后，还要求 `isPro===true` 才使 `effective` 为真；侧栏入口也有门禁 | **可以解除会员条件** | 同时处理有效性计算和侧栏操作限制；复用已有 AI 批量抽取 Prompt、翻译适配器、本地术语存储，不恢复云术语 |
| 已捕获双语字幕下载 | `Wdt()` 先检查 `Ga()`；通过后 `Xhe()` 把缓存放入配置，再打开原厂下载网页 | **不能只删会员检查；可以低成本完成本地化** | 用现有字幕缓存、译文和时间轴生成本地 SRT/VTT 等文件，Blob 下载；替换原厂网页跳转 |
| AI 智能上下文 | UI 和设置受 Pro 限制；`ip()` 还要求 user token，并 POST 原厂摘要接口 | **需要补独立摘要适配器** | 从页面正文生成主题、术语、风格信息，再交给既有缓存和 Prompt 注入；接个人 API 或本地模型 |
| 自定义 Prompt | 非 Pro 的自定义批量模式中，`prompt/systemPrompt/multiplePrompt` 可编辑 | **已经可用** | 无需会员解锁；字幕 `subtitlePrompt` 在该设置生成路径被隐藏，是界面配置问题，不是模型能力缺失 |
| AI 专家与专家目录 | 专家执行本质是 Prompt 配置；在线 JSON 目录下载已移除 | **可以本地化内容** | 内置或导入专家定义，交给自选模型执行。无需恢复原厂账号或模型代理 |
| 本地术语编辑、匹配、导入导出 | 已保留本地持久化、锁、并发控制与本地历史 | **已经可用** | 与“文章自动抽取”和“术语云历史”分别处理；不应给整个术语模块统一加会员状态 |

### 直播一分钟限制

当前函数对时间的判断已经用提取后的真实函数验证：初始允许；60,000ms 允许；60,001ms 拒绝；`allowFreeUserLive=true` 放行；Pro 放行。这是客户端计时策略，不是服务器强制配额。解除后仍需平台提供字幕；没有原生字幕的直播需要单独 ASR。

证据：`local-content_main.js:125228`；函数核验结果见 [`local-gate-probes.json`](../work/pro-audit/temporary/local-gate-probes.json)。其他直播/会议页面复用的基本方法也需保持一致，不能只移除某个播放器上的升级文案。

### 文章术语自动抽取

`Cc()` 的核心关系是：功能可用、URL 匹配、用户开启、高亮开启、未在本次访问禁用，再额外要求 `isPro===true`。同一组输入下，非 Pro 的 `available=true/effective=false`；仅切换 Pro 后 `effective=true`。实际抽取走 AI 批量请求与自选翻译服务，不以官方云术语接口为执行前提。

本地术语库已经存在；这项工作的核心是拆掉抽取入口与有效性判断中的身份条件。正文太短、未选 AI 服务、URL 不匹配等业务条件应保留。

证据：`local-content_main.js:47319`、`109958` 及侧栏相关判断；本地存储与云同步拆分见 `scripts/patch-account.cjs:77`。

### 字幕下载

`Wdt()` 的会员条件和 `Xhe()` 的导出路径是两个问题。前者决定能否点击，后者实际依赖 `DOWNLOAD_SUBTITLE_URL` 原厂网页。删除 `Ga()` 后，仍会跳转到已经退役的外部入口。

本地已掌握字幕数据，下载不需要原厂推理。需要补文件序列化、原文/译文/双语选择、时间格式与编码，并处理当前仅加载部分字幕的情况。Magpie 分句结果与字幕缓存需要使用同一份快照，避免下载原始碎片或过期字幕。

证据：`local-content_main.js:120806`、`83943`。README 当前写“保留字幕下载”，准确范围是字幕缓存和下载管线保留，不能据此认定独立本地文件导出已经闭环。

### 智能上下文

当前摘要函数 `ip()` 的主要依赖链：

```text
页面正文 → Pro/Max/特殊入口条件 → user token → transai/summary-context
                                              ↓
                                theme / terms / style_guide
                                              ↓
                                  本地缓存 → 翻译 Prompt
```

核验结果：普通用户零请求；设置 Pro 但 token 为空仍零请求；覆盖摘要 URL、token 为空仍零请求。旧摘要快照能被复用，说明缓存与注入能力在客户端，但不存在可替代官方接口的本地摘要生成器。

可复用的是正文截取、缓存、主题/术语/风格字段、Prompt 注入；需要新增的是向自有模型请求摘要和结果校验。正文标题变量、普通前后段上下文与这项全文摘要增强不是同一个功能。

证据：`local-content_main.js:43394`；UI `89253` 起；设置见格式化 options 中 `enableAIContext` 的分支。README 中“保留智能上下文”目前指前端能力保留，默认无原厂账号状态下不能生成新摘要。

## 3. Magpie 已实现什么

| 环节 | 当前实现 |
|---|---|
| 输入 | YouTube 已有带时间轴字幕，转为原文词元；不是音频 |
| 推理请求 | 扩展后台请求 `http://127.0.0.1:3425/v1/chat/completions`，独立于原厂账号 |
| 模型输出 | 只返回 `ends` 分句边界，不改写、不翻译原文 |
| 本地处理 | 校验边界；重建句子与时间轴；控制过长句；处理取消、缓存和页面切换 |
| 降级 | 失败时使用标点、时间间隔、长度等基础分句 |
| 翻译 | 使用独立配置的字幕翻译服务，不自动改成 Magpie |
| 适用范围 | 当前安装包已接入的 YouTube 路线；不能推断所有视频平台已统一接入 |

证据：`extension/magpie-core.js:5`、`52`、`58`、`110`；`extension/magpie-background.js:47`；安装包入口核验覆盖非 Pro 路由、优先进入本地适配器、失败与陈旧请求处理。

本地服务可以继续调用云模型，也可以改用本机模型。要实现离线分句，必须让 localhost 后面的模型也在本机运行，并提供兼容的 chat completions 协议。

## 4. 依赖原厂或其他服务器的功能，以及替代边界

| 功能 | 原版实际依赖 | 当前欧文翻译状态 | 本地能做什么 |
|---|---|---|---|
| 官方 Pro/Max 托管模型、试用与免费托管额度 | 官方签发 token、模型代理、额度与计费 | token 获取和官方 provider 已移除；只保留直连适配器 | 用个人供应商 API Key 或本机模型获得翻译能力。会员标记不能生成官方凭据与额度 |
| 无字幕视频 AI 生字幕 | `asr-audio/v2/create-task`、字幕缓存、任务轮询，依赖账号 token | 创建任务、缓存、轮询等方法已置空/关闭 | 新增音频获取、切片、本机 ASR、时间轴与字幕接入。当前无现成语音识别引擎可开启 |
| 原厂 YouTube AI 合并/预翻译 | `subtitles/yt-asr-subs`，需 token | `requestServerMerge` 已置空，官方入口关闭 | 已有 Magpie 可替代“对已有字幕重新分句”；不能替代无字幕识别 |
| 普通图片客户端 OCR | ONNX 文字检测、Tesseract 识别、现有翻译服务、Canvas 盖底绘字 | 0.3 删除了实现、dispatcher、图片资源与 WASM | 可以回迁既有实现；同时恢复入口、资源和 manifest。模型权重与语言数据需打包后才是完整离线 |
| Pro 图片/漫画成图 | 账号换上传地址、上传图片、`comics/trigger`、轮询返回成图 URL | 图片功能与原厂调用入口已裁剪 | 本地 OCR 可提供基础识别与覆盖绘字。要达到完整漫画效果，另需检测、擦字/修复、排版流程 |
| 普通 PDF | 扩展内 `pdf/` 是连接官方 WebApp 的 iframe 与文件 Blob 桥 | 桥和入口已删除 | 需要本地 PDF 解析、渲染、文本块抽取和双语排版；恢复原目录只会重新依赖官方网页 |
| PDF Pro | 官方文档明确会员 PDF 交由 Mathpix 解析；扩展是网页入口 | 无本地处理主体 | 可另接本地 OCR/版面分析/公式处理器；不是解锁包内现成引擎 |
| BabelDOC、EPUB、DOCX、字幕文件工具 | 当前扩展跳转官方文件 WebApp，工具主体不在扩展中 | 文件工具入口已删除 | 需要另建或接入独立文件处理器。文件工具跳转本身不足以判定 WebApp 的每一步均在服务器执行 |
| 官方配置云同步 | `v1/user/settings`，账号鉴权与云存储 | 读写适配已关闭；本地导入导出保留 | 用自己的存储完成多设备同步；本地导入导出可直接用 |
| 术语云同步、云历史恢复 | `v1/user/glossary-meta/config`，token、远程数据及修订 | 云读写、删除、修订适配移除；本地编辑和历史保留 | 自建同步层可复用本地数据；无法凭本地会员状态得到原厂云端数据 |
| Google Drive 同步 | 独立 OAuth 和 Drive 文件传输，属于第三方云 | 0.3 主动移除认证与传输方法 | 原包有实现可回迁，需要自己的可用 OAuth 配置与授权；不依赖原厂模型服务器 |
| 在线专家、公共术语目录、远程规则 | JSON/CSV/配置资源下载 | 在线目录和更新关闭，规则固定在包内 | 静态打包或本地导入即可。它们是内容分发依赖，不是专有推理引擎 |
| AI 写作、AI Reply | 界面组织 Prompt 与模型调用 | 0.3 主动移除入口和配置 | 属于功能回迁。可接现有自有模型，但当前没有可直接开启的完整产品入口 |

原版普通图片 OCR 的“本地”还有冷启动依赖：ONNX 的 `preprocess-yolo/best` 模型首次从原厂资产站下载并缓存，Tesseract 默认语言数据从 jsDelivr 下载；基线未包含这些模型权重。仅回迁 JS/WASM 不构成自包含离线包。

云调用函数及当前 stub 的逐项证据见 [远端依赖读本](../work/pro-audit/remote-evidence.js) 和 [远端依赖明细](../work/pro-audit/remote-findings.md)。图片客户端/服务端的区分与 Mathpix PDF 架构也由官方[使用说明](https://immersivetranslate.com/zh-Hans/docs/usage/)及[隐私政策](https://immersivetranslate.com/zh-Hans/docs/PRIVACY/)支持。

## 5. 官网收费项目，不等于必须使用原厂服务器

本次实际读取的官方动态套餐表中，YouTube 双语字幕下载属于 Pro/Max；AI 生成视频字幕为每月 1000 分钟；PDF Pro 为每月 1000 页；漫画为每月 3000 张；多设备配置同步也属于付费权益。Pro 与 Max 的主要差异在模型档次和额度。[当前价格表](https://immersivetranslate.com/zh-Hans/pricing/)

收费与技术部署是两个维度：字幕文件生成完全可以在客户端完成；AI 专家是提示词集合；官方模型额度则需要实际服务凭据和推理资源。官方也公开支持自定义 API 和 Ollama。[官方 Prompt 说明](https://immersivetranslate.com/zh-Hans/docs/prompts/)、[Ollama 配置](https://immersivetranslate.com/zh-Hans/docs/services/ollama/)

## 6. 建议的解绑顺序

| 顺序 | 工作 | 工作性质 | 完成验收 |
|---|---|---|---|
| 1 | 取消已有直播字幕的会员计时限制 | 小范围本地条件调整 | 非会员连续播放超过一分钟，字幕翻译继续更新；不发原厂请求 |
| 2 | 开放文章术语自动抽取与侧栏控制 | 多入口本地门禁调整 | 自定义 AI 服务可抽取；术语写入本地；刷新后保留；无云术语调用 |
| 3 | 实现字幕本地导出 | 补文件序列化与下载 | 原文/译文/双语导出时间轴正确；Magpie 最新结果进入文件；不打开原厂网页 |
| 4 | 自有模型智能上下文 | 新增摘要适配器，复用原缓存与 Prompt | 无账号生成新摘要；返回字段可校验；缓存随正文变化；摘要进入实际翻译请求 |
| 5 | 本地专家目录、字幕 Prompt 编辑入口 | 配置和界面整理 | 专家与 Prompt 均从本地载入，使用自选模型 |
| 6 | 按实际需求恢复 OCR 或新增 ASR | 模块回迁 / 新增处理链 | OCR 断网冷启动可识别；ASR 对无字幕视频生成可用时间轴，分别验收 |

**不要全局设为 `isPro=true`。** 当前账号存取返回空、官方服务凭据获取已移除、原厂域名请求被拦截；全局身份伪装会把请求导向没有后端的付费分支，例如云图片和官方模型。应把直播、抽取、导出、摘要分别建为独立本地能力，按实际可用服务决定入口。

其他 Pro/Max 分支已按用途拆开：

| 分支 | 当前影响 |
|---|---|
| AI 批处理失败回退 `p_()` | 非 Pro 默认回退 Bing；Pro 默认值指向已移除的 `babelfast-pro`。它选择备用服务，不决定是否允许 AI 批量翻译。全局设 Pro 反而会选到失效目标 |
| 跨服务回退 `Tze()` | `aiBatch.mode=custom` 或服务 `group=custom` 不建立这条自动回退；这是模式/配置限制，不是缺少会员。需要此能力时独立调整回退策略 |
| 原厂免费模型次数、长度与配额墙 | 入口限定 `free-model` 服务；当前配置已经移除该服务。代码虽在，自备 API 不会因此受到原厂 10/40 次数墙限制 |
| 直播备用翻译服务 | 仍有按 Pro 选择专用服务的分支；应使用当前自备主/备用服务，不恢复原厂服务 ID |
| 原厂云同步、云图片、模型推荐及配额提示 | 按当前配置和已移除入口区分。不能把每个 `isPro` 字符串都当作一个独立可解锁功能 |

证据：`local-content_main.js:43791`、`51353`、`49398`、`119503`；补充核验见 [本地门禁明细](../work/pro-audit/local-findings.md)。

## 7. 当前文档应修正的两点

1. README 的“字幕下载”应说明仍残留会员检查与原厂导出页，独立本地导出尚未完成。
2. README 的“智能上下文”应说明前端设置与注入保留，但新摘要仍需改接独立模型；仅保存 `enableAIContext=true` 不代表工作链已打通。

本次现有 `npm test` 已通过，覆盖构建完整性、策略迁移、本地术语、Drive 裁剪、本地导入导出、Magpie 适配器和安装包入口。额外函数核验确认了当前会员状态、直播时长、术语抽取条件、摘要 token 依赖与 Prompt 字段状态。未把这些核验等同于已经完成直播长时播放、真实模型推理或新增解绑实现。

## 8. 证据索引

| 结论 | 对应证据 |
|---|---|
| 账号与 token 已删除 | `scripts/patch-account.cjs:26-47`；当前函数核验 `local-gate-probes.json` |
| 官方模型配置清理 | `scripts/policy.cjs:30-66` |
| ASR 与官方合并服务关闭 | `scripts/patch-account.cjs:92-100`；`remote-evidence.js:470-490`、758 起 |
| 云术语与本地术语拆分 | `scripts/patch-account.cjs:55-89`；`remote-evidence.js:603-706` |
| OCR 删除范围 | `scripts/patch-media.cjs:108-140` |
| OCR 本地与云两路 | `remote-evidence.js:183-363`、496-600 |
| 原厂 PDF 桥 | `upstream/pdf/index.html:46`、`upstream/pdf/extension-entry.js:23` |
| 专家目录只是资源下载 | `remote-evidence.js:727-746` |
| Magpie 独立模型协议 | `extension/magpie-core.js`、`extension/magpie-background.js`、`extension/magpie-content.js` |
| 仍存的本地门禁 | [本地函数核验](../work/pro-audit/temporary/local-gate-probes.json)、[基线对照](../work/pro-audit/temporary/gate-comparison.json) |
| 官网正文与套餐证据 | [官方证据明细](../work/pro-audit/official-findings.md) |

