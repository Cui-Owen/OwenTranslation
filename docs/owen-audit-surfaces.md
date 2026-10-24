# 欧文翻译：运营、账号、AI 写作与侧栏只读审计

审计对象：`outputs/沉浸式翻译-Magpie-1.34.3`，基于 1.34.3 安装包。未修改或删除扩展任何文件。
行号对应已生成的展开证据 `work/options.pretty.js` 和 `work/content_main.pretty.js`；发布包同名 JS 为压缩单行，符号是定位锚点。不能把展开文件行号直接标成发布包行号。

## 可独立移除边界

| 项目 | UI/路由 → 处理函数 → 依赖 | 建议边界与影响 |
|---|---|---|
| 设置顶栏下载 App 推广 | options.pretty.js:181429 `$F` 挂载 `_rt` 与 `Rrt`；181473 `_rt` 链接 `DOWNLOAD_FROM_OPTIONS_NAV` | 删除 `_rt` 挂载及独立组件，不触及翻译设置 |
| 设置顶栏文件翻译推广 | options.pretty.js:181486 `Rrt` → `TRANSLATE_FILE_FROM_OPTIONS_NAV` | 删除入口及 tooltip，文件翻译业务由另一审计范围处理 |
| 捐赠/订阅与社区跳转 | options.pretty.js:184619 起 `ait` aside footer → `donateUrl`、DOC_USAGE_URL、changelog、DOC_COMMUNITIES；184550 控制 Safari sponsor | 可以删除运营跳转；保留开发者、隐私配置、关于/许可与真正的用户设置入口 |
| 远程运营横幅/弹窗 | options.pretty.js:154021 `dB` → 153712 `uB` → `ctx.config.notificationList` → `mhe` 频率筛选；154076 `SZe` 展示 bannerUrl、title、HTML updateDetail、buttonLink；154000 `cB` 可派发 imt: 链接事件 | 移除 `dB` 的 popup/webpage/sidePanel 全部挂载，再停用通知配置入口和拉取。不要删除共用 `Yt` 模态框或 DOMPurify `pn`，翻译错误等仍使用 |
| 消息中心（含定向活动） | options.pretty.js:163934 `case messages` → 159553 `T0e`；134521 `Ffe` has-new、134524 `p9` list、134529 `Ufe` check、`YO` exposure、`f9` read、`KO` click；API `v1/targeted-messages/*`；134861 `Kfe` / 134865 `tB` 决定入口和轮询 | 从允许侧栏路由集合移除 messages，并阻断角标/轮询入口；可删除专属缓存 `messageCenterListCacheV1` 与 `messageCenterLocalState` 的模块。不能只隐藏导航，否则轮询留存 |
| 奖励中心/任务拉新 | options.pretty.js:152773 `sB` → 152697 `uhe` → `Xc({forceRefresh:true})`；163955 无条件挂载 `sB`；164049 奖励入口首次读取、2 秒弹跳 timer、164141 奖励按钮；14499 `P1` 判断 disabledAt | 移除 `sB` 挂载、奖励入口、弹跳定时器、rewardCenter 状态；仅令 `visible=false` 不够，因为 `sB` 在隐藏时也执行 `uhe` effect 拉取奖励数据 |
| 商店好评诱导 | options.pretty.js:154278 `gB` → storeGuide、新用户天数和使用量条件；154312 `a2` → store-guide 弹层、好评打开商店/差评打开 webReport；164027 导航挂载读取 reviewUrl，164157 好评入口 | 停用 storeGuide 并移除导航/浮球/自动好评调用点。保留 `Js` 安装时间与 `Xq` 使用记录等共用工具直到证明无其他使用 |
| 新用户订阅卡 | options.pretty.js:154713 `S9` → 154633 `vhe` → 134334 `s9` 条件；163954 固定挂载；定价页按钮 154731 | 停用 enableNewUserActivity、移除 S9 挂载及专属取价逻辑；公共用户信息 API 仍保留 |
| 节日折扣/推广菜单 | options.pretty.js:134296 `e2` 检查 discountActivity 日期、语言；配置中 popupMoreMenus.add_v.[1.16.1] 旧推广菜单 | 删除这些运营配置，并在最终配置合并后硬约束为关闭，避免远程配置和版本覆盖重新启用 |
| 服务列表赞助文案 | options.pretty.js:86749 `tae` 检测 sponsorSegments → 86815 `rNe` → `eNe/eae` 展示滚动赞助文案；86864 `WP` 是整个服务选择项 | 仅剔除 sponsorSegments 分支及赞助装饰，保留 WP/qP/服务真实 label、图标、需要配置状态、服务切换回调 |
| AI 写作 | options.pretty.js:184555 `#writing:m_`，184836 菜单；94310 `m_` → QOe/YOe；content_main.pretty.js:188476 initPage 调 `z5`；80852 `z5` → 80737 `gle` → `OHe/BHe` MutationObserver 注入 AI Reply；80905 `y6` 打开写作弹层；97107 消息 `openAiWritingModal`；189830 注册 `Ft.openAiWritingModal` | 若用户同意移除，删除菜单/路由/manifest 快捷键，禁用运行时 `z5/y6` 入口；再去除独立写作组件和提示词。保留输入框翻译、划词翻译，以及共用服务适配器/会话请求/配置模块 |

