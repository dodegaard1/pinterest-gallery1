# ABU Pinterest Gallery — True North

> **This is an aspirational document.** It describes what this plugin is, how it is structured, and the principles that govern all work on it. If the current implementation deviates from what is described here, this document is right and the code has a bug. Read this before making any changes.

**Last Updated:** 2026-02-06

---

## 1. What This Plugin Is

ABU Pinterest Gallery is the core plugin of a Pinterest-style media platform built for A Beautiful Union. It allows wedding vendors to browse, view, and download photos and videos from weddings they participated in.

The plugin provides:
- **Content Kits** — gallery posts containing organized chapters of media
- **Tiles** — canonical resources representing individual media items (photos and videos)
- **Gallery Maker** — a Gutenberg block for creating and organizing Content Kits
- **Masonry grid** — Pinterest-style layout for browsing tiles
- **Spotlight** — full-screen media viewer (desktop two-column and mobile carousel are separate systems)
- **SPA navigation** — tile-to-tile navigation without page reloads
- **Social features** — likes, comments, downloads (login-gated)
- **Templates** — custom templates for Content Kits, tile permalinks, and organization archives

It does **not** provide: user management (see ABU Users plugin), video processing (see Video Behavior plugin), or theme modifications.

---

## 2. Architecture at a Glance

```
ABU Pinterest Gallery
├── abu-pinterest-gallery.php     ← All PHP: CPTs, rendering, permissions, REST API, AJAX
├── gallery-maker/                ← Gutenberg block (admin-only, React/JSX)
│   ├── block.json
│   ├── src/edit.js               ← Block editor UI (chapters + media library)
│   └── build/                    ← Compiled block assets
├── templates/
│   ├── single-abu_content_kit.php ← Content Kit page (auto-renders gallery shortcode)
│   ├── single-tile.php            ← Tile permalink (spotlight-first view)
│   └── taxonomy-abu_organization.php ← Organization dashboard (kit cards)
├── assets/
│   ├── css/gallery.css            ← All visual styles (masonry, spotlight, tiles)
│   ├── css/abu-chapters.css       ← Chapter navigation styles
│   ├── js/gallery.js              ← All frontend JS (~6400 lines, single file)
│   ├── js/abu-chapters.js         ← Chapter nav: smooth scroll, active highlighting
│   └── icons/radix/               ← SVG icon library (~207 icons)
```

### Single-File Principles

- **One PHP file** (`abu-pinterest-gallery.php`) contains all server-side logic. CPT registration, rendering, permissions, REST API, AJAX handlers, image sizes, save hooks — everything. Do not split this into multiple files unless the plugin grows to a point where a single file is genuinely unmanageable (we are not there).
- **One JS file** (`gallery.js`) contains all frontend logic. Masonry layout, lazy loading, both spotlight systems, SPA navigation, video controls, likes, comments, downloads — everything. Same principle.
- **One CSS file** (`gallery.css`) contains all visual styles for both desktop and mobile, masonry and spotlight. The only other stylesheet is `abu-chapters.css` for chapter navigation.

**Why single files?** Easier to search, easier to audit, fewer import chains to break, no module bundling complexity for the frontend JS. The Gallery Maker block is the exception — it's a compiled Gutenberg block that uses React and necessarily has a build step.

---

## 3. Custom Post Types

| CPT | Slug | Public | Admin UI | Purpose |
|-----|------|--------|----------|---------|
| `abu_content_kit` | `content-kit` | Yes | Yes | Gallery posts with chapters of tiles |
| `abu_pg_tile` | `tile` | Yes (permalink) | No (hidden) | Canonical resource for a single media item |

Content Kits are what users browse. Tiles are what users view, like, comment on, and download. See `CANONICAL-TILES-TRUE-NORTH.md` for the full tile specification.

### Content Kit Data Model

