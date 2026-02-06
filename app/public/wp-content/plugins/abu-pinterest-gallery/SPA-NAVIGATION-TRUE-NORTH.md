# SPA Navigation — True North

> **This is an aspirational document.** It describes how SPA navigation *should* work when functioning correctly. If the current implementation deviates from what is described here, this document is right and the code has a bug. Refer to this document before modifying or debugging any navigation code.

**Last Updated:** 2026-02-06

---

## 1. Purpose

Users browse Content Kits full of media tiles. When they click a tile, a spotlight opens. On desktop, the spotlight shows the tile's media in a left column with a masonry grid of adjacent tiles in a right column. On mobile, the spotlight is a full-screen carousel. In both cases, users must be able to navigate from tile to tile indefinitely — no page reloads, no lost context, no empty states — just like Pinterest. The browser back/forward buttons must work correctly throughout.

---

## 2. Architecture Overview

### Two Navigation Contexts

The SPA navigation system operates in two distinct contexts:

| Context | Entry Point | URL Pattern | Rendered By |
|---------|------------|-------------|-------------|
| **Gallery Page** | User visits a Content Kit | `/content-kit/{slug}/` | `single-abu_content_kit.php` → shortcode → `abu_pg_render_full_gallery()` |
| **Tile Permalink** | User visits a tile directly (shared link, bookmark, or SPA push) | `/tile/{slug}/?kit={id}` | `single-tile.php` → JSON data → `openSpotlightForTilePermalink()` |

### Key Components

| Component | Location | Role |
|-----------|----------|------|
| `URLStateManager` | `gallery.js` (~line 516) | Manages URL state for chapter navigation and tile open/close on gallery pages. Uses `pushState`/`replaceState`. |
| `GalleryStateManager` | `gallery.js` (~line 5440) | Singleton cache. Stores kit tile metadata in memory + sessionStorage. Enables tile-to-tile SPA navigation without server round-trips. |
| `navigateToTile()` | `gallery.js` (~line 5658) | The SPA navigation primitive. Pushes history state, re-renders spotlight from cache. No page reload. |
| `renderSpotlightForTile()` | `gallery.js` (~line 5733) | Shared spotlight renderer used by both SPA navigation and permalink init. Handles desktop and mobile layouts. |
| `openSpotlightForTilePermalink()` | `gallery.js` (~line 6148) | Entry point for tile permalink pages. Called by `single-tile.php` inline script. Seeds cache, sets initial history state, then delegates to `renderSpotlightForTile()`. |
| `popstate` listener | `gallery.js` (~line 6054) | Handles browser back/forward. Re-renders from cache or falls back to reload. |
| REST endpoint | `abu-pinterest-gallery.php` | `GET /wp-json/abu-pg/v1/kit/{kitId}/tiles` — bootstrap endpoint for when cache is empty on direct URL visits. |

---

## 3. Data Flow

### 3a. Gallery Page → Spotlight → SPA Navigate

```
1. PHP renders masonry grid via abu_pg_render_full_gallery()
   └─ Each tile has data-* attributes (id, permalink, type, urls, dimensions)

2. User clicks/taps tile in masonry grid
   └─ JS reads tile data-* attributes → opens spotlight
   └─ URLStateManager.setOpenTile(permalink, kitId)
   └─ history.pushState → URL becomes /tile/{slug}/?kit={id}

3. Spotlight renders (layout depends on device):
   └─ DESKTOP: left column = media, right column = adjacent tile masonry grid
   └─ MOBILE: full-screen carousel with current tile + adjacent tiles

4. User navigates to next tile:
   └─ DESKTOP: clicks adjacent tile in right column
   └─ MOBILE: swipes left or right in carousel
   └─ navigateToTile(tileId, permalink, kitId) is called
   └─ GalleryStateManager.ensureKit(kitId) → returns cached kit context
   └─ history.pushState → URL updates to new tile permalink
   └─ renderSpotlightForTile() → spotlight re-renders with new tile
   └─ NO PAGE RELOAD
```

### 3b. Direct Tile Permalink (fresh window / shared link)

```
1. PHP (single-tile.php) renders:
   └─ Tile metadata as JSON in <script type="application/json" id="abu-pg-tile-data">
   └─ Kit context as JSON in <script type="application/json" id="abu-pg-kit-context">
   └─ All adjacent tiles loaded via abu_pg_get_all_tiles_from_kit()
   └─ Icon templates in hidden DOM elements

2. Inline JS calls openSpotlightForTilePermalink(tileData, kitContext)
   └─ Seeds GalleryStateManager cache with kit tiles
   └─ Sets history.replaceState with {type:'tile', tileId, kitId, kitUrl}
   └─ Delegates to renderSpotlightForTile()

3. Subsequent tile clicks follow the same SPA flow as 3a step 4
```

