# HTML Importer for Obsidian

将 HTML 文件转换为 Markdown 的 Obsidian 插件。当前仓库是可直接安装的插件发布形态，`main.js` 是运行入口和当前源码真相。

## 功能

- 自动转换：创建或导入 `.html` 文件时可自动生成 `.md`
- 手动转换：通过命令面板或文件右键菜单转换单个 HTML 文件
- 批量转换：递归转换当前目标文件夹中的 HTML 文件
- 元数据提取：生成 title、author、date、hot、source、url、tags 等 frontmatter
- 图片处理：可保存 base64 图片到本地，也可关闭本地图片保存
- 内容转换：按源顺序处理标题、段落、列表、引用、section、直接图片和内联图片

## 快速安装

1. 克隆或下载本仓库。
2. 将以下文件复制到 Obsidian vault 的 `.obsidian/plugins/obsidian-html-importer/`：
   - `manifest.json`
   - `main.js`
   - `styles.css`
3. 打开 Obsidian，进入 `设置 -> 第三方插件`。
4. 关闭安全模式后启用 `HTML Importer`。

Windows 插件目录示例：

```text
<YourVault>/.obsidian/plugins/obsidian-html-importer/
```

## 使用方式

- 自动转换：启用插件后，将 `.html` 文件放入 vault。
- 单文件转换：右键点击 HTML 文件，选择转换为 Markdown。
- 命令面板：搜索 `HTML Importer` 相关命令。
- 批量转换：运行批量转换命令，插件会递归查找 HTML 文件。

## 设置项

| 设置 | 默认值 | 说明 |
| --- | --- | --- |
| autoConvert | true | 新建 HTML 文件时自动转换 |
| preserveImages | true | 保存 base64 图片到本地图片文件夹 |
| imageFolder | images | 图片保存目录名 |
| extractMetadata | true | 生成 YAML frontmatter |

当 `preserveImages` 为 `false` 时：

- 不创建图片文件夹
- 不保存 base64 图片
- 远程图片 URL 保留为 Markdown 图片链接
- base64-only 图片不会写入 Markdown，避免生成巨大 data URL

## 开发与测试

本项目当前没有 TypeScript 源码和构建步骤。改动以 `main.js` 为准。

```bash
git clone https://gitee.com/harel-zhao/obsidian-html-importer.git
cd obsidian-html-importer
npm test
node --check main.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8'))"
```

测试入口：

- `package.json` 定义 `npm test`
- `tests/run-tests.js` 使用 Obsidian API mock 验证核心转换逻辑

更多交接信息见：

- `AGENTS.md` - 给下一位 AI 或开发者的项目规则
- `docs/DEVELOPMENT.md` - 开发、测试、换机流程
- `docs/HANDOFF.md` - 当前状态与继续开发清单
- `docs/CHANGELOG.md` - 重要变更记录

## 仓库结构

```text
obsidian-html-importer/
  manifest.json
  main.js
  styles.css
  package.json
  tests/run-tests.js
  docs/
    DEVELOPMENT.md
    HANDOFF.md
    CHANGELOG.md
    superpowers/specs/
```

## 当前注意事项

- `main.js` 是当前维护入口，不要假设存在 `src/`、`tsconfig.json` 或构建产物。
- `.gitignore` 仍忽略 `src/` 和 `tsconfig.json`，如果未来迁移 TypeScript，需要同步调整。
- 正则解析 HTML 有边界，新增转换能力前必须补 `tests/run-tests.js` 回归用例。

## License

MIT
