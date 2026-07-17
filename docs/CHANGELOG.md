# Changelog

## 2026-07-17

- Fixed Markdown output filenames so titles ending in `.md` or `.MD` do not become `.md.md`.
- Fixed filename sanitization so illegal characters are replaced globally.
- Reworked Markdown conversion to preserve source order for headings, paragraphs, sections, lists, blockquotes, direct images, and inline images.
- Added support for `h1` through `h6` in conversion output.
- Fixed `preserveImages: false` so the plugin does not create image folders or binary image files.
- Awaited base64 image writes before Markdown file creation or modification.
- Added `package.json` and `tests/run-tests.js`.
- Added handoff documentation for future developers and AI agents.
