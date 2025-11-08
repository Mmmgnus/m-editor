# Changelog

All notable changes to this project will be documented here.

## Unreleased
- Add “Documents” sidebar with repo tree for content directories
- Add image upload flow (commit to `assetsDir` and insert markdown link)
- Add drafts panel (list/open/delete offline drafts)
- Improve PR UI (pick PR/branch, change file, create/open PR for branch)
- Preview: rewrite relative image URLs to GitHub raw URLs for active branch
- Default content root changed to `src/content`

## 0.1.0 — Initial MVP
- GitHub token auth and basic PR creation
- Controlled Markdown editor + frontmatter panel (title/date/tags/draft) with validation
- Live Markdown preview (GFM) with sanitization
- Config-driven defaults via `public/.meditor.config.json`
- PWA baseline with `vite-plugin-pwa`
