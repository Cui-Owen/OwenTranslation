# 欧文翻译 v1

网页双语翻译、视频双语字幕与 AI 智能分句。支持自定义翻译服务、本地术语库和多服务文本对比。

**版本：1.0.0** · [下载安装包](https://github.com/Cui-Owen/OwenTranslation/releases/tag/v1)

## 安装

1. 下载发布页中的 ZIP，解压得到「欧文翻译」目录。
2. 打开 `edge://extensions` 或 `chrome://extensions`，开启开发者模式。
3. 点击「加载解压缩的扩展」，选择解压后的目录，刷新需要翻译的网页。

## 功能

| 功能 | 内容 |
|---|---|
| 网页翻译 | 双语 / 仅译文（截断、限高等放不下双语的位置自动只显示译文，悬停看原文）、网站与语言规则、悬停、划词、输入框翻译 |
| 视频字幕 | 双语字幕、字幕样式、YouTube 自动字幕分句、本地 SRT / VTT 导出 |
| AI 智能分句 | 使用所选 AI 服务生成分句边界，保留词序和时间轴；失败时使用本地规则 |
| 智能上下文 | 使用所选 AI 服务生成主题、术语与风格摘要 |
| 术语库 | 本地编辑、CSV 导入导出、文章术语抽取与译法调整 |
| 文本侧栏 | 多目标语言、多服务对比、朗读、复制、重试 |
| 设置 | 简体、繁体、英文界面；配置导入导出、历史恢复、快捷键 |

## 翻译服务

支持 Bing、Google、DeepL、DeepLX、Magpie、OpenAI、Claude、Gemini、DeepSeek、OpenRouter、Ollama 和通用 OpenAI 兼容接口。

在「翻译服务」中添加服务并配置地址、模型及密钥。Magpie 默认地址为 `http://127.0.0.1:3425/v1/chat/completions`。

AI 智能分句在「视频字幕 → YouTube 专属设置」中选择服务。分句缓存保存边界索引，按服务和模型区分，保留 7 天。

## 快捷键

| 操作 | 默认快捷键 |
|---|---|
| 翻译 / 还原网页 | Alt+A |
| 打开文本侧栏 | Alt+S |
| 输入框翻译 | Alt+I |

其他快捷键可在设置页及浏览器扩展快捷键页面配置。

## 构建

需要 Node.js 22.12+ 和 Python 3。

```sh
npm ci
npm run build
npm test
npm run package
```

构建生成 `extension/`，打包生成 `outputs/欧文翻译 v1.zip`、`SHA256SUMS.txt` 和 `release.json`。本地加载可直接选择 `extension/`。

## 项目结构

| 目录 | 内容 |
|---|---|
| `ui/` | React、Radix、Tailwind 界面源码 |
| `scripts/` | 构建、翻译适配、字幕分句、品牌资源与打包工具 |
| `upstream/` | 构建基线资源 |
| `tests/` | 构建完整性、界面、配置、术语、字幕与划词回归检查 |
| `docs/` | 工程说明 |

生成目录、依赖和本地工作数据不进入 Git。主分支为 `main`，v1 发布标签为 `v1`。