```
abu_content_kit post
├── post_title, post_content, post_excerpt, thumbnail (standard WP fields)
├── abu_pg_chapters_json (post meta — JSON string)
│   └── Array of chapters, each with id, name, order, tileIds[]
├── abu_pg_tile_index (repeated post meta — one row per tile ID)
│   └── Enables fast "which kits contain this tile?" queries
└── abu_organization taxonomy terms (tagged organizations)
```

### Taxonomy

| Taxonomy | Slug | Registered By | Applied To |
|----------|------|---------------|------------|
| `abu_organization` | `organization` | ABU Users plugin | `abu_content_kit` |

The organization taxonomy is **registered by ABU Users** but **used by this plugin** for tagging kits and rendering archive pages.

---

## 4. Gallery Maker (Admin)

The Gallery Maker is a Gutenberg block (`abu/gallery-maker`) that provides the admin interface for creating Content Kits. It uses:

- **WordPress block API** (`@wordpress/scripts`, `@wordpress/element`, `@wordpress/components`)
- **`@dnd-kit`** for drag-and-drop media reordering within chapters (this is the only third-party dependency in the entire platform)
- **WordPress Media Library** for selecting and uploading media
- **Post meta** (`abu_pg_chapters_json`) for storing chapter data via `useEntityProp`

### How Content Gets Created

```
1. Admin clicks "Gallery Maker" in admin menu
   └─ Redirects to: post-new.php?post_type=abu_content_kit

2. Admin adds the ABU Gallery Maker block to the post

3. Admin clicks "Edit Gallery" → full-screen modal opens
   └─ Left sidebar: chapter list (add, rename, select)
   └─ Right pane: media grid (add from library, drag to reorder, remove)

4. Admin clicks "Add Media" → WordPress Media Library modal opens
   └─ Admin selects images/videos → attachment IDs added to chapter's mediaIds[]

5. Admin publishes the Content Kit
   └─ On save, plugin intercepts and converts attachment IDs to tile IDs
   └─ abu_pg_get_or_create_tile_post_for_attachment() runs for each attachment
   └─ Chapter data rewritten with tileIds[] (canonical) instead of mediaIds[] (legacy)
   └─ Kit-to-tile index rebuilt
```

### Build System

The Gallery Maker block uses `@wordpress/scripts` for compilation:

```bash
npm run build    # Production build → gallery-maker/build/
npm run start    # Development watch mode
```

The compiled output lives in `gallery-maker/build/` and is committed to the repo so the plugin works without a build step on deployment. The `src/` directory contains the source JSX.

**Important:** The Gallery Maker is admin-only. It does not run on the frontend. Frontend rendering is handled entirely by the shortcode and PHP rendering functions.

---

## 5. Frontend Rendering Pipeline

### Shortcode: `[abu_pinterest_gallery]`

The shortcode is the entry point for all frontend gallery rendering. It:

1. Determines which post to read gallery data from (`kit_id` attribute or current post)
2. Reads `abu_pg_chapters_json` from post meta
3. Parses and validates chapters via `abu_pg_parse_chapters()`
4. Enqueues CSS and JS assets
5. Localizes `abuPgConfig` with auth state and AJAX endpoints
6. Calls `abu_pg_render_full_gallery()` to generate the HTML

### Rendering Hierarchy

```
abu_pg_shortcode()
└─ abu_pg_render_full_gallery($post_id, $chapters, $debug_enabled)
   ├─ Icon templates (hidden DOM elements for JS cloning)
   ├─ <nav> sticky chapter navigation
   └─ For each chapter:
      └─ <section> with <div class="abu-pg-gallery">
         └─ For each tile ID:
            └─ abu_pg_render_tile($tile_post_id, $debug_enabled, $kit_id)
               ├─ Validates tile CPT post
               ├─ Gets attachment from tile
               ├─ Resolves image variants or video derivatives
               ├─ Checks permissions (download, like)
               └─ Outputs <div class="abu-pg-tile"> with all data-* attributes
```

