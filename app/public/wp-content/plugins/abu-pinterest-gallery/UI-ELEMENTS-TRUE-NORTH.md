# UI Elements — True North

> **This is a behavioral contract.** It defines exactly where every UI element lives, how it must be used, and what you are forbidden from doing. If you are an AI model working on this codebase, read every word of this document. Violations of this document — even well-intentioned ones — create bugs, visual regressions, and technical debt that take hours to undo.

**Last Updated:** 2026-02-06
**Maintainer:** Daniel Odegaard
**Plugin Version:** 2.0.0

---

## The One Rule

**Every UI element has exactly one canonical location. You must use it. You must not copy it, recreate it, wrap it, or build alternatives to it. If something is broken, fix it where it lives — do not build around it.**

---

## Why This Document Exists

AI models working on this codebase tend to do the following when they encounter a bug or visual issue:

1. See a rendering problem
2. Instead of finding and fixing the root cause in the canonical location, **build a new HTML structure, CSS class, or JavaScript function** that "patches over" the problem
3. This creates a second source of truth that immediately drifts from the original
4. Now there are two versions of the same UI, styled differently, behaving differently, and both need maintenance

**This is the single most destructive pattern in this codebase. This document exists to prevent it.**

If you encounter a bug in the UI, the correct action is:

1. **Identify the canonical location** (listed below)
2. **Understand what is currently happening** in that location
3. **Fix the bug in that location** with a surgical edit
4. **If you don't understand the bug**, stop and ask — do not create a workaround

---

## Canonical UI Element Locations

### 1. Tile Rendering

**Canonical function:** `abu_pg_render_tile()`
**File:** `abu-pinterest-gallery.php`
**Called by:** `abu_pg_render_full_gallery()` for masonry grids

This is the **only** function that generates tile HTML. It produces a `<div class="abu-pg-tile">` containing:

- **Image tiles:** `<img class="abu-pg-image">` with lazy-loading (`data-src`), srcset, sizes
- **Video tiles:** `<video class="abu-pg-video">` with poster, multi-quality sources, play overlay, mute button
- **Button container:** Download button (logged-in only), mute button (video only)
- **Data attributes:** `data-id`, `data-attachment-id`, `data-type`, `data-permalink`, `data-url`, `data-width`, `data-height`, `data-can-download`, `data-can-like`, `data-can-share`, `data-like-count`, `data-user-has-liked`, image variant URLs, video source URLs

**You must not:**
- Create a second function that renders tile HTML
- Write `<div class="abu-pg-tile">` or `<img>` or `<video>` markup anywhere outside this function
- Create "simplified" tile rendering for specific contexts
- Build a "tile preview" or "tile card" or "tile thumbnail" component that isn't this function

**You must not do this even if:**
- You think the existing function is too complex
- You need "just a simple image" in a new context
- The existing function renders more HTML than you think you need
- You want to "clean up" the output for a specific use case

**The correct action is always:** `<?php echo abu_pg_render_tile($tile_post_id, $debug_enabled, $kit_id); ?>`

---

### 2. Desktop Spotlight

**Canonical functions:** `createDesktopSpotlight(state)`, `openDesktopSpotlight(gallery, item)`, `renderDesktopSpotlightMedia(state, item)`, `renderDesktopSpotlightRightColumn(state, adjacentItems)`, `closeDesktopSpotlight(state)`
**File:** `assets/js/gallery.js`

The desktop spotlight is a **two-column overlay** built entirely by JavaScript from tile data attributes. Left column shows the media. Right column shows a masonry grid of adjacent tiles, action buttons (like, comment, share, download), metadata, and comments.

**The desktop spotlight is never rendered by PHP.** It does not exist in any template file. It is created on demand by JavaScript and destroyed on close.

**You must not:**
- Create PHP functions that output spotlight HTML
- Add spotlight markup to template files (`single-tile.php`, `single-abu_content_kit.php`, etc.)
- Create a "spotlight container" or "spotlight placeholder" in PHP output
- Build a second spotlight implementation in a separate JS file