## 侧栏必须保留的核心部分

- `options.pretty.js:163124 NB` 是统一侧栏控制器。`i$e`（164229）过滤导航可见项，`t$e`（163993）和 `h1e`（163997）解析默认 tab；163914 起 switch 承载 text/file/video/image/tutorial/messages。
- `options.pretty.js:157138 fB` 是真实文本翻译页，调用 `aB` 发送翻译请求，含多服务、多目标语种、重用结果与取消旧请求。它属于翻译核心。
- `NB` 同时承载 `article_terminology` 的 snapshot、术语保存与原文定位（163196 起），以及消息桥与源标签页绑定。直接删除 `side-panel.js`、side-panel.html、sidePanel 权限或 `toggleSidePanel` 会使文本翻译/术语交互消失。
- 建议侧栏允许集合保留 text（及用户保留的翻译项目），删除 file/tutorial/messages，video/image 是否移除需按范围确认。配套修改 URL `activeTab` 和消息路由的白名单，不能只删除一个菜单项。
- 设置路由 `#ai` 是翻译用 AI 提示词/助手设置（91633 `o_`），不等于 `#writing`。不应因为名字带 AI 就一起删掉；用户的 AI 智能上下文、自定义 API 等依赖仍须保留。

## 账号/会员不能作为独立广告模块整删

- options.pretty.js:89031 `ONe` 包含设置页账号卡、登录、登出、订阅 CTA；89053 用户拉取 `xn.get("v1/user")`，89100 登录成功后 `NP()/pu` 同步配置。可以分离营销 CTA，账号功能本身与同步、云端服务交织。
- options.pretty.js:67965 `fP` / 67962 `pP` 为请求 401 清理 token；67977 `Im` 刷新用户信息。
- options.pretty.js:43014 `buildMembershipRequiredError` 及同类 quota/error helpers 是官方翻译服务失败语义，带 `action: upgrade/login`。不可把整个错误处理器或 isPro 字段删除，否则付费/失效服务显示、回退与重试会异常。
- 服务选择框 `iNe`（86892）既有会员徽标，也有 `needAction` 需要配置提示；只删除会员推广装饰，不删除自定义 API 未配置提示。
- 如果最终目标明确为“只留自定义本地服务”，可另做服务目录收敛，随后删账号、会员、云同步与官方服务适配器；这会改变现有翻译服务可用范围，需要单独确认，不应默认为用户已授权。

## 不能按文件名删除的共享模块

