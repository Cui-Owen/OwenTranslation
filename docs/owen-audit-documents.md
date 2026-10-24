# 文件翻译及共享依赖审计

目标：`outputs/沉浸式翻译-Magpie-1.34.3`，只读分析。下面引用的 `*.pretty.js` 是对原分发包的格式化读本，行号仅对应读本。没有删除或修改扩展代码。

## 结论

文件翻译可从界面、路由和 PDF 转发入口切掉，不需要拆除核心网页翻译、字幕或翻译服务适配器。`pdf/` 只有 5,528 字节，是官方 WebApp 的 iframe 与文件 Blob 桥，并非完整文档翻译引擎。切掉文件入口的主要收益是去掉官方服务导流，而不是显著减少安装体积。

`offscreen/ tesseract/ wasm/ aifw/` 不能归入“文件翻译附件”一并删除。它们跨到网页图片 OCR 与翻译前脱敏；`video-subtitle/inject.js` 则直接属于必须保留的视频字幕捕获链。`browser-bridge/inject.js` 仅在 Android/iOS 内嵌浏览器与开发浏览器触发，桌面 Edge 可独立裁剪，但要连对应注入分支与资源声明一起处理。

## 可确认切掉的文件翻译层

| 部分 | 实际机制 | 精确证据 | 切除边界 |
|---|---|---|---|
| 弹窗“文件翻译”快捷项 | `Tye` 中 `S` 数组 `key: "file"`，回调 `y` 经 `js()` 探测区域，调用 `qA()`，最后 `onOpenUrl` | `work/content_main.pretty.js:124973` (`qA`)、`:125002` (`Tye`)、`:125028` (`y`)、`:125060` (`key:"file"`) | 仅删 file 项及它独有的回调；同数组 text、hover/touch、selection 是核心翻译入口，保留 |
| 悬浮球文件按钮 | document 按钮直接打开 `q.APP_BASE_URL` | `work/content_main.pretty.js:130178`–`:130189` | 仅删文件按钮，不能整块删悬浮球 |
| 侧栏文件页 | `R2e()` 显示 pdf/ePub/docx/txt/html/md/json/srt/ass/vtt/lrc；上传、PDF Pro、BabelDOC、字幕文件卡片均跳官方页面，不本地解析上传文件 | `work/content_main.pretty.js:153999`–`:154164`，渲染路由 `case "file": return d(R2e,{})` 在 `:160159` | 删 file tab、对应 route、R2e 与仅被其使用的图标/示例资源映射；保留 text route 和视频字幕播放器链 |
| 设置页顶部“文件翻译” | `Rrt()` 链接 `z.TRANSLATE_FILE_FROM_OPTIONS_NAV` | `work/options.pretty.js:181478`–`:181495` | 删除 Rrt navbar 调用与组件 |
| 浏览器菜单本地 PDF | 菜单 ID `qp="translateLocalPdfFile"`，动作打开 `N.PDF_VIEWER_URL` | `work/background.audit.pretty.js:596`、`:46295`、`:46452` | 移除菜单描述、更新/创建调用及单项动作；保留网页/选区翻译菜单 |
| 本地 PDF 包壳 | iframe `https://app.immersivetranslate.com/pdf?file=emptyfile`；extension-entry 拉取 fileURL，Blob postMessage `pdf-local-file` 到 iframe | `outputs/沉浸式翻译-Magpie-1.34.3/pdf/index.html:54`、`pdf/extension-entry.js:23` | 所有引用摘除后可删整个 `pdf/` 与 manifest 的 `pdf/index.html` 公开资源项 |
| PDF 打开后台动作 | `openPdfViewerPage` → `HE(pdfUrl)` → `runtime.getURL("pdf/index.html")`，无 URL 则打开远端 PDF_VIEWER_URL | `work/background.audit.pretty.js:47000`、`:47600` | 一并移除独立 PDF 动作；不碰共享 openInTab/openOptionsPage/getConfig |
| 网页中的 PDF 转发 | `toggleTranslatePage` 先 `xle` 判断 native/embedded PDF；native 打开PDF页，embedded 翻译普通页面后弹文档入口提示 | `work/content_main.pretty.js:81123` (`xle`)、`:97160`–`:97176`、`:169750` (`xct`) | 去掉跳文档页/提示 action，保留 normal webpage 分支。不要删除通用 URL 检查 `Nh/Sp`，否则会改变浏览器无法注入 PDF 页的状态判定 |
| PDF Blob 转发备用链 | `S9e/bpt/Tpt/vpt` 建新tab、等 pdf-ready、发送 Blob；备用加载 `openPdfViewerPage` | `work/content_main.pretty.js:189450`–`:189535` | 关闭调用链后可删此独立桥 |

侧栏文件页的“字幕文件翻译”和播放器双语字幕不是同一条链。可删除 SRT/ASS/VTT/LRC 上传网页入口，保留视频播放中的字幕抓取、翻译、下载和 Magpie 分句。

## 必须区分的共享依赖

