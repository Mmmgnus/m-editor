
# m-editor
Markdown editor to edit SSG sites.
=======
# M Editor — Markdown Editor for Eleventy Sites (PWA)

M Editor is a web-based, offline‑friendly editor for static sites that use Markdown. It targets Eleventy by default and integrates with GitHub to create/update branches and open pull requests. Images are committed to the repo and previews render from the active branch.

See the Changelog for notable updates: [CHANGELOG.md](CHANGELOG.md)

## Features
- GitHub auth (token-based) and change requests (create, pick, update)
- Live Markdown preview (GFM), frontmatter editing panel
- Documents sidebar (repo tree filtered to content dirs)
- Image upload: commits to `assetsDir` and inserts markdown link
- Offline drafts with auto-restore (per repo/branch/file)
- PWA: installable with service worker updates

## Quick Start
- Install deps:
  - npm: `npm i`
  - dev tools (if not already): `npm i -D vite @vitejs/plugin-react vite-plugin-pwa typescript eslint prettier eslint-plugin-unicorn`
- Dev server: `npm run dev` (or `make dev`)
- Build: `npm run build` (or `make build`)
- Format/Lint: `npm run format` / `npm run lint`

### Quick Start: GitHub Token
- Create a token on GitHub:
  - Fine‑grained: Settings → Developer settings → Personal access tokens → Fine‑grained → Select your repo → Repository permissions → Contents: Read and write.
  - Classic: Settings → Developer settings → Personal access tokens → Tokens (classic) → Scope: `repo`.
  - Docs: Fine‑grained and classic tokens
    - https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token#creating-a-fine-grained-personal-access-token
    - https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token#creating-a-classic-personal-access-token
- In the app: click “Sign in to GitHub” and paste the token.
- Tip: Prefer fine‑grained tokens scoped to a single repo. You can revoke tokens anytime from GitHub settings.

## Configuration
Create `public/.meditor.config.json` to tailor paths and repo defaults. Example:

```
{
  "ssg": "eleventy",
  "contentDirs": ["src/content"],
  "assetsDir": "src/assets",
  "repo": {
    "provider": "github",
    "owner": "your-username",
    "repo": "your-eleventy-repo",
    "defaultBranch": "main",
    "prBranchPrefix": "content/",
    "postPathTemplate": "{contentDir}/{date}-{slug}.md",
    "crTitleTemplate": "Add: {title} ({path})"
  }
}
```

- `contentDirs`: folders shown in the Documents sidebar (default `src/content`).
- `assetsDir`: where images are committed (default `src/assets`).
- `postPathTemplate`: used when creating new posts and default paths.
- `crTitleTemplate`: customize change request titles with `{title}`, `{path}`, `{branch}`.

## Auth & GitHub
- Click “Sign in to GitHub” and use a token with Contents: Read/Write scope for your repo(s).
- The app updates branches directly and opens PRs via the GitHub API.

## Typical Workflow
- Pick Branch (footer) or select a Change Request → choose a file from the tree → edit
- Update change request to commit changes on the working branch
- New file… to add a new post at a templated path
- Insert image… to upload a file under `assetsDir/YYYY/MM/` and insert `![alt](path)`

## Live Preview
- Renders Markdown with GFM; frontmatter is parsed and removed from the rendered HTML.
- Images in preview:
  - Relative and root‑absolute paths are rewritten to raw GitHub URLs for the active branch.
  - Paths under `assetsDir` are treated as repo‑root.

## Offline Drafts
- Autosaves content locally per `{owner}/{repo}:{branch}:{path}` after the first edit (opening a file alone does not create a draft).
- Auto‑restore on reopen; shows a banner with Undo/Clear.
- Local changes:
  - File tree shows a yellow dot for files with local changes on the current branch.
  - “Local Changes” tab lists drafts on the published (default) branch with Open/Restore actions.

## UI Notes
- Tabs (left panel):
  - Content: file tree (filtered by `contentDirs`) + quick search
  - Change Requests: list, filter, and actions (Create/Update/Open-Create/Change file/Insert image/New file)
  - Local Changes: shows local drafts on the published branch (Open/Restore)
- Branch footer (sticky): branch name, Switch to Published, Pick branch.

## Conventions
- JS/TS filenames: kebab-case (e.g., `text-buffer.ts`).
- Indentation: tabs (tab width 2). See `.editorconfig`.
- Lint/format: ESLint (unicorn/filename-case), Prettier (`useTabs: true`).

## Troubleshooting
- “Repository is empty” when creating PR: push an initial commit (e.g., README) to the default branch.
- Image does not render in preview: ensure the file was committed to the active branch and the path is under `assetsDir` (default `src/assets`).
- Cannot update PR from a fork: current flow assumes head branch is in the same repo (fork PRs are read‑only here).

## Release
- Recommend tagging releases in Git:
  - Using Makefile: `make release VERSION=0.1.0`
  - Or directly:
    - Create tag: `git tag -a v0.1.0 -m "v0.1.0"`
    - Push tag: `git push origin v0.1.0`
- Optional (version bump in package.json without publish):
  - `npm version 0.1.0 -m "chore: release v%s" --git-tag-version=false`

## Roadmap (next)
- Syntax highlighting for code blocks
- Repo settings panel (edit config in-app)
- File diff preview before commit
- IndexedDB cache of repo trees for faster browsing

For contributor guidelines, see AGENTS.md.