- `aifw/` 不是 AI 写作资源。options.pretty.js:99108 是 AI Firewall 说明链接；70214/70265/70375 在翻译请求路径调用敏感数据处理。该目录用于隐私处理，不能因名称像 AI 功能而删掉。
- DOMPurify、渲染器、消息总线 `Ae/ro`、storage、通用 modal/toast、语言列表、token 与网络工具均被核心共用。
- `pdf/` 在此包仅约 8 KB，`tesseract/` 约 6.8 MB 属 OCR；删除文件翻译入口不会自动证明可以删除 OCR。OCR 是否保留取决于图片/截图翻译范围。
- 源码包含原始许可注释与第三方 license。改名不等于移除许可声明；许可文字应保留在关于页或文件中。

## 配置约束与验收要求

现有 default_config.json 是单行；不能直接删除所有带 promotion/ad/sponsor 的字符串。网页适配规则也会出现广告选择器，那里是在避免翻译网页广告，删掉会改变网页处理。

现有配置有版本增量：`activeCampaignTags.enabled=false` 但 `.add_v.[1.30.2].enabled=true`；`sidePanel.rewardCenter.disabledAt` 本体为过去日期但 `.add_v.[1.24.2]` 又置空。因此本轮静态默认值编辑必须同时消除覆盖项，并在配置最终合并处设定本地禁止规则。远程配置、已保存用户设置、语言包动态更新均需防止恢复营销入口。

验收应覆盖：网页双语/译文切换、划词与悬停、输入框翻译、侧栏文本、自定义 API 保存、字幕分句与下载；同时验证没有 targeted-messages、奖励、促销取价、商店诱导请求和运营 UI。账号底层保留时不能宣称“所有官方网络请求均已移除”。

## 内嵌品牌 SVG 与替换边界

仅替换 icons/badge-icons PNG 不会覆盖以下内嵌 SVG。下面展开行号用于阅读；字符偏移与原发布包有关，改包后偏移会变化，实施时用函数与独特 path 共同锚定。

| 位置 | SVG 定义和挂载 | 可独立命中的选择器/边界 |
|---|---|---|
| 设置页主顶栏 | options.pretty.js:73260 `So`，181429 `$F`；`c(So,{style:{width:"30px",height:"30px"}})`；原包 SVG viewBox 字符偏移 1896904 | `.header-navbar-brand > svg[viewBox="0 0 1024 1024"]`；保留链接与 h1，由展示名称单独替换。品牌链接仍指向 BASE_SITE，可一并取消该运营跳转 |
| popup 弹窗头 | popup.js `EE`；viewBox 字符偏移 1353060；唯一挂载 `J3({hiddenLogo,children,close})`，挂载字符偏移 1368603 | `.modal-skin-standard__header > svg[viewBox="0 0 1024 1024"]`；popup 无独立 header-navbar-brand 或 shortBrandName 顶栏挂载 |
| 侧栏弹窗头 | side-panel.js `$o`；viewBox 字符偏移 1342097；`Kr` 与 `TRe` 挂载（后者是输入翻译引导） | 同上 `.modal-skin-standard__header > svg[viewBox="0 0 1024 1024"]`；侧栏也无独立主品牌顶栏 |
| 侧栏翻译界面 | `$o` 在 `POe` 划词翻译弹窗、`BOe` 划词按钮、`sLe` 文本通知卡、`Nf` 登录赠额度弹窗挂载 | `[class$="-modal-title-left"] > svg.logo[viewBox="0 0 1024 1024"]`、`.imt-selection-translation-button.icon-btn > svg.logo`、`.imt-login-ai-quota-gift-modal__logo`。`sLe` 仅内联20px包裹，无专属 class，宜替换 `$o` 组件本身而非宽泛选择器 |
| 网页内容脚本 | content_main.pretty.js:52788 `Ma` 粉色原图；53555 `Pi` 通用模态头、97686 `pYe` 输入翻译引导、111743 `SXe` 划词弹窗、112628 `EXe` 划词按钮、167371 `$1` 登录赠额度弹窗 | 与侧栏同类挂载，但许多位于 ShadowRoot，外部页面 CSS 不会进入；需要在相应组件样式/ShadowRoot 内替换，或替换 `Ma` 组件 |
| AI 写作单色原图 | content_main.pretty.js:52823 `ene`，使用 currentColor；`Lne` 挂载 class button-logo | 仅写作按钮使用。若用户确认删除 AI 写作，该挂载随写作模块删除；否则仅改其品牌图形 |

