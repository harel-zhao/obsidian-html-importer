# HTML Importer - Obsidian 插件

一款将 HTML 文件自动转换为 Markdown 的 Obsidian 插件，支持提取元数据和图片。

## 功能特性

- **自动转换**: 创建或导入 HTML 文件时自动转换为 Markdown
- **元数据提取**: 自动提取标题、作者、日期、热度、来源、标签等信息
- **图片处理**: 支持提取 base64 内嵌图片和外部图片链接
- **Frontmatter**: 在 Markdown 文件头部生成 YAML 元数据
- **批量转换**: 支持右键菜单批量转换文件夹中的 HTML 文件
- **右键菜单**: 直接在文件右键菜单中转换

## 安装方法

### 方法一：手动安装（推荐）

1. 下载本插件文件夹
2. 将文件夹复制到你的 Obsidian vault 的 `.obsidian/plugins/` 目录下
3. 重命名文件夹为 `obsidian-html-importer`（如果还不是这个名字）
4. 打开 Obsidian → 设置 → 社区插件
5. 找到 "HTML Importer" 并启用

### 方法二：从源码构建

如果你想从源码构建：

```bash
# 克隆本仓库
git clone https://gitee.com/你的用户名/obsidian-html-importer.git

# 进入目录
cd obsidian-html-importer

# 安装依赖
npm install

# 编译 TypeScript
npm run build

# 将生成的文件复制到 Obsidian 插件目录
# Windows: %APPDATA%\obsidian\plugins\obsidian-html-importer\
# macOS: ~/Library/Application Support/obsidian/plugins/obsidian-html-importer/
# Linux: ~/.config/obsidian/plugins/obsidian-html-importer/
```

## 使用方法

### 自动转换
启用插件后，只需将 HTML 文件放入 vault，插件会自动将其转换为 Markdown。

### 手动转换
- **右键菜单**: 右键点击 HTML 文件 → "转换为 Markdown"
- **命令面板**: `Ctrl+P` (Windows) / `Cmd+P` (macOS) → 搜索 "HTML Importer"
- **批量转换**: 命令面板 → "HTML Importer: 转换文件夹中所有 HTML 文件"

### 设置选项
在 Obsidian 设置 → 社区插件 → HTML Importer 中配置：

| 选项 | 说明 | 默认值 |
|------|------|--------|
| 自动转换 | 开启后导入 HTML 自动转换 | 开启 |
| 保留图片 | 开启后图片保存到本地 | 开启 |
| 图片文件夹 | 保存图片的目录名称 | images |
| 提取元数据 | 生成 YAML frontmatter | 开启 |

## 支持的 HTML 结构

插件支持多种微信公众号文章和常见网页的 HTML 结构：

- `rich_media_content` - 微信公众平台文章
- `postArticle` - 博客文章
- `article-content` / `post-content` / `entry-content` - 通用文章内容
- `<article>` 标签
- `<section>` 标签

## 提取的元数据

| 字段 | 说明 |
|------|------|
| title | 文章标题 |
| author | 作者 |
| date | 发布日期 |
| hot | 热度/阅读量 |
| source | 来源网站 |
| url | 原始链接 |
| tags | 标签 |

## 转换示例

### 输入 HTML
```html
<article>
    <h1>文章标题</h1>
    <p>这是<strong>加粗</strong>文字</p>
</article>
```

### 输出 Markdown
```markdown
---
title: 文章标题
author: 未知
date:
hot:
source: 未知
url:
tags:
---

# 文章标题

这是**加粗**文字
```

## 文件结构

```
obsidian-html-importer/
├── manifest.json      # 插件清单
├── main.js           # 编译后的入口文件
├── styles.css        # 样式文件
└── README.md         # 说明文档
```

## 技术栈

- TypeScript
- Obsidian API
- 正则表达式解析 HTML

## 许可证

MIT License