| 文件或目录 | 真正入口、消费者 | 影响 | 建议 |
|---|---|---|---|
| `video-subtitle/inject.js` | `nwe()` 读取 `subtitleRule`，`pE(rule)` 通过后调 `rft()`，`ift()` 动态注入独立脚本。失败时 `twe()` 用内嵌源回退。`pE` 要求 type/isInject/hookType | 抓取 fetch/XHR/播放器字幕，影响 YouTube 与 Magpie 原始字幕输入 | **保留**。证据 `work/content_main.pretty.js:190981`、`:191030`、`:191109`–`:191169` |
| `image/inject.js` | `nwe()` 仅在 `imageRule.enable && type === "manga"` 调 `tft()`；`nft()` 注入脚本，失败 `ewe()` 内嵌回退 | 覆盖 canvas/OffscreenCanvas drawImage、ImageBitmap 以恢复漫画/图片来源与裁剪关系，非文件上传 | 首轮保留网页图片翻译；若另行确认删除漫画/图片翻译，再删入口+资源。证据 `work/content_main.pretty.js:191046`、`:191085`–`:191107`，目标文件原文单行 |
| `tesseract/` (约6.8MiB) | `offscreen.html:3` 加载 Tesseract；`TC()` 对检测文本框逐个 `Tesseract.recognize`，路径配置worker与core | **网页图片 OCR**；不是 PDF 阅读器依赖 | 保留，除非用户明确砍网页图片/漫画 OCR。证据 `work/offscreen.audit.pretty.js:46190`–`:46212` |
| 根 `wasm/ort-wasm-simd-threaded.wasm` (11,246,032 bytes) | offscreen 内置 onnxruntime；`fa.env.wasm.wasmPaths="./wasm/"`；`KT()` 从缓存/远端下载 `preprocess-yolo.onnx` 与 `best.onnx`，建立 `WT.create` 推理实例，`O3()` 检测后 `TC()` OCR | 网页图片检测/版面框，tesseract仅负责框内识字 | 可随整个本地图片OCR链另行切掉；不能仅因名字wasm而删。证据 `work/offscreen.audit.pretty.js:46308`–`:46331`、`:46388` (`QT`) |
| `aifw/` (约3.5MiB，含其自己的 `wasm/liboneaifw_core.wasm`) | offscreen 静态 ES import `./aifw/aifw-js.js` → libaifw，提供 init/maskText/maskTextBatch/restoreText/restoreTextBatch。不同于根ONNX wasm | AI 翻译请求前的敏感信息替换与返回后还原，横跨正常文字翻译 | **保留**。证据 `work/offscreen.audit.pretty.js:46428`–`:46537`；`work/content_main.pretty.js:47665` (`g$` mask)、`:47743` (`m$` restore)、`:72332`、`:72358` 为翻译流程实际调用 |
| `offscreen.html/js` 与 offscreen权限 | `pC` →后台ensureClientModelRuntime → `offscreen` RPC；后台 `OQ` 用 `offscreen.createDocument({url:"offscreen.html",reasons:["WORKERS"]})`；统一能力路由 `image_ocr` 与 `aifw` | 文字脱敏与网页图片OCR共享进程/消息层。删除它会同时失去两者；删除aifw文件而保留静态import还会令offscreen启动失败，连OCR一起坏 | **保留**。证据 `work/content_main.pretty.js:46876`–`:46916`；`work/background.audit.pretty.js:46619`–`:46708`；`work/offscreen.audit.pretty.js:46530`–`:46574` |
| `browser-bridge/inject.js` | `oft()` 注入条件 `on() || dt() || OT()`；分别为Android Imt、iOS Imt UA与仅DEBUG browser.html。桥内注册translatePage/translateImage/translateText/getMiniConfig等原生消息方法 | 桌面Edge正常UA不注入；属于移动嵌入浏览器桥，不是文件翻译专用 | 桌面Edge专用版可移除独立脚本及 `oft` 注入分支+manifest项；不要删除bundle共享的消息工具。证据 `work/content_main.pretty.js:5690`、`:5710`、`:166056`、`:191181`–`:191197`；`work/browser-bridge.audit.pretty.js:750`–`:777` |

## 不能按“document”字样整段删除

`Xc.handleThirdPartyTell` (`work/content_main.pretty.js:172824`) 同时处理文件WebApp及通用 translatePage、setConfig、restorePage、verifyServiceConnection、getAsyncTranslateContent；全删会影响共享翻译桥。EPUB 独有的 documentTerminology lifecycle (`:65507`–`:65573`) 可以在停止文件支持后独立梳理，但网页术语、iframe收集器、翻译provider仍共享，不能看到 documentSessionId 就删。

文档使用场景判断 `mh()` (`work/content_main.pretty.js:65636`) 区分 pdf_pro/pdf_free/html/epub；这个判断分布在上下文、样式、批量调度中。第一轮只切功能入口、远程跳转与独立资源；第二轮才做AST可达性裁剪。当前是单体压缩分发包，没有原工程模块边界；函数块的引用存在闭包变量和初始化包装器，靠字符串删除整片区域不能证明无伤。

## 向用户确认的推荐边界

推荐确认后砍：所有文件上传/文档翻译入口，PDF Pro/BabelDOC/EPUB/字幕文件工具导流，网页PDF转发与PDF本地桥；保留网页正文、选区、悬停、输入框、文字翻译、视频双语字幕、Magpie分句、网页图片/漫画翻译、脱敏与自定义API。桌面Edge专用的移动bridge可列为同批可砍项。

需要单独确认的扩展项：网页图片/漫画/OCR是否也去掉。若去掉，可移除tesseract与根ONNX wasm约17.5MiB，并从offscreen包拆出OCR实现；aifw/offscreen运行层仍需保留以维持敏感信息脱敏。无论选择哪档，不能把文件翻译裁剪当成OCR依赖裁剪。

## 裁剪后最低验收

普通长网页的初次/增量/恢复原文翻译；选区、悬停、输入框翻译；自定义OpenAI兼容API设置与调用；YouTube字幕捕获+Magpie分句+字幕翻译/下载；保留图片时验证一个普通图与canvas漫画；开启脱敏验证请求替换与返回还原；弹窗/侧栏/设置页不出现死路由；manifest所有文件引用存在；访问PDF不再开官方服务且不影响含嵌入PDF的普通网页正文翻译。
