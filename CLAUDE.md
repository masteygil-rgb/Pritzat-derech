# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page, Hebrew (RTL) informational website for the "פריצת דרך / מנהרת ראש העין–פצאל" infrastructure project. Vanilla **HTML/CSS/JS — no build step, no framework, no dependencies**. The site is structured as 8 tabbed "pages" (`.page` sections inside `index.html`) with sub-tabs, a right-side nav menu, a password gate, and a full in-browser admin editor.

## Running & developing

**Always serve over HTTP — never open `index.html` as a `file://`.** Browsers block `file://` from loading `data:` URLs (uploaded images) and some interactions, which silently breaks the admin editor. Symptoms of running as `file://`: delete/before-after/image-upload "don't work."

```bash
# from the project root
"C:\Program Files\Python313\python.exe" -m http.server 8000 --bind 127.0.0.1
# then open http://127.0.0.1:8000/index.html
```

Or double-click `הפעל-אתר.bat`, which starts the server and opens the browser.

There are no tests, linters, or build commands. To sanity-check JS edits: `node --check assets/js/admin.js`.

### Cache busting (important)
The browser caches CSS/JS aggressively. After editing CSS/JS you **must** bump the `?v=N` query on the `<link>`/`<script>` tags in `index.html`. `admin.js` renders a version badge (e.g. `v24`) in the admin bar — bump the badge string in `admin.js` in lockstep so you can visually confirm the fresh build loaded. When in doubt, open with a unique `?fresh=<timestamp>` to bypass cache entirely.

## Architecture

Three independent IIFE scripts, loaded in this order, communicating only through the DOM and `localStorage`:

- **`gate.js`** — password gate. Runs early in `<body>` (before content), injects a hide-style and a login card, blocks the page until the site password is entered. Client-side only.
- **`app.js`** — public site behavior: tab navigation (`showPage`), sub-tabs, mobile drawer, scroll-reveal (`IntersectionObserver` on `.reveal`), animated stat counters (`.num[data-count]`), hero particles, CTA form. Tab switching is pure show/hide of `.page.active` — there is no router beyond `location.hash`.
- **`admin.js`** — the large, central file (~1200 lines). A full in-browser content editor activated by the ✎ FAB, `Ctrl+Shift+E`, or `?admin=1`.

### Admin editor model (the core of this codebase)
All edits live in `localStorage` and are re-applied on every page load via `applyOverrides()` — **so visitors on the same browser see the edits too; nothing is written back to the HTML source.** To make edits permanent for everyone you must export the JSON and bake it into the source (or persist server-side, which doesn't exist yet).

Three storage keys:
- `pd_admin_overrides_v1` — keyed map of edits to **existing** DOM elements: `{ html, style, src, bg, move:{dx,dy} }`. Keys come from `keyOf(el)`, a stable nth-child path (`#id>tag:nth-child(n)>...`).
- `pd_admin_blocks_v1` — **new** author-added blocks: `{ pageId: [ {id,type,html,img,caption,...} ] }`. Rendered into a `.admin-blocks` container injected once per `.page` (below its `.page-head`).
- `pd_admin_theme_v1` — CSS-variable overrides (the color palette).
- `pd_admin_pass_v1` — admin password override (default `derech2050`, set in `DEFAULT_PASS`).

Block types (`b.type`, dispatched in `renderBlock`): `text`, `image`, `text-side`, `text-below`, `text-over`, `before-after` (drag-curtain comparing two images via `clip-path`), `spacer`. New blocks are inserted via "＋" insert-zones (`makeInsertZone` / `chooseTypeAt` / `addBlock(pid,type,index)`) or dragged freely (`enableDrag` → `free:true`, absolute position saved as `x/y` percentages). Existing elements listed in `MOVE_SELECTORS` get a drag handle (`enableMoving`).

Enter/exit: `enterAdmin()` calls `takeSnapshot()` (saves the three localStorage keys); `exitAdmin()` asks save / discard (`restoreSnapshot()` + reload) / keep editing.

### RTL gotcha
The site is `dir="rtl"`. **Do not use `inset-inline-start`/CSS-logical positioning for JS-computed drag coordinates** — it flips horizontal math and produces a mirror effect. Use plain `left` with `right:auto` (see `applyFreePos`/`enableDrag`). Similarly, never place a toolbar at negative `top` inside a container with `overflow:hidden` — it gets clipped (this broke the block toolbar before it was moved inside the block).

### Two separate passwords
- Site gate: `derech` (in `gate.js`, `PASSWORD`).
- Admin editor: `derech2050` (in `admin.js`, `DEFAULT_PASS`).
Both are client-side convenience only, not real security.

## Images & tooling

- `assets/img/scenes/*.png` — AI-generated background illustrations.
- `assets/img/site/*.jpg` — web-optimized versions of real photos (sources in `assets/img/photos/`), produced by `tools/process_photos.py` (Pillow).
- `tools/nb.py` / `tools/gen.py` — image generation via the Gemini "nano banana" model (`gemini-2.5-flash-image`). The API key is read from `../דרור/.env.local` (`GEMINI_API_KEY`), the user's shared key across projects. Generate via the real interpreter: `"C:\Program Files\Python313\python.exe" tools/gen.py`. Note: bash's `python3` here is a Windows Store stub that only prints "Python" — always use the full path.

## Deployment

Git remote: `https://github.com/masteygil-rgb/Pritzat-derech` (branch `main`). `gh` CLI is not installed — use plain git. Commit/push with: `git add -A && git commit -m "…" && git push`.
