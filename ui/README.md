# 欧文翻译界面（工具栏弹窗、设置页、文本侧栏）

工具栏弹窗 `popup.html`、设置页 `options.html` 与文本侧栏 `side-panel.html` 由本目录源码构建，不再使用原版界面。翻译引擎（后台、网页脚本、侧栏引擎）保持不变，界面通过引擎已有的消息接口读写配置和控制页面。

## 技术栈与依赖规则

| 层 | 选型 | 说明 |
|---|---|---|
| 框架 | React 19 | 三个页面共用一份 |
| 组件 | `src/components/ui/`（shadcn/ui 源码） | 基于 `radix-ui` 单一包；源码在仓库内，可直接修改 |
| 弹层搜索 | cmdk | 语言选择器 |
| 提示 | sonner | 仅设置页 |
| 图标 | lucide-react | 唯一图标库 |
| 样式 | Tailwind CSS 4 | 设计令牌在 `src/styles.css` |
| 构建 | Vite 8 + TypeScript | `scripts/build.cjs` 调用，输出到 `extension/` |

依赖由 `tests/test-ui.cjs` 约束：

- 所有依赖精确锁定版本；锁文件中每个包只有一个版本（`lightningcss` 通过 `overrides` 统一）。
- 界面代码只能导入白名单中的包；Radix 只能经 `radix-ui` 导入，不引入第二套组件、图标或提示库。
- React 只打包一次，位于两个页面共享的 `vendor` 分块；只被设置页使用的库（如 sonner）不进入弹窗加载路径。

新增组件时，先在 `src/components/ui/` 按 shadcn/ui 写法放入源码，再在页面中组合；不要引入新的组件库。

## 设计语言

沿用“朱批”品牌：墨色承担主操作与开关，朱色只标记选中、焦点与“已翻译”状态。颜色、圆角、字体都是 `src/styles.css` 中的令牌，深浅色随系统切换，与文本侧栏、网页内样式一致。品牌标志 `src/components/brand-mark.tsx` 与工具栏图标同一几何：下半环在页面已翻译时变为朱色。

## 数据接口

| 用途 | 接口 |
|---|---|
| 读取生效配置 | `background:main` → `getConfig {url}`（默认值 + 网站规则 + 用户覆盖，由引擎合并） |
| 读写用户覆盖 | `getUserConfig` / `setUserConfig`（`fullLocalUserConfig`）；嵌套默认值用 `generalRule["<键>.add"]` 增量覆盖 |
| 页面控制 | `content:main:<tabId>`：`toggleTranslatePage`、`translatePage`、`restorePage`、`switchTranslationMode`、`updateTargetLanguage`、`updateTranslationService`、`autoEnableSubtitleChanged` |
| 页面状态 | `content:popup_res:<tabId>`（主框架）：`getPageStatus`、`getCurrentPageLanguage`、`setCurrentPageLanguageByClient` |
| 术语库 | `queryAllTermsMeta`、`queryTerms`、`saveTerms`、`deleteTerms` |

写入键与原版设置页逐项一致（服务选择沿用 `userTranslationServices`，网站规则沿用 `translationUrlPattern` 等），旧配置无需迁移。设置页兼容原有路由，侧栏与网页里的 `options.html#services`、`#terms`、`#advanced` 等链接继续可用。

## 文本侧栏

侧栏的翻译器、配置合并、消息通道和“文章术语”绑定逻辑都在原 `side-panel.js` 包内，体量大且与网页脚本协议紧密耦合，因此保留为引擎，只替换界面：

- `side-panel.html` 先以普通脚本加载 `side-panel.js`，它照常把侧栏控制器挂到隐藏的 `#mount`：`side_panel:main`、`side_panel:reward_center`、`side_panel:article_terminology` 等通道与生命周期连接全部不变。
- `scripts/patch-sidepanel.cjs` 只做插入：控制器不再渲染 DOM，改为把状态（上下文、配置、术语面板快照与路由、术语库）和操作（切换路由、定位、保存、改译法、新建术语库、开启抽取）发布到 `window.OwenSidePanel.bridge`；同时导出旧界面调用过的引擎函数 `window.OwenSidePanel.engine`（翻译、服务列表、语言检测与目标语言规则、上次设置、结果复用、朗读、复制等）。
- React 页面 `src/side-panel/` 只依赖这两个对象，类型见 `engine.ts`；`tests/test-ui.cjs` 检查每个导出函数都有对应类型。

上次的服务、语言与选项仍保存在 `lastTranslate`，“智能换行”仍用 `localStorage.isRemoveNewLine`，升级后沿用原有偏好。

## 目录

```
src/
  components/ui/   shadcn/ui 组件源码
  components/      品牌标志、语言选择器、服务选择器、页面启动
  lib/             配置读写、消息、服务目录、连接测试、文案（简/英/繁）
  popup/           工具栏弹窗
  side-panel/      文本侧栏（文本翻译、文章术语）与引擎接口
  options/         设置页外壳与各分区（sections/）
  generated/       构建时从上游包提取的语言清单与服务图标（scripts/ui-data.cjs）
```

## 命令

```sh
npm run typecheck   # 类型检查
npm run build       # 完整构建扩展，含本界面
npm test            # 工程测试，含 tests/test-ui.cjs
```

弹窗支持 `popup.html?tabId=<id>` 指定作用的标签页，供浏览器回归测试使用；正常点击工具栏图标时作用于当前标签页。