### Template Hierarchy

| URL Pattern | Template | What It Does |
|-------------|----------|-------------|
| `/content-kit/{slug}/` | `single-abu_content_kit.php` | Calls `do_shortcode('[abu_pinterest_gallery]')` |
| `/tile/{slug}/?kit={id}` | `single-tile.php` | Renders spotlight-first view with JSON tile/kit data |
| `/organization/{slug}/` | `taxonomy-abu_organization.php` | Queries Content Kits tagged with org, renders kit cards |

Templates are loaded via the `template_include` filter. They do not modify the active theme.

---

## 6. Frontend JavaScript Systems

`gallery.js` is a single IIFE (~6400 lines) containing all frontend logic. The major systems:

| System | Purpose | Key Functions |
|--------|---------|---------------|
| Masonry layout | Column-based tile positioning | `initGallery()`, chunked rendering |
| Lazy loading | IntersectionObserver-based image/video loading | Tiles use `data-src` instead of `src` |
| Desktop spotlight | Two-column overlay (media + right column) | `createDesktopSpotlight()`, `openDesktopSpotlight()`, `closeDesktopSpotlight()` |
| Mobile spotlight | Full-screen carousel with swipe gestures | `createSpotlight()`, `openSpotlight()`, `closeSpotlight()` |
| SPA navigation | Tile-to-tile navigation without reloads | `GalleryStateManager`, `navigateToTile()`, `renderSpotlightForTile()` |
| URL state | History API management for chapters and tiles | `URLStateManager` |
| Video controls | Play/pause, mute, quality selection | Integrated into tile and spotlight rendering |
| Likes | Heart button toggle with AJAX | Like/unlike via `wp_ajax_abu_pg_like_tile` |
| Comments | Load, submit, delete comments in spotlight | Via `wp_ajax_abu_pg_submit_comment` etc. |
| Downloads | Download button with original file URL | Permission-gated by login state |

**See also:**
- `SPA-NAVIGATION-TRUE-NORTH.md` for the SPA navigation specification
- `UI-ELEMENTS-TRUE-NORTH.md` for the UI element architecture and modification rules
- `CANONICAL-TILES-TRUE-NORTH.md` for the tile data model and rendering rules

---

## 7. Image and Video Handling

### Image Variants

Three custom sizes registered via `add_image_size()`:

| Name | Max Width | Purpose |
|------|-----------|---------|
| `abu_grid` | 600px | Masonry tiles (optimized for ~280px @ 2x retina) |
| `abu_web` | 2048px | Spotlight view and sharing |
| Original | Unlimited | Download. Uses `abu_pg_get_original_image_url()` to bypass WP's `-scaled` suffix. |

### Video Derivatives

Handled by the **Video Behavior by ABU** plugin. When an MP4 is uploaded:

1. Video Behavior queues it for FFmpeg processing
2. Generates: poster image (JPG), 720p video (MP4), 360p video (MP4)
3. Stores derivatives in `wp-content/uploads/abu-video/{attachment_id}/`
4. Registers derivatives as child attachment posts

This plugin reads those derivatives at render time via attachment meta and filesystem fallbacks. It does not perform any video processing itself.

---

## 8. Permissions Model

### Viewing

All tiles and Content Kits are **publicly viewable**. Logged-out users can browse galleries, view tiles in spotlight, and visit tile permalinks. This is by design — the platform is a showcase.

### Feature-Level Gating

| Feature | Logged Out | Logged In | Enforcement |
|---------|-----------|-----------|-------------|
| View media | Yes | Yes | `abu_pg_user_can_view_tile()` always returns true |
| Download | No | Yes | UI hidden + server-side login check |
| Like | No | Yes | AJAX handler checks `is_user_logged_in()` |
| Comment | No | Yes | AJAX handler + `preprocess_comment` filter |
| Right-click images | Blocked | Allowed | JS context menu prevention (deterrent only) |

