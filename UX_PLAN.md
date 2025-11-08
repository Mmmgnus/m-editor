# UX Improvement Plan (Designer‑Friendly)

## Goals
- Simplify language and make flows obvious for non‑technical users.
- Guide users through safe “working” edits → “send for review” → “published”.
- Provide continuous feedback (status, syncing, autosave) and clear actions.

## Language & Labels
- Change Request → “Update for Review” (aka “Review”).
- Branch → “Work Area”; Published → “Live Site”.
- Actions: “Send for review”, “Update review”, “View Live Site”.
- Add microcopy (1–2 lines) under important actions.

## Navigation & Layout
- Primary actions grouped in Review tab; Content tab stays simple.
- Make Review tab the landing context after sign‑in (optional).
- Keep sticky branch footer: Work Area name, View Live Site, Pick Work Area.

## Guided Workflows
- New Page wizard: Title, Date (auto), Tags (optional), Template (optional) → slug/path → open prefilled editor.
- Insert Image: drag‑drop upload, progress, auto‑insert markdown; gallery with thumbnails and filtering.
- Send for review: summary screen (title/description), changed files list, link to Review.

## Visibility & Feedback
- Status chips: Working vs Live; Awaiting Review vs Merged.
- Persistent message area: Autosaved, Ready to send, Syncing…
- Tree legend tooltip: blue = changed in review, yellow = local edits.

## Guardrails & Safety
- Never edit Live directly; always work in a safe Work Area.
- Confirm dangerous actions (Restore with summary).
- Autosave + Undo (keep current draft safe).

## Onboarding & Help
- 3–4 step in‑app tour: Edit content → Insert images → Send for review → See your changes.
- “?” help links near Review actions, Local Changes, Insert Image.

## Accessibility & Keyboard
- Shortcuts: Cmd/Ctrl+S (Save Draft), Cmd/Ctrl+Enter (Send for review), Esc (close panels).
- Focus styles, ARIA for status messages, predictable tab order.

## Settings Simplification
- Simple Mode (default): hide tech terms/branches; show Live vs Working.
- Advanced Mode: show work area names, templates, all controls.

## Implementation Plan
- Sprint 1 (language + workflows + feedback)
  - Copy changes (labels/tooltips/toasts) throughout UI.
  - New Page wizard and review “Send” panel (summary + changed files).
  - Switch to Content automatically after choosing a Review; ensure markers show immediately.
  - Legend tooltip for tree dots; sticky status messages in editor header.
- Sprint 2 (insert image + onboarding)
  - Insert Image: drag‑drop; grouped gallery; hover previews.
  - Onboarding tooltips (localStorage‑backed).
  - Simple Mode toggle; hide branch names, use “Work Area”.

## Done / Current State
- Change Requests tab centralizes review actions.
- Sticky branch footer; Local Changes tab; existing‑image picker with thumbnails.
- Autosave only after first edit; yellow dot for local edits; blue dot for review changes (in CR context).
