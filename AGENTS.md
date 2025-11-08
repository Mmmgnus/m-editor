# Repository Guidelines

## Project Structure & Module Organization
- Source in `src/`:
  - `src/app/` shell and layout
  - `src/modules/` auth, repo, editor, preview, pr, pwa, assets, storage
  - `src/shared/` types and utils
- Public assets in `public/` (PWA manifest, icons). Runtime config in `public/.meditor.config.json`.
- Content defaults: `contentDirs` → `src/content`, images in `src/assets/`.
- Naming: directories `kebab-case`; files by language (JS/TS `kebab-case.ts[x]`, Python `snake_case.py`).

## Build, Test, and Development Commands
- Make targets (wrappers):
  - `make dev` → `npm run dev` (Vite dev server)
  - `make build` → `npm run build`
  - `make lint` → ESLint; `make format` → Prettier
  - `make test` (placeholder)
- NPM scripts: `dev`, `build`, `preview`, `lint`, `lint:fix`, `format`, `format:check`.
- Path aliases in Vite: `@app`, `@modules`, `@shared`.

## Coding Style & Naming Conventions
- Indentation: tabs only; tab width 2 (YAML uses spaces).
- Formatting: JS/TS → Prettier + ESLint (`unicorn/filename-case`); Python → Black + Ruff; Rust → rustfmt + clippy.
- JS/TS filenames: `kebab-case` (e.g., `text-buffer.ts`, `file-picker.tsx`).
- Classes `PascalCase`, functions/vars per language norms; constants `UPPER_SNAKE_CASE`.
- Keep modules small; one responsibility per file.
- Prefer Eleventy-friendly paths: posts under `src/content`, assets under `src/assets`.

Example `.editorconfig`:

```
[*]
indent_style = tab
tab_width = 2

[*.yml]
indent_style = space
indent_size = 2
```

## Testing Guidelines
- Frameworks: Jest/Vitest (JS/TS), Pytest (Python), built-in `cargo test` (Rust).
- Naming: JS `*.test.ts`, Python `test_*.py`, Rust `*_test.rs`.
- Coverage: target ≥80% where tooling exists (`npm run test:coverage`, `pytest --cov`).
- Include regression tests with bug fixes.

## Commit & Pull Request Guidelines
- Commits: Conventional Commits (e.g., `feat: editor preview`, `fix: image path rewrite`).
- Branch naming: content branches `content/<slug>` by default (configurable).
- PRs: clear description, linked issues, screenshots for UI changes, note breaking changes, include a test plan.

## Security & Configuration Tips
- Never commit secrets; use `.env.example` and `.gitignore`.
- GitHub tokens are pasted at runtime; do not persist.
- App config via `public/.meditor.config.json` (repo owner/name, branches, `contentDirs`, `assetsDir`).
- Validate inputs; fail fast on invalid configs.

## Agent-Specific Instructions
- Use small, reviewable patches; avoid unrelated changes.
- Update or add tests with code changes; run `make test` before proposing.
- Document new commands in this file or the Makefile.
