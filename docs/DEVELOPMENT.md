# Development Guide

This guide is written so another computer, another developer, or another AI can continue the project without relying on prior chat history.

## Environment

Required:

- Git
- Node.js with npm
- Obsidian for manual plugin smoke testing

No package dependencies are currently required. `npm test` runs a plain Node.js script.

## Fresh Machine Setup

```bash
git clone https://gitee.com/harel-zhao/obsidian-html-importer.git
cd obsidian-html-importer
npm test
node --check main.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8'))"
```

If all commands pass, the local checkout is ready for development.

## Project Layout

| Path | Purpose |
| --- | --- |
| `manifest.json` | Obsidian plugin manifest |
| `main.js` | Plugin runtime entry and current source of truth |
| `styles.css` | Plugin stylesheet |
| `package.json` | Test command metadata |
| `tests/run-tests.js` | Node test harness with mocked Obsidian API |
| `AGENTS.md` | Rules for future AI/developer handoff |
| `docs/HANDOFF.md` | Current project state and continuation checklist |
| `docs/CHANGELOG.md` | Human-readable change history |
| `docs/superpowers/specs/` | Design specs created during AI-assisted work |

## Current Architecture

`main.js` exports an Obsidian `Plugin` subclass. The plugin:

1. Registers commands and file-menu actions.
2. Reads an HTML file from the vault.
3. Extracts metadata with regular expressions.
4. Extracts a likely content block.
5. Optionally saves base64 images to a configured image folder.
6. Converts recognized HTML blocks into Markdown.
7. Creates or modifies the target Markdown file.

Important helper methods:

- `cleanFilename`: sanitizes filename characters.
- `getMarkdownBasename`: strips an existing `.md` suffix before appending `.md`.
- `extractImages`: saves base64 images and returns vault-relative Markdown paths.
- `htmlToMd`: converts recognized HTML blocks in source order.
- `convertHtmlToMd`: orchestrates the full file conversion.

## Testing Strategy

`tests/run-tests.js` mocks the minimal Obsidian API surface needed by `main.js`.

Covered regression cases:

- Output path ends in exactly one `.md`, including titles ending in `.MD`.
- Illegal filename characters are replaced globally.
- `h1`-`h6`, paragraphs, sections, lists, and blockquotes preserve source order.
- Direct and inline images preserve source order.
- `preserveImages: false` performs no folder or binary writes.
- Image binary writes finish before Markdown `create`.
- Image binary writes finish before Markdown `modify`.

Run all tests:

```bash
npm test
```

Syntax and manifest checks:

```bash
node --check main.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8'))"
```

## Manual Obsidian Smoke Test

Use this when command registration, file writes, settings, or plugin lifecycle behavior changes.

1. Copy `manifest.json`, `main.js`, and `styles.css` into:

```text
<Vault>/.obsidian/plugins/obsidian-html-importer/
```

2. Restart Obsidian or reload plugins.
3. Enable `HTML Importer`.
4. Create a small HTML file in the vault:

```html
<article>
  <h1>Example</h1>
  <p>Hello <strong>world</strong></p>
</article>
```

5. Convert it and confirm:
   - `Example.md` is created, not `Example.md.md`.
   - Heading appears before paragraph.
   - No console error appears.

## Development Rules

- Treat `main.js` as source until a real TypeScript migration is planned.
- Do not document `npm run build`; no build script exists.
- Do not assume `src/` exists. It is ignored by `.gitignore`.
- Keep tests dependency-free unless there is a concrete reason to add tooling.
- Add a regression test before or with every conversion bug fix.
- Keep README focused on users; keep deeper internals here.

## Future TypeScript Migration Notes

If a future maintainer migrates this to TypeScript:

1. Remove or update `.gitignore` entries for `src/` and `tsconfig.json`.
2. Add `typescript`, `obsidian`, and a bundler such as esbuild.
3. Keep generated `main.js` committed if the plugin is distributed as a packaged plugin.
4. Update README, `AGENTS.md`, this file, and tests in the same commit.

## Push Workflow

```bash
git status --short --branch
npm test
node --check main.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8'))"
git add .
git commit -m "fix: stabilize html importer conversion"
git push origin master
```