### 3c. Direct Tile Permalink (cache empty, no PHP-provided adjacent tiles)

```
1. navigateToTile() is called but cache is empty
   └─ GalleryStateManager.ensureKit(kitId) checks:
       a. In-memory cache → miss
       b. sessionStorage → miss
       c. REST API fetch: GET /wp-json/abu-pg/v1/kit/{kitId}/tiles → 200
   └─ Response cached in memory + sessionStorage
   └─ Tile found in cache → renderSpotlightForTile()
```

---

## 4. Cache Architecture

### GalleryStateManager

```
┌──────────────────────────────────────────┐
│  GalleryStateManager (Singleton)         │
├──────────────────────────────────────────┤
│  cache: Map<kitId, kitContext>           │  ← In-memory (fast, lost on page reload)
│  currentSpotlight: state | null          │  ← Active spotlight reference
│  tileTemplates: {image, video} | null    │  ← Cloned DOM templates for tile rendering
├──────────────────────────────────────────┤
│  API:                                    │
│    hasKit(kitId) → bool                  │
│    getKit(kitId) → kitContext | null      │
│    setKit(kitId, kitContext)             │  ← Writes to memory + sessionStorage
│    ensureKit(kitId) → kitContext | null   │  ← Memory → sessionStorage → REST API
│    getTemplates() → {image, video}       │
│    clear()                               │
└──────────────────────────────────────────┘
```

### kitContext Shape

```js
{
  kitId: Number,       // Content Kit post ID
  kitUrl: String,      // Kit permalink (for back navigation)
  kitTitle: String,    // Kit title (optional)
  tiles: [             // Ordered array of ALL tiles in the kit
    {
      id: Number,            // Tile post ID (abu_pg_tile CPT)
      attachmentId: Number,  // WP attachment ID
      type: 'image' | 'video',
      url: String,           // Primary media URL
      permalink: String,     // Canonical tile URL (/tile/{slug}/?kit={kitId})
      title: String,
      filename: String,
      created: String,       // ISO 8601
      width: Number,
      height: Number,
      // Image-specific:
      gridUrl, webUrl, originalUrl, gridSrcset, gridSizes, previewSrc,
      // Video-specific:
      poster, src720, src360, srcOriginal
    }
  ],
  cachedAt: Number     // Timestamp (auto-added by setKit)
}
```

### Why sessionStorage (not localStorage)

- Clears when tab closes → automatic cache invalidation
- Admin edits kit → user closes tab → reopens → gets fresh data
- No manual cache-busting needed
- Scoped to tab, so multiple tabs can have independent state

---

## 5. History API Contract

### History State Shapes

```js
// Tile spotlight state (pushed by navigateToTile, replaced by openSpotlightForTilePermalink)
{
  type: 'tile',
  tileId: Number,
  kitId: Number,
  kitUrl: String    // For "back to gallery" navigation
}

// Gallery state (pushed by URLStateManager when closing spotlight)
{
  type: 'gallery',
  kitUrl: String
}
```

### URL Patterns

| State | URL | Who Sets It |
|-------|-----|------------|
| Gallery page | `/content-kit/{slug}/` | WordPress (initial) |
| Gallery with chapter | `/content-kit/{slug}/?chapter={slug}` | `URLStateManager` |
| Tile in spotlight | `/tile/{slug}/?kit={kitId}` | `navigateToTile()` or `URLStateManager.setOpenTile()` |
| Debug mode | Any URL + `?abu_pg_debug=1` | Manual (preserved across navigations) |

### The `?kit=` Parameter

This is critical. It tells `single-tile.php` which Content Kit provides context for this tile. Without it:
- The tile still renders (tiles are publicly viewable)
- But the right column has no adjacent tiles (no kit context)
- SPA navigation has no cache to draw from

The `?kit=` parameter is appended to tile permalinks by:
- `abu_pg_render_tile()` in PHP (when `$kit_id` is passed)
- `navigateToTile()` in JS (already part of the permalink from PHP)

---

## 6. Popstate Behavior (Back/Forward)

The `popstate` listener at line ~6054 handles all back/forward navigation:

| popstate state | Action |
|----------------|--------|
| `null` (no state) | Close spotlight if open. If URL is a tile permalink, reload. If URL is a gallery, reload. |
| `{type: 'tile', tileId, kitId}` | Look up tile in `GalleryStateManager.getKit(kitId)`. If found, `renderSpotlightForTile()`. If cache miss, `window.location.reload()`. |
| `{type: 'gallery', kitUrl}` | Close spotlight. Reload gallery page. |

### Graceful Degradation

Every SPA path has a full-page-reload fallback:
- Cache miss → `window.location.href = tilePermalink` (server renders tile)
- REST API failure → `window.location.href = tilePermalink`
- Tile not found in cache → `window.location.href = tilePermalink`
- popstate with missing cache → `window.location.reload()`

