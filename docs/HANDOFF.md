# Handoff Notes

Last updated: 2026-07-17

This file captures the current state so work can continue after switching computers, developers, or AI agents.

## Current Status

The repository has been pulled from Gitee and updated locally with:

- Conversion bug fixes in `main.js`
- A dependency-free Node test harness in `tests/run-tests.js`
- `package.json` with `npm test`
- Documentation for users, developers, and future AI agents

The project still uses a packaged plugin layout. `main.js` is the source of truth.

## Verified Commands

These commands pass as of 2026-07-17:

```bash
npm test
node --check main.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8'))"
```

## Bug Fixes Completed

- Prevented `Title.md.md` output filenames.
- Replaced illegal filename characters globally.
- Preserved source order for headings, paragraphs, sections, lists, blockquotes, and images.
- Added support for `h1` through `h6` in Markdown conversion.
- Made base64 image writes awaited.
- Ensured image writes complete before Markdown create or modify.
- Honored `preserveImages: false` by avoiding folder creation and binary writes.

## Files To Read First In A New Session

1. `AGENTS.md`
2. `README.md`
3. `docs/DEVELOPMENT.md`
4. `docs/CHANGELOG.md`
5. `tests/run-tests.js`

Then run:

```bash
git status --short --branch
npm test
```

## Known Constraints

- HTML parsing is regex-based. This is acceptable for the current focused plugin scope but has edge cases.
- There is no TypeScript build pipeline.
- Existing `.gitignore` ignores `src/` and `tsconfig.json`; adjust this before a TypeScript migration.
- Tests mock Obsidian APIs and do not replace a manual Obsidian smoke test for lifecycle or UI changes.

## Good Next Tasks

- Add manual test fixtures for common exported HTML sources.
- Add a setting for whether to delete original `.html` files after conversion.
- Add collision handling for output Markdown files with the same title.
- Consider a real HTML parser only if regex edge cases become frequent.
- Consider TypeScript migration only after the packaged plugin behavior is stable.

## Do Not Lose This Context

Future maintainers should not assume the README's old build instructions are correct. The accurate flow is:

```bash
npm test
node --check main.js
```

There is no `npm run build` at this time.
