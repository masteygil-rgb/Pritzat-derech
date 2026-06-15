# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page, Hebrew (RTL) informational website for the "פריצת דרך / מנהרת ראש העין–פצאל" infrastructure project. Vanilla **HTML/CSS/JS — no build step, no framework, no dependencies**. The site is structured as 8 tabbed "pages" (`.page` sections inside `index.html`) with sub-tabs, a right-side nav menu, a password gate, and a full in-browser admin editor.

## Running & developing

**Always serve over HTTP — never open `index.html` as a `file://`.** Browsers block `file://` from loading `data:` URLs (uploaded images) and some interactions, which silently breaks the admin editor.

```bash
# from the project root
"C:\Program Files\Python313\python.exe" -m http.server 8000 --bind 127.0.0.1
# then open http://127.0.0.1:8000/index.html
```

Or double-click `הפעל-אתר.bat`. No tests, linters, or build commands exist. To sanity-check JS edits: `node --check assets/js/admin.js`.

### Cache busting (important)
After editing CSS/JS, **bump the `?v=N` query** on the matching `<link>`/`<script>` tag in `index.html`. `admin.js` also renders a version badge (e.g. `v60`) in the admin bar — bump both in lockstep so you can visually confirm the fresh file loaded.

## Architecture

Five files, loaded in order, communicating only through the DOM and `localStorage`:

- **`gate.js`** — password gate. Runs early in `<body>`, injects a login card, blocks the page until the site password is entered.
- **`app.js`** — public site: tab navigation (`showPage`), sub-tabs, mobile drawer, scroll-reveal (`IntersectionObserver` on `.reveal`), animated stat counters (`.num[data-count]`), hero particles. Tab switching is pure show/hide of `.page.active` — no router beyond `location.hash`.
- **`pd-db.js`** — Supabase REST client (no SDK). Exposes `window.PDDB = { load, save, signIn, signOut, isAuthed }`. Table: `site_content`, key: `pritzat-derech`. Session persisted in `pd_sb_session_v1`. Supabase URL: `https://rtuobiaocojeefspkcez.supabase.co`.
- **`admin.js`** — the large central file (~2100 lines). Full in-browser content editor, activated by the ✎ FAB, `Ctrl+Shift+E`, or `?admin=1`.
- **`rich-text-toolbar.js`** — floating rich-text toolbar (ported from the "אלומות" project). Activated when `body.admin-mode` is set. Font combobox with type-to-search, `execCommand`-based formatting, background color/opacity.

## Admin editor model

All edits live in `localStorage` and are re-applied on every page load via `applyOverrides()`. **Visitors on the same browser see the edits; nothing is written back to the HTML source.** To publish for all visitors, press Save — this calls `publishToCloud()` which writes to Supabase and also updates `bakedContent` in memory.

### Content persistence layers (highest priority wins)
1. **`localStorage`** — the editor's working copy (edits in progress)
2. **Supabase** — the published version, fetched on every page load via `PDDB.load()`, applied only if localStorage is empty
3. **`assets/data/content.json`** — fallback if Supabase is unreachable; committed to git after Export
4. **HTML source** — original default content

`loadBakedContent()` tries Supabase first, falls back to `content.json`. `applyBaked()` only overwrites `overrides`/`theme`/`blocks` if localStorage is empty (so local edits always win).

### localStorage keys
- `pd_admin_overrides_v1` — edits to existing DOM elements: `{ html, style, src, bg, move:{dx,dy}, hidden, size:{w,h} }`. Keys from `keyOf(el)` — a stable nth-child path (`#id>tag:nth-child(n)>...`).
- `pd_admin_blocks_v1` — new author-added blocks: `{ pageId: [ {id, type, html, img, ...} ] }`. Rendered into `.admin-blocks` containers, one per `.page`.
- `pd_admin_theme_v1` — CSS-variable overrides.
- `pd_admin_pass_v1` — admin password override (default `derech2050`).