三个粉色函数都是 1024×1024 圆角粉底加白色原品牌路径，保持 e.class / e.style / 默认 18px 尺寸接口即可不改调用方。`ene` 是单色变体。不要将所有 SVG、所有 `#EC4C8C` 或所有 20px 容器统一替换；别的图标和主题色属于不同功能。options 的 `Is` 是展开/最大化图标，不是品牌 logo。

CSS 替换设置页顶栏可以把范围收得很小，但要明确只覆盖该处品牌。CSS 替换内嵌 SVG 时应保留原布局尺寸，并隐藏其内部 path，以新图作为 background/mask；需要在深浅主题、100%/125% 缩放、18/28/30px 尺寸检查可辨识度。不要给所有 svg 添加统一宽高。

## 运营埋点、语言检测统计与性能上报

可关闭的独立出口包括 GA collect、自建 user_behavior collect、语言检测统计 internal、翻译离页/性能报告。`rawUserConfig.disableReport` 只作为现有部分路径开关：不应只改 default_config.json，也不能删通用 request/fetch；各运行环境均内联了一份相应实现。

| 发布包 | 已定位上报锚点（发布包真实行号；压缩行内用函数识别） |
|---|---|
| background.js | `d0/i5` GA URL，19 行；`Ez` user_behavior POST，58 行；`$7` disableReport 事件网关、`rq` language_detect POST，133 行；`wk` 翻译离页报告，144 行 |
| options.js | `TM` GA URL，7510 行；`HAe` user_behavior POST，7554 行（展开46948）；`T7/JMe` disableReport 事件网关及 `uEe` language_detect POST，7629 行（展开50598、51152）；`Aue/Mue` 翻译离页路径，9085 行 |
| popup.js | `b8` GA URL，4004 行；`ZV` user_behavior POST，4043 行；`qh` disableReport 事件网关、`lQ` language_detect POST，4118 行 |
| side-panel.js | `rO` GA URL，2 行；`h2e` user_behavior POST，41 行；`dA/wTe` disableReport 事件网关、`BTe` language_detect POST，116 行；`nie/rie` 离页报告，6898 行 |
| content_main.js | `NV` GA URL，5701 行；`k_e` user_behavior POST，5740 行（展开42392）；`XD/ORe` disableReport 事件网关及 `YRe` language_detect POST，5815 行（展开46116、46753）；`Wle/Qle` 离页报告，8060 行 |

性能标记 `__IMT_POPUP_PERFORMANCE__` 本身只是内存观测；popup 的 `Ld` 还写本地 `imt-popup-performance-samples-v1`。本地 performance.mark/counter 不等于网络上报，若目标是禁用外发，应切断上报 sink 与调度器，不要删性能计时或调度基础设施造成 popup 首屏问题。实施还需枚举 `SELF_SERVICE_COLLECT_URL`、`SELF_SERVICE_LANG_DETECT_COLLECT_URL` 和 GA URL 的调用者，并核查异常/性能 reporter 是否存在独立出口。

定向验收：在扩展新装、打开 popup、打开设置、打开侧栏、网页翻译完成/失败、切换标签/离开网页、语言自动检测、字幕分句完成/失败后，抓取 background 与各页面网络日志，要求上述 collect/internal 和独立性能上报端点无请求；同时本地自定义 API 的实际翻译、重试、取消、错误提示与字幕时间轴仍正常。默认配置、已保存旧配置、远程更新后的配置三组都测。已发现静态路径不能代替运行时验收。