### How Permissions Flow

1. **PHP** (`abu_pg_render_tile`): Checks `is_user_logged_in()` → conditionally renders download button HTML
2. **PHP** (`wp_localize_script`): Sets `abuPgConfig.isLoggedIn`, `canDownload`, `canLike`, etc.
3. **HTML**: Tile `data-can-download="true/false"` attributes
4. **JS**: Reads `abuPgConfig` and data attributes to show/hide UI
5. **Server**: AJAX handlers independently verify login + permissions before processing

All five layers must agree. UI-only gating is never sufficient.

---

## 9. REST API

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/wp-json/abu-pg/v1/kit/{kitId}/tiles` | GET | Public | Returns all tile metadata for a kit. Used by SPA navigation to bootstrap cache when empty. |

Response shape:
```json
{
  "kitId": 123,
  "kitUrl": "/content-kit/example/",
  "kitTitle": "Example Kit",
  "tiles": [ /* array of tile metadata objects */ ]
}
```

Returns 404 if kit doesn't exist. Returns 403 if kit is not published.

---

## 10. Development Environment

| Setting | Value |
|---------|-------|
| Local environment | Local WP on MacBook Pro |
| PHP runtime | Local WP's built-in PHP |
| WordPress site | `abu-dev.local` (or similar) |
| Desktop testing | Chrome and Safari |
| Mobile testing | iPhone 14, Safari, private browsing, via Local WP tunnel |
| Build tools | `@wordpress/scripts` (Gallery Maker block only) |
| Debug mode | Append `?abu_pg_debug=1` to any URL |
| Debug log | `.cursor/debug.log` (dev only, not production) |

### No Third-Party Runtime Dependencies

The frontend JS (`gallery.js`) has **zero external dependencies**. No jQuery, no React, no lodash. It is vanilla JavaScript.

The only dependency is `@dnd-kit` in the Gallery Maker block, which is a Gutenberg editor component — it runs in the admin only, never on the frontend.

### Plugin Portability

This plugin must remain **fully portable** — it can be installed on any WordPress site by dropping the plugin folder into `wp-content/plugins/`. No external services, no API keys, no CDN dependencies, no build step required for the frontend.

---

## 11. Scalability Considerations

The production site will host **hundreds of thousands of media files** and **hundreds of users**.

### What Scales Well

- **Tiles as CPT posts**: WordPress can handle millions of posts. Each tile is a lightweight post with a few meta values.
- **Tile metadata**: Stored in `wp_postmeta`. Standard indexed queries.
- **Kit-to-tile index**: Repeated meta key pattern (`abu_pg_tile_index`). Fast indexed lookups via `WP_Query`.
- **Comments**: WordPress native `wp_comments` table. Pagination, moderation, and spam filtering built in.
- **Image variants**: WordPress generates variants on upload. Served as static files. No per-request processing.
- **SPA navigation cache**: `sessionStorage` per browser tab. ~200 bytes per tile. Handles thousands of tiles per kit.

### What to Watch

- **Likes as serialized arrays**: `_abu_pg_likes` stores all user IDs in one meta row. Works up to a few hundred likes per tile. At higher scale, migrate to repeated meta key pattern (one row per like). See `CANONICAL-TILES-TRUE-NORTH.md` Section 9.
- **REST API for large kits**: `/wp-json/abu-pg/v1/kit/{kitId}/tiles` returns all tiles at once. For kits with 1000+ tiles, consider pagination.
- **`abu_pg_find_kits_containing_tile()`**: Scans all kits via meta query. Fine for dozens of kits. At hundreds of kits, consider caching results or adding a reverse-index on the tile side.
- **Video derivatives**: FFmpeg processing is CPU-intensive. Queue-based (handles one batch at a time). At scale, would need a background worker or external processing service.
- **sessionStorage limit**: ~5MB per origin. Approximately 25,000 tiles before quota exceeded per tab. Unlikely to be a problem.

### What Must Never Happen

- **No custom database tables.** WordPress core storage primitives handle everything.
- **No external API dependencies.** The plugin must work fully offline (relative to external services).
- **No per-request image/video processing.** All media variants are generated on upload, served as static files.

---

## 12. Limitations

### Architectural Limitations

- **Single-chapter rendering**: The shortcode renders all chapters of a kit on one page. There is no paginated chapter view. For kits with many chapters, this means a long page (mitigated by lazy loading and chunked rendering).
- **One organization per user**: ABU Users assigns a single primary organization. Multi-org membership is not yet supported.
- **No search**: Tiles are excluded from WordPress search (`exclude_from_search: true`). There is no custom tile search feature.
- **No tile editing UI**: Tiles are managed indirectly through the Gallery Maker. There is no way to edit tile metadata (title, alt text) from the tile itself — you edit the underlying attachment in the Media Library.

### Browser/Device Limitations

- **Safari private browsing**: sessionStorage works but may have stricter quota limits. The SPA cache falls back to in-memory only.
- **iOS video autoplay**: Videos must be muted to autoplay on iOS Safari. The plugin handles this (videos start muted, user can unmute).
- **Mobile viewport**: The mobile spotlight is tested on iPhone 14. Other mobile devices may have viewport quirks that need testing.

---

## 13. Related True North Documents

| Document | Location | Scope |
|----------|----------|-------|
| `CANONICAL-TILES-TRUE-NORTH.md` | This plugin directory | Tile CPT, lifecycle, meta, permissions, rendering, future extensibility |
| `SPA-NAVIGATION-TRUE-NORTH.md` | This plugin directory | SPA navigation architecture, cache, History API, popstate, edge cases |
| `UI-ELEMENTS-TRUE-NORTH.md` | This plugin directory | Canonical UI element locations, anti-patterns, modification rules |
| `ABU-USERS-TRUE-NORTH.md` | `abu-users/` directory | User management, organizations, invitations, auth, security |

---

## 14. Rules for Working on This Plugin

1. **Read the relevant True North document first.** If you're working on tiles, read `CANONICAL-TILES-TRUE-NORTH.md`. If you're working on navigation, read `SPA-NAVIGATION-TRUE-NORTH.md`. If you're touching any UI, read `UI-ELEMENTS-TRUE-NORTH.md`.

2. **Fix bugs where they live.** Do not create workaround HTML, CSS, or JS. Find the canonical location and fix it there. See `UI-ELEMENTS-TRUE-NORTH.md` for the full anti-pattern catalog.

3. **Do not add external dependencies.** The frontend is vanilla JS. The only allowed dependency is `@dnd-kit` in the admin-only Gallery Maker block.

4. **Do not create custom database tables.** Use `wp_postmeta`, `wp_comments`, `wp_terms`, and CPTs.

5. **Do not split files without good reason.** One PHP file, one JS file, one CSS file. The simplicity is intentional.

6. **Test both desktop and mobile.** Desktop spotlight and mobile spotlight are separate systems. A change to one can break the other.

7. **Test both entry points.** Gallery page (`/content-kit/{slug}/`) and tile permalink (`/tile/{slug}/?kit={id}`) are different code paths that must both work.

8. **Preserve the `?kit=` parameter.** It links tiles to their kit context for SPA navigation. See `SPA-NAVIGATION-TRUE-NORTH.md`.

9. **Use WordPress APIs.** For auth, use `is_user_logged_in()`. For redirects, use `wp_safe_redirect()`. For sanitization, use `absint()`, `sanitize_text_field()`, etc. Do not reinvent these.

10. **Ask before creating anything new.** New functions, new CSS classes, new data attributes, new AJAX endpoints, new post meta keys — all of these expand the surface area of the plugin. Make sure they're needed.