### Block types
`b.type` dispatched in `renderBlock`: `text`, `image`, `text-side`, `text-below`, `text-over`, `before-after` (drag-curtain comparing two images via `clip-path`), `spacer`. New blocks inserted via ＋ insert-zones (`makeInsertZone` / `chooseTypeAt` / `addBlock(pid,type,index)`) or dragged freely (`enableDrag` → `free:true`, position saved as `x/y` percentages).

### Admin lifecycle
- `enterAdmin()` → `takeSnapshot()` (saves all three keys for discard), clears undo stack, caches `el._pdOrigHTML` on all text elements, calls `enableEditing(true)`.
- `exitAdmin()` → prompts save / discard (`restoreSnapshot()` + reload) / keep editing. Save calls `publishToCloud()`.
- `enableEditing(on)` — toggles `contenteditable`, `onTextInput`, drag handles (`enableMoving`), and hero background pickers across all `TEXT_SELECTORS` / `MOVE_SELECTORS` / `IMG_SELECTORS`.
- Undo stack: `pushUndo()` is called at the top of `flush()`, `saveBlocks()`, and the theme input handler. `doUndo()` pops the stack and re-applies text/moves/theme/blocks to the live DOM. Ctrl+Z triggers undo when the active element is not contenteditable.

### Drag mechanics (critical)
Drag uses `pdDrag(e, handle, onMove, onEnd)` — a unified helper that:
- Listens on `document` with **capture phase** (`true` flag) so `stopPropagation` from child elements cannot block events.
- Uses `requestAnimationFrame` throttling (one move update per frame).
- Sets `pdDragging = true` to prevent `renderBlocks()` from replacing the DOM node mid-drag.

**Free block drag (`enableDrag`)**: uses delta-based positioning — `x = startLeft + (ev.clientX - startX)` where `startLeft = wrap.offsetLeft`. Never calls `getBoundingClientRect` inside the move handler; avoids any coordinate-system drift.

**Existing element drag (`startMove`)**: uses `transform: translate(dx,dy)` with purely cursor-delta math.

### RTL gotchas
- **Never use `inset-inline-start` / CSS logical properties for JS-computed drag coordinates** — it flips horizontal math. Use plain `left` with `right:auto`.
- Never place a toolbar at negative `top` inside a container with `overflow:hidden` — it gets clipped.
- `offsetLeft` is always measured from the left edge of the offset parent, even in RTL. Use it for drag math; it's consistent with `style.left`.

### Two separate passwords
- Site gate: `derech` (in `gate.js`, `PASSWORD`).
- Admin editor: `derech2050` (in `admin.js`, `DEFAULT_PASS`).

### Image compression
`shrinkImage(data, cb)` — canvas-based: shrinks to max 1600px, JPEG 85%, before saving to localStorage. Called before any image is written to `overrides` or `blocks` to avoid 5 MB localStorage overflow (which silently breaks before/after blocks).

## Deployment

- **GitHub Pages**: live at `https://masteygil-rgb.github.io/Pritzat-derech/`. Deploys automatically on push to `main` (takes ~1–2 min).
- **Git remote**: `https://github.com/masteygil-rgb/Pritzat-derech`. `gh` CLI is not installed — use plain git. Push with: `git add -A && git commit -m "…" && git push`.
- **Supabase**: same project as marvah.co.il. Anon key is safe to expose (security via RLS). For Supabase password reset: `reset.html` (standalone page).

## Images & tooling

- `assets/img/scenes/*.png` — AI-generated background illustrations.
- `assets/img/site/*.jpg` — web-optimized real photos (sources in `assets/img/photos/`), produced by `tools/process_photos.py` (Pillow).
- `tools/nb.py` / `tools/gen.py` — image generation via Gemini `gemini-2.5-flash-image`. API key read from `../דרור/.env.local` (`GEMINI_API_KEY`). Always use the full Python path: `"C:\Program Files\Python313\python.exe" tools/gen.py` — bash's `python3` is a Windows Store stub.