---

### 3. Mobile Spotlight

**Canonical functions:** `createSpotlight(state)`, `openSpotlight(gallery, tile, item)`, `closeSpotlight(state)`
**File:** `assets/js/gallery.js`

**The mobile spotlight is a completely separate UI system from the desktop spotlight.** It is not a responsive CSS adaptation of the desktop layout. It has:

- A **full-screen carousel** (no right-hand masonry grid)
- **Swipe left/right** to navigate between tiles
- **Swipe up/down** to close
- Its own DOM structure, its own gesture handlers, its own layout
- Separate creation and destruction functions from desktop

The layout decision is made by `shouldUseMobileLayout()` — this is the single source of truth for which spotlight system to use.

**You must not:**
- Apply desktop spotlight fixes to mobile without verifying they apply
- Assume mobile spotlight uses the same DOM structure as desktop
- Create a third spotlight variant (e.g., "tablet spotlight" or "small desktop spotlight")
- Add CSS media queries that try to transform the desktop spotlight into the mobile layout

---

### 4. Icon System

**Canonical function:** `your_plugin_icon($name, $class)`
**Icon directory:** `/assets/icons/radix/`
**File:** `abu-pinterest-gallery.php`

All icons are Radix SVG icons loaded from disk by the PHP helper function. JavaScript accesses icons by cloning hidden DOM templates:

```html
<div class="abu-pg-icon-template" data-icon="heart" hidden>
    <?php echo your_plugin_icon('heart', 'yp-icon'); ?>
</div>
```

**Available icons:** `caret-left`, `play`, `speaker-loud`, `speaker-off`, `download`, `heart`, `heart-filled`, `chat-bubble`, `share-2`, `paper-plane`, `dots-horizontal`

**You must not:**
- Hardcode SVG markup (no inline `<svg><path d="..."/></svg>`)
- Reference icon files with direct `<img src="...">` paths
- Create a second icon loading function
- Embed icon markup in JavaScript strings

**The correct action is always:**
- PHP context: `<?php echo your_plugin_icon('icon-name', 'yp-icon'); ?>`
- JS context: Clone from `.abu-pg-icon-template[data-icon="icon-name"]`

---

### 5. Chapter Navigation & Gallery Wrapper

**Canonical function:** `abu_pg_render_full_gallery()`
**File:** `abu-pinterest-gallery.php`

Renders the complete gallery structure: icon templates, sticky chapter nav, chapter sections containing masonry grids. Each chapter section contains a `.abu-pg-gallery` grid, and each grid contains tiles rendered via `abu_pg_render_tile()`.

**You must not:**
- Create inline grids without the chapter wrapper structure
- Duplicate the chapter navigation bar
- Modify chapter section IDs (they are used for URL-based chapter linking)

---

## Stylesheets

| Stylesheet | Path | Scope |
|------------|------|-------|
| Gallery CSS | `/assets/css/gallery.css` | Masonry grid, both spotlights, tiles, video controls, icons |
| Chapter CSS | `/assets/css/abu-chapters.css` | Chapter navigation, sections, multi-grid |

**You must not:**
- Add inline styles to PHP-rendered elements (no `style="..."`)
- Create new CSS files for specific contexts ("mobile-fix.css", "spotlight-override.css")
- Add `!important` to override existing styles without understanding why the existing style exists
- Create new CSS class names that duplicate the purpose of existing ones

**If you see a visual bug:**
1. Find the existing CSS rule that should be handling this case
2. Understand why it's not working (specificity? missing media query? wrong selector?)
3. Fix the existing rule or add to the existing stylesheet
4. Do not create a parallel styling system

---

## Anti-Patterns — What You Will Be Tempted to Do (And Must Not)

### Anti-Pattern #1: "Workaround UI" for a Bug

You discover that the spotlight right column isn't rendering tiles correctly. Instead of debugging `renderDesktopSpotlightRightColumn()`, you:

```javascript
// WRONG: Building a "fixed" version alongside the broken one
function renderFixedRightColumn(state, items) {
    const container = document.createElement('div');
    container.className = 'abu-pg-fixed-right-column'; // NEW class = NEW problems
    items.forEach(item => {
        const tile = document.createElement('div');
        tile.innerHTML = `<img src="${item.url}" />`; // Bypasses template system
        container.appendChild(tile);
    });
    return container;
}
```

**Why this is destructive:** You've created a second right column that doesn't use tile templates, doesn't have permission-gated buttons, doesn't have data attributes, doesn't work with the SPA navigation system, and will silently diverge from the real implementation.

**Correct approach:** Fix `renderDesktopSpotlightRightColumn()` in place. If you don't understand it, ask.

---

### Anti-Pattern #2: "Quick CSS Patch"

The masonry grid has a spacing issue. Instead of finding the root cause in `gallery.css`, you:

```css
/* WRONG: Override instead of fix */
.abu-pg-gallery .abu-pg-tile {
    margin-bottom: 16px !important; /* "fixes" the spacing */
}
```

**Why this is destructive:** The existing masonry layout is computed by JavaScript. Adding CSS margins will fight the JavaScript positioning, causing layout thrashing. The root cause is likely in the JS masonry calculation, not in CSS.

**Correct approach:** Find the masonry layout logic in `gallery.js`, understand the column/gutter calculation, fix it there.

---

### Anti-Pattern #3: "Simplified Tile" for a New Feature

You need to show tiles in a new context (e.g., a "liked tiles" page). Instead of calling `abu_pg_render_tile()`, you:

```php
// WRONG: "I just need a simple image, the full tile is overkill"
<div class="liked-tile">
    <img src="<?php echo wp_get_attachment_url($id); ?>" />
</div>
```

**Why this is destructive:** This tile has no data attributes, no lazy loading, no permission gating, no video support, no click-to-spotlight behavior, no download button, no srcset. It's a dead element that looks similar but does nothing.

**Correct approach:** `<?php echo abu_pg_render_tile($tile_post_id, false, 0); ?>`

---

### Anti-Pattern #4: "Helper Wrapper" for Spotlight

You want to add a new feature to the spotlight (e.g., a share modal). Instead of integrating it into the existing spotlight code, you:

```javascript
// WRONG: New container that wraps the spotlight
const wrapper = document.createElement('div');
wrapper.className = 'abu-pg-spotlight-feature-wrapper';
wrapper.appendChild(existingSpotlight);
wrapper.appendChild(shareModal);
document.body.appendChild(wrapper);
```

**Why this is destructive:** You've changed the DOM hierarchy of the spotlight. Every CSS rule that targets the spotlight by its parent relationship is now broken. The close function can't find the spotlight because it's nested in your wrapper. The scroll lock breaks because the body's direct child is now your wrapper, not the spotlight.

**Correct approach:** Add the share modal inside the existing spotlight structure, using the existing state object and the existing DOM hierarchy.

---

### Anti-Pattern #5: "Separate Mobile Fix"

Something looks wrong on mobile. Instead of finding the issue in the mobile spotlight code path, you:

```javascript
// WRONG: Detecting mobile and running different code
if (window.innerWidth < 768) {
    // Entirely separate rendering logic for mobile
    renderMobileVersion(item);
} else {
    renderDesktopVersion(item);
}
```

**Why this is destructive:** The system already has `shouldUseMobileLayout()` as the single source of truth for this decision, and `createSpotlight()` vs `createDesktopSpotlight()` as the separate implementations. Your new branch creates a third code path that nobody will maintain.

**Correct approach:** Find the bug in `createSpotlight()` or its related functions. Fix it there.

---

## Before You Touch Any UI Code

Ask yourself these questions. If you answer "no" or "unsure" to any of them, **stop and ask the user.**

1. Am I editing the canonical location for this element? (Listed above)
2. Was I explicitly asked to make this change?
3. Am I fixing a bug in place, or am I building around it?
4. Will this change affect masonry grid, desktop spotlight, or mobile spotlight — and have I considered all three?
5. Am I introducing any new HTML structure, CSS class, or JS function that duplicates existing functionality?
6. Have I searched for existing code that already does what I'm about to build?