**The system never breaks. It either navigates via SPA or falls back to a full page load.**

---

## 7. Template System (Desktop Right Column)

The desktop spotlight right column renders a masonry grid of adjacent tiles. These tiles need the same HTML structure as the main masonry grid (buttons, overlays, etc.). Templates are managed by `GalleryStateManager.getTemplates()`.

Mobile spotlight does not use this template system — it renders tiles directly in the carousel.

**Template source priority:**
1. Main gallery masonry grid (`.abu-pg-chapters-wrapper` tiles) — best source, has all permission-gated buttons
2. Spotlight right column grid (`.abu-pg-desktop-spotlight-right-grid` tiles) — for deep-link scenarios
3. Any tile in the document — fallback
4. Empty templates — last resort (right column renders without tile chrome)

Templates are created once (via `createTemplates()`) and cached on `GalleryStateManager.tileTemplates`. When `initGallery()` runs for a masonry grid, it caches templates there for later SPA use.

**Critical rule:** Templates are cloned DOM nodes from PHP-rendered tiles. They inherit the correct permission state (download buttons present/absent based on login). Do not construct tile HTML in JavaScript.

---

## 8. Performance: Windowing

For kits with many tiles, the desktop right column uses windowing:
- Only ~20 tiles are rendered in the DOM around the current tile (configurable)
- Full tile metadata stays in memory (lightweight JSON)
- As user navigates, the window slides
- Prevents DOM bloat for kits with hundreds of tiles

Mobile carousel should also limit rendered tiles to a reasonable window around the current position to prevent memory pressure on mobile devices.

---

## 9. Mobile Spotlight (Separate System)

The mobile spotlight is **not** a responsive version of the desktop spotlight. It is a completely separate UI and interaction model with its own code paths.

### Desktop vs. Mobile — Key Differences

| Aspect | Desktop | Mobile |
|--------|---------|--------|
| Layout | Two-column: media left, masonry right | Full-screen single media |
| Created by | `createDesktopSpotlight(state)` | `createSpotlight(state)` |
| Tile-to-tile navigation | Click adjacent tile in right column → `navigateToTile()` | **Swipe left/right** through tile carousel |
| Close gesture | Click backdrop / ESC key / back button | **Swipe up/down** to dismiss |
| Right-hand masonry grid | Yes — shows ~20 adjacent tiles | **No** — does not exist on mobile |
| Layout decision | `shouldUseMobileLayout()` — single source of truth | Same function |

### Mobile SPA Navigation Flow

```
1. User opens spotlight on mobile (tap tile in masonry grid, or direct permalink)
   └─ shouldUseMobileLayout() → true
   └─ createSpotlight(state) builds full-screen carousel
   └─ Carousel contains the current tile + adjacent tiles from kit context

2. User swipes LEFT or RIGHT
   └─ Carousel advances to next/previous tile
   └─ URL should update via history.pushState (SPA, no reload)
   └─ Cache provides tile data — no server round-trip

3. User swipes UP or DOWN
   └─ Spotlight closes
   └─ URL should restore to kit gallery URL
   └─ Back button should return to gallery

4. User taps browser back button
   └─ popstate fires → same handler as desktop
   └─ Spotlight should navigate to previous tile or close
```

### Shared Infrastructure

Despite having separate UI code, mobile and desktop share these SPA components:
- `GalleryStateManager` — same cache, same `ensureKit()`, same `setKit()`
- `renderSpotlightForTile()` — branches internally based on `shouldUseMobileLayout()`
- `navigateToTile()` — same function, same history pushState
- `popstate` listener — same handler
- `openSpotlightForTilePermalink()` — same entry point for direct tile URLs

### Mobile Testing

- Device: iPhone 14, Safari, private browsing mode
- Network: Local WP tunnel (not localhost)
- Key things to verify: swipe navigation works, URL updates on swipe, back button works, no blank screens, no stale state after swipe-to-close

---

## 10. WordPress Integration Points

| Integration | Mechanism | File |
|-------------|-----------|------|
| Tile CPT permalinks | `register_post_type('abu_pg_tile', ['rewrite' => ['slug' => 'tile']])` | `abu-pinterest-gallery.php` |
| Tile template | `template_include` filter → `templates/single-tile.php` | `abu-pinterest-gallery.php` |
| Kit template | `template_include` filter → `templates/single-abu_content_kit.php` | `abu-pinterest-gallery.php` |
| REST API | `register_rest_route('abu-pg/v1', '/kit/{kit_id}/tiles')` | `abu-pinterest-gallery.php` |
| Tile data in PHP | `abu_pg_get_tile_metadata()`, `abu_pg_get_all_tiles_from_kit()` | `abu-pinterest-gallery.php` |
| Script localization | `wp_localize_script('abu-pg-gallery', 'abuPgConfig', [...])` | `abu-pinterest-gallery.php` shortcode + `single-tile.php` |
| Flush rewrites | Required after activation — visit Settings > Permalinks > Save | `abu-pinterest-gallery.php` header comment |

