# Agent Handoff Rules

This file is for any future AI agent or developer continuing this repository after a machine, model, or session change.

## Project Snapshot

- Repository: `https://gitee.com/harel-zhao/obsidian-html-importer`
- Branch used in this session: `master`
- Plugin type: packaged Obsidian community plugin
- Current source of truth: `main.js`
- There is no TypeScript source tree or build pipeline at this point.
- Test command: `npm test`

## Before Editing

1. Run `git status --short --branch`.
2. Read these files:
   - `README.md`
   - `docs/DEVELOPMENT.md`
   - `docs/HANDOFF.md`
   - `tests/run-tests.js`
3. Run the current verification commands:

```bash
npm test
node --check main.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8'))"
```

## Editing Rules

- Preserve the packaged plugin shape unless the user explicitly asks for a TypeScript migration.
- Keep `main.js` compatible with Obsidian's CommonJS plugin loading.
- Do not add external parser dependencies for small fixes unless there is a clear test-backed reason.
- Any change to conversion behavior must add or update `tests/run-tests.js`.
- Keep docs aligned with code. If behavior changes, update `README.md` and `docs/DEVELOPMENT.md` or `docs/HANDOFF.md`.
- Do not remove existing user changes without checking `git diff` first.

## Known Implementation Decisions

- Output Markdown filenames are sanitized and end in exactly one `.md`.
- Existing `.md` or `.MD` suffixes in titles are stripped before appending `.md`.
- `preserveImages: false` means no image folder and no binary writes.
- Remote image URLs are kept as Markdown image links.
- Base64-only images are omitted when local image preservation is disabled.
- Image binary writes must finish before Markdown file creation or modification.
- Source-order Markdown conversion currently covers `article`, `section`, `ul`, `ol`, `h1`-`h6`, `p`, `li`, `blockquote`, direct `img`, and inline `img`.

## Release Checklist

1. `npm test`
2. `node --check main.js`
3. Manifest JSON parse check
4. Manual install smoke test in Obsidian if plugin behavior or commands changed
5. Update `docs/CHANGELOG.md`
6. Commit and push to Gitee