---

## Testing After Any UI Change

| Context | Chrome Desktop | Safari Desktop | iPhone 14 Safari (tunnel) |
|---------|---------------|----------------|--------------------------|
| Masonry grid renders | | | |
| Images lazy load | | | |
| Videos show poster + play | | | |
| Tile click opens spotlight | | | |
| Desktop spotlight layout | | | N/A |
| Desktop right column tiles | | | N/A |
| Mobile spotlight carousel | N/A | N/A | |
| Mobile swipe left/right | N/A | N/A | |
| Mobile swipe up/down close | N/A | N/A | |
| Spotlight action buttons | | | |
| Download (logged in) | | | |
| Download hidden (logged out) | | | |
| Icons render correctly | | | |
| SPA navigation (tile to tile) | | | |
| Back button works | | | |

---

## File Reference

| Component | Canonical Location | Type |
|-----------|-------------------|------|
| Tile HTML rendering | `abu_pg_render_tile()` in `abu-pinterest-gallery.php` | PHP |
| Gallery + chapter structure | `abu_pg_render_full_gallery()` in `abu-pinterest-gallery.php` | PHP |
| Icon loading | `your_plugin_icon()` in `abu-pinterest-gallery.php` | PHP |
| Desktop spotlight | `createDesktopSpotlight()` and related in `gallery.js` | JS |
| Mobile spotlight | `createSpotlight()` and related in `gallery.js` | JS |
| SPA spotlight renderer | `renderSpotlightForTile()` in `gallery.js` | JS |
| Masonry layout | `gallery.js` | JS |
| All visual styles | `/assets/css/gallery.css` | CSS |
| Chapter styles | `/assets/css/abu-chapters.css` | CSS |

---

## Summary

1. **Every UI element has one canonical location.** Use it.
2. **Never build around a bug.** Fix it where it lives.
3. **Never create "simplified" versions of existing components.** The existing version is the version.
4. **Never add workaround HTML, CSS, or JS.** Every workaround becomes permanent debt.
5. **If you don't understand the existing code, stop and ask.** The worst outcome is a confident workaround that breaks three other things.
6. **Desktop and mobile spotlights are separate systems.** Don't conflate them, don't merge them, don't create a third.
7. **Surgical edits only.** Small, targeted, in the canonical location, with clear reasoning.

---

## Desktop Spotlight Media Inner Wrapper (2026-02-06)

The desktop spotlight left column media is wrapped in `.abu-pg-desktop-spotlight-media-inner` — a `<div>` with `position: relative` and `aspect-ratio` set from the item's dimensions. This is the positioning context for all media overlays and buttons.

**Children of `.abu-pg-desktop-spotlight-media-inner`:**
- `img` or `video` — fills the wrapper (`width: 100%; height: 100%; object-fit: cover`)
- `.abu-pg-desktop-spotlight-poster` — `position: absolute; inset: 0` (video only, fades on play)
- `.abu-pg-desktop-spotlight-play-prompt` — `position: absolute; inset: 0` (direct URL video only, removed after first play)
- `.abu-pg-fullscreen-btn` — `position: absolute; right: 10px; bottom: 10px` (maximize button)

**Why:** The outer `mediaWrapper` has padding and flex centering, so absolute positioning within it doesn't correspond to the media's edges. The inner wrapper sizes itself via `aspect-ratio` and `max-width: 90%; max-height: 90%`, matching the media's rendered bounds exactly. All children use simple `inset: 0` or fixed pixel offsets — no `calc()` hacks.

**Fullscreen view:** Clicking the maximize button opens `.abu-pg-fullscreen-overlay` (appended to `body`, `z-index: 100000`). Contains a cloned media element centered in the viewport (`max-height: 90vh; max-width: 80vh`) with a dark backdrop and close button. Closing animates the clone back to the spotlight position and removes the overlay from the DOM. For videos, the original is paused while fullscreen is active and resumes on close.