---

## 11. Edge Cases & Required Behaviors

### Tile with no `?kit=` parameter
- Spotlight opens with tile media only
- No right column adjacent tiles
- No SPA navigation (no cache to draw from)
- Back button closes spotlight or navigates normally

### Kit not published
- REST API returns 403
- `ensureKit()` returns null
- Falls back to full page navigation

### sessionStorage disabled (private browsing edge case)
- In-memory cache still works within the session
- `setKit()` catches the error silently
- On page reload, cache is lost → REST API re-fetches

### User logs in/out during session
- Auth state is checked via `abuPgConfig.isLoggedIn` (set at page load)
- Tile templates carry permission state from when they were rendered
- A page reload resets templates with correct permissions
- SPA navigation reuses existing templates — permissions may be stale until reload

### Tile belongs to multiple kits
- The `?kit=` parameter determines which kit provides context
- `abu_pg_find_kits_containing_tile()` can find all kits, but the URL specifies one
- Adjacent tiles are always from the kit specified in `?kit=`

### Very large kits (hundreds of tiles)
- REST API returns all tiles (metadata only, no HTML)
- In-memory cache holds all tile metadata (~200 bytes per tile = ~200KB for 1000 tiles)
- sessionStorage has a ~5MB limit — approximately 25,000 tiles before quota exceeded
- DOM windowing keeps only ~20 tiles rendered at a time

### Network failure during ensureKit()
- `fetch()` throws → caught by try/catch
- `ensureKit()` returns null
- `navigateToTile()` falls back to `window.location.href`
- User sees a full page load instead of SPA transition

### Back button from first tile to gallery
- popstate fires with `{type: 'gallery'}` or `null`
- Spotlight closes (desktop close or mobile dismiss)
- Page reloads to show gallery masonry grid

### Mobile swipe-to-close
- User swipes up or down to dismiss mobile spotlight
- URL should restore to the kit gallery URL
- History state should be updated so back button returns to gallery, not to the dismissed spotlight
- Spotlight state should be fully cleaned up (no orphaned DOM, no stale currentSpotlight reference)

---

## 12. Debug Tools

### Enable debug logging
Append `?abu_pg_debug=1` to any URL. All SPA operations log to console with `[NAV DEBUG]` prefix.

### Console API
```js
window.abuPgGalleryState.hasKit(123)   // Check if kit is cached
window.abuPgGalleryState.getKit(123)   // Get full kit context
window.abuPgGalleryState.cache         // View all cached kits
window.abuPgGalleryState.clear()       // Clear all caches

history.state                          // Current history state

sessionStorage.getItem('abu_pg_kit_123')  // View persisted cache
```

### REST API test
```
GET /wp-json/abu-pg/v1/kit/{kitId}/tiles
```
Returns: `{ kitId, kitUrl, kitTitle, tiles: [...] }` or error with appropriate HTTP status.

---

## 13. Rules for Modification

1. **Never duplicate spotlight rendering logic.** `renderSpotlightForTile()` is the single entry point for SPA spotlight rendering. Both desktop and mobile.

2. **Never construct tile HTML in JavaScript.** Tile templates come from PHP-rendered DOM nodes via `createTemplates()`. This preserves permission gating and icon system integrity.

3. **Always fall back to full page navigation.** Every SPA code path must have a `window.location.href` or `window.location.reload()` fallback.

4. **Preserve the `?kit=` parameter.** It is the link between a tile and its kit context. Without it, SPA navigation has no cache key.

5. **Do not bypass `GalleryStateManager`.** All cache reads/writes go through this singleton. Direct sessionStorage access outside of it will create inconsistencies.

6. **Test both contexts.** Any navigation change must be tested from both the gallery page entry and the direct tile permalink entry.

7. **Test back/forward.** After any change, verify: click/swipe through 5+ tiles → back 5 times → forward 5 times. No reloads, no blank screens.

8. **Respect `shouldUseMobileLayout()`.** This is the single source of truth for mobile vs desktop layout decisions. Never add separate mobile detection.

9. **Test both desktop and mobile.** Desktop and mobile are separate UI systems that share SPA infrastructure. A fix to one can break the other. Always test both after any navigation change.

10. **Mobile swipe must update URL and history.** Every swipe-to-navigate on mobile must call the same `navigateToTile()` / `history.pushState` path as a desktop right-column click. The URL in the browser bar must always reflect the currently displayed tile.
