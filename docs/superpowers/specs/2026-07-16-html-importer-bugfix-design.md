# HTML Importer Bugfix Design

## Context

Before this change, the repository is a packaged Obsidian plugin with `main.js`, `manifest.json`, `styles.css`, and README only. There is no TypeScript source, package metadata, build step, or test harness.

Manual runtime checks with a mocked Obsidian API reproduced these defects:

- Converted Markdown files are created as `Title.md.md`.
- `cleanFilename` only replaces the first occurrence of each illegal filename character.
- Generic article conversion can output paragraphs before headings.
- `preserveImages: false` still creates an image folder and writes images.
- Image writes are not awaited, so Markdown can be created before image persistence finishes.

## Chosen Approach

Patch the existing packaged plugin directly and add a small Node-based validation harness. This keeps the change focused and avoids a larger TypeScript rebuild or parser dependency migration.

## Changes

- Generate output filenames from a sanitized title stem and append `.md` exactly once.
- Replace all illegal filename characters and provide a stable fallback for empty names.
- Convert HTML blocks in source order for headings, paragraphs, lists, quotes, sections, direct images, and inline images.
- Respect `preserveImages`; when disabled, do not create the image folder or save image files. Remote image URLs remain as Markdown image links, while base64-only images are omitted instead of embedding large data URLs.
- Await image extraction and binary writes before writing Markdown.
- Add `package.json` and `tests/run-tests.js` so `npm test` can validate core behavior without Obsidian.

Source-order conversion walks recognized container blocks (`article`, `section`, list containers) recursively and emits only leaf content blocks (`h1`-`h6`, `p`, `li`, `blockquote`) plus direct `<img>` tokens at their original positions. Container descendants are not processed a second time. Inline images inside paragraphs are emitted at their paragraph-relative position between surrounding text.

## Non-Goals

- Rebuilding the project as TypeScript.
- Adding external HTML parsing dependencies.
- Changing the plugin ID, commands, or settings surface.

## Verification

- `node --check main.js`
- `node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8'))"`
- `npm test`, with regression coverage for:
  - output paths ending in exactly one `.md`, including an input title or basename that already ends in `.md` or `.MD`
  - global illegal-character replacement in filenames
  - `h1`-`h6` heading and paragraph source order
  - section, list item, and blockquote ordering without duplicate descendant output
  - direct and inline image placement relative to headings and paragraphs
  - no image folder or binary writes when `preserveImages` is disabled
  - image binary writes completing before Markdown file creation and before existing Markdown file modification
