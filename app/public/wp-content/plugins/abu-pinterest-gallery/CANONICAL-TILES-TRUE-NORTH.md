# Canonical Tiles — True North

> **This is an aspirational document.** It describes how tiles *should* work when functioning correctly. If the current implementation deviates from what is described here, this document is right and the code has a bug. Refer to this document before modifying or debugging any tile-related code.

**Last Updated:** 2026-02-06

---

## 1. What Is a Tile?

A tile is a **canonical resource representing a single piece of media** (image or video). Every photo or video in the platform is represented by exactly one tile. Tiles are the atomic unit of the entire gallery system — they are what users see, click, like, comment on, download, and share.

Tiles are WordPress custom post type (`abu_pg_tile`) records. They are not the media files themselves — they are a layer on top of WordPress attachments that gives each media item its own permalink, metadata, social features, and permission model.

---

## 2. Tile Lifecycle

### How Tiles Are Created

Tiles are created automatically. The admin never manually creates a tile.

```
1. Admin opens Gallery Maker (Gutenberg block) inside a Content Kit
2. Admin uploads or selects media (images/videos) from the WP Media Library
3. Admin organizes media into Chapters and publishes the Content Kit
4. On save, the plugin intercepts the post save hook
5. For each attachment ID in the chapter data:
   └─ abu_pg_get_or_create_tile_post_for_attachment() is called
   └─ If a tile already exists for this attachment → return existing tile ID
   └─ If no tile exists → create a new abu_pg_tile post → return new tile ID
6. Chapter data is rewritten with tile IDs (not attachment IDs)
7. Kit-to-tile index is rebuilt (abu_pg_tile_index meta entries)
```

### The 1:1 Attachment ↔ Tile Mapping

Every tile has exactly one WP attachment. Every WP attachment has at most one tile. This is enforced by bidirectional meta references:

| Meta Key | Stored On | Points To | Purpose |
|----------|-----------|-----------|---------|
| `_abu_pg_attachment_id` | Tile post | Attachment ID | Tile → "my source media" |
| `_abu_pg_tile_post_id` | Attachment | Tile post ID | Attachment → "my tile" |

If a tile's attachment is deleted, the tile becomes orphaned (no media to display). If an attachment's tile reference points to a deleted tile post, the stale reference is cleaned up on next access via `abu_pg_get_tile_post_id_for_attachment()`.

### Tile Lifecycle Functions

| Function | Purpose |
|----------|---------|
| `abu_pg_get_or_create_tile_post_for_attachment($attachment_id)` | Idempotent tile creator. Returns existing tile or creates new one. |
| `abu_pg_get_tile_post_id_for_attachment($attachment_id)` | Look up tile by attachment. Cleans stale references. |
| `abu_pg_get_attachment_id_for_tile($tile_post_id)` | Look up attachment by tile. |

---

## 3. Tile CPT Registration

```php
register_post_type('abu_pg_tile', [
    'public'              => true,
    'publicly_queryable'  => true,
    'show_ui'             => false,    // Hidden from admin menu
    'show_in_menu'        => false,    // Managed via Gallery Maker only
    'exclude_from_search' => true,     // Not in WP site search
    'rewrite'             => ['slug' => 'tile', 'with_front' => false],
    'supports'            => ['title', 'comments', 'custom-fields'],
    'show_in_rest'        => true,
]);
```

### Key Design Decisions

- **`public: true` + `show_ui: false`**: Tiles are publicly accessible via permalink but invisible in the admin menu. Admin manages tiles indirectly through the Gallery Maker.
- **`exclude_from_search: true`**: Tiles should not appear in WordPress search results. Users find tiles by browsing Content Kits, not searching.
- **`supports: comments`**: Tiles have WordPress native comments. The commenting system is built on top of this.
- **`show_in_rest: true`**: Required for Gutenberg compatibility and potential future REST API expansion.
- **Permalink structure**: `/tile/{slug}/` — clean, shareable URLs.

### Important: Rewrite Rules

After activating or updating the plugin, the admin must visit **Settings > Permalinks** and click **Save Changes** to flush rewrite rules. Without this, tile permalinks return 404.

---

## 4. Tile Post Meta

### Core Meta

| Meta Key | Type | Description |
|----------|------|-------------|
| `_abu_pg_attachment_id` | int | The WP attachment ID this tile represents |
| `_abu_pg_tile_type` | string | `'image'` or `'video'` |
| `_abu_pg_likes` | array | Array of user IDs who have liked this tile |

### Video-Specific Meta (on the tile post)

| Meta Key | Type | Description |
|----------|------|-------------|
| `_abu_pg_poster_attachment_id` | int | Poster image attachment ID |
| `_abu_pg_video_720_attachment_id` | int | 720p derivative attachment ID |
| `_abu_pg_video_360_attachment_id` | int | 360p derivative attachment ID |
| `_abu_pg_derivatives_json` | string | JSON with derivative URLs (fallback) |

Note: Video derivative meta is also stored on the source attachment by the Video Behavior plugin. The tile post caches references for fast access. The source of truth for video processing status lives on the attachment — the tile just points to the results.

---

## 5. Tiles and Content Kits

### The Relationship

A tile has an **inextricable origin link** to the Content Kit it was first created in. However, a tile is not exclusively owned by that kit. The system is designed so that:

- A tile is **created as part of** a specific Content Kit (via Gallery Maker upload)
- That Content Kit's chapter data contains the tile's ID
- The kit-to-tile index (`abu_pg_tile_index` meta on the kit) enables reverse lookup
- A tile **can appear in multiple kits** — a different Content Kit can reference the same tile ID in its chapter data
- A tile **can appear in future collections** (e.g., "Liked Tiles," "Organization Favorites," user-curated boards)

### Kit-to-Tile Index

For performance, each Content Kit maintains a flat index of all tile IDs it contains:

```
Kit post meta: abu_pg_tile_index = 101  (repeated meta key)
Kit post meta: abu_pg_tile_index = 102
Kit post meta: abu_pg_tile_index = 103
...
```

This enables fast queries like "which kits contain tile 101?" without parsing JSON:

```php
abu_pg_find_kits_containing_tile($tile_id)
// → Uses WP_Query with meta_query on abu_pg_tile_index
```

The index is rebuilt on every kit save via `abu_pg_rebuild_kit_tile_index()`.

### Chapter Data Structure

Tiles are organized within kits via chapter JSON stored in `abu_pg_chapters_json` post meta:

```json
[
  {
    "id": "chapter-1",
    "name": "Getting Ready",
    "order": 0,
    "tileIds": [101, 102, 103, 104]
  },
  {
    "id": "chapter-2",
    "name": "Ceremony",
    "order": 1,
    "tileIds": [105, 106, 107]
  }
]
```

The canonical key is `tileIds`. A legacy key `mediaIds` (containing attachment IDs) is accepted during reads but converted to `tileIds` on save. New data should always use `tileIds`.

---

## 6. Tile Permissions

### Viewing

**Tiles are publicly viewable.** Anyone — logged in or logged out — can view any tile and its media. This is by design. The platform is a showcase; restricting viewing would defeat its purpose.

```php
function abu_pg_user_can_view_tile($user_id, $tile_id, $kit_id = 0) {
    // TILES ARE PUBLICLY VIEWABLE
    return true;
}
```

### Feature-Level Permissions

Interactive features are gated by login state:

| Feature | Logged Out | Logged In |
|---------|-----------|-----------|
| View tile media | Yes | Yes |
| Download media | No | Yes |
| Like tile | No | Yes |
| Comment on tile | No | Yes |
| Share tile | No | Yes |

Permission flags are embedded in the tile HTML as `data-*` attributes and in `abuPgConfig` (localized script data). The PHP function `abu_pg_render_tile()` conditionally renders UI elements (download button, etc.) based on login state.

### Server-Side Enforcement

UI-only gating is not sufficient. Server-side enforcement exists for:
- **Downloads**: Handled by the download mechanism (login required)
- **Likes**: AJAX handlers `abu_pg_ajax_like_tile` / `abu_pg_ajax_unlike_tile` check `is_user_logged_in()`
- **Comments**: AJAX handler `abu_pg_ajax_submit_comment` checks login + `abu_pg_user_can_comment_on_tile()`. The `preprocess_comment` filter also blocks unauthorized submissions via `wp-comments-post.php`.
- **Comment deletion**: Only the comment author can delete their own comment, enforced server-side.

---

## 7. Tile Rendering

### The Golden Rule

**`abu_pg_render_tile()` is the single source of truth for tile HTML.** No other function, template, or script should generate tile markup. See `UI-ELEMENTS-TRUE-NORTH.md` for the full rendering protocol.

### Function Signature

```php
abu_pg_render_tile($tile_post_id, $debug_enabled = false, $kit_id = 0)
```

- `$tile_post_id`: Must be an `abu_pg_tile` post ID. Not an attachment ID.
- `$debug_enabled`: Adds debug data attributes for development.
- `$kit_id`: When provided, appends `?kit={id}` to the tile's permalink. This is critical for SPA navigation context.

### What It Outputs

A `<div class="abu-pg-tile">` with:
- **Data attributes**: `data-id`, `data-attachment-id`, `data-url`, `data-type`, `data-permalink`, `data-width`, `data-height`, permission flags, like state, image variant URLs, video source URLs
- **Image tiles**: `<img>` with lazy-loading (`data-src` instead of `src`), srcset, sizes
- **Video tiles**: `<video>` with poster, multi-quality sources (`data-src-360`, `data-src-720`, `data-src-original`), play overlay, mute button
- **Button container**: Download button (logged-in only), mute button (video only)

### Image Variants

Three sizes are registered and used:

| Variant | WP Size Name | Max Width | Purpose |
|---------|-------------|-----------|---------|
| Grid | `abu_grid` | 600px | Masonry tiles (optimized for ~280px display @ 2x retina) |
| Web | `abu_web` | 2048px | Spotlight view, sharing |
| Original | Full size | Unlimited | Download, print. Uses `abu_pg_get_original_image_url()` to bypass WP's `-scaled` versions. |

Functions:
- `abu_pg_get_image_variants($attachment_id)` — returns all three URLs + srcset
- `abu_pg_get_original_image_url($attachment_id)` — bypasses WordPress 5.3+ scaling to get the true original

---

## 8. Tile Permalink (Spotlight-First View)

When a user visits `/tile/{slug}/`, they see the tile in spotlight mode. This is rendered by `templates/single-tile.php`.

### How It Works

1. PHP gets tile metadata via `abu_pg_get_tile_metadata($tile_id)`
2. If `?kit={id}` is present, PHP loads the full kit context via `abu_pg_get_all_tiles_from_kit($kit_id)` — this provides adjacent tiles for the spotlight right column (desktop) or carousel (mobile)
3. Tile data + kit context are injected as JSON `<script>` blocks
4. Icon templates are rendered as hidden DOM elements
5. Page loads with `body { background: #000; overflow: hidden; }`
6. Inline JS calls `window.openSpotlightForTilePermalink(tileData, kitContext)`
7. Spotlight opens immediately — the user sees a spotlight, not a webpage

### The `?kit=` Parameter

When a tile permalink includes `?kit={id}`:
- Adjacent tiles from that kit are available for SPA navigation
- The spotlight right column (desktop) or carousel (mobile) is populated
- Back navigation returns to that kit's gallery page

When a tile permalink has no `?kit=` parameter:
- The tile renders in spotlight with no adjacent tiles
- No SPA navigation is possible
- This is a valid state (e.g., someone shares just the tile URL)

See `SPA-NAVIGATION-TRUE-NORTH.md` for the full SPA navigation specification.

---

## 9. Tile Features

### Likes (Hearts)

- Stored as `_abu_pg_likes` post meta — an array of user IDs
- `abu_pg_user_has_liked_tile($user_id, $tile_id)` — check if user has liked
- `abu_pg_get_tile_like_count($tile_id)` — count likes
- AJAX: `wp_ajax_abu_pg_like_tile` / `wp_ajax_abu_pg_unlike_tile`
- Like state is embedded in tile HTML: `data-like-count`, `data-user-has-liked`
- No custom database tables — all data lives in `wp_postmeta`

**Scalability note:** The current implementation stores all user IDs who liked a tile in a single serialized array in one meta row. This works well up to a few hundred likes per tile. At higher scale, the architecture should migrate to **one meta row per like** (repeated meta key pattern, same as `abu_pg_tile_index`):

```
tile post_id=101, meta_key='_abu_pg_like_user', meta_value=4
tile post_id=101, meta_key='_abu_pg_like_user', meta_value=7
tile post_id=101, meta_key='_abu_pg_like_user', meta_value=12
```

This makes "all tiles user X liked" a standard indexed `WP_Query` meta query — no serialized-array `LIKE` scanning. This is still just `wp_postmeta` — no custom tables needed.

### Comments

- Uses **WordPress native comment system** (`wp_insert_comment`, `get_comments`)
- Comments are stored in the standard `wp_comments` table, linked to the tile post ID via `comment_post_ID`
- Tile CPT registers with `'supports' => ['comments']` and default `comment_status = 'open'`
- AJAX endpoints: `abu_pg_ajax_submit_comment`, `abu_pg_ajax_load_tile_comments`, `abu_pg_ajax_delete_comment`
- Comments are auto-approved for logged-in users
- Server-side enforcement via `preprocess_comment` filter prevents unauthorized submissions
- No custom storage — this is entirely WordPress core infrastructure
- Scales with WordPress: pagination, moderation, spam filtering all available natively

### Downloads

- Logged-in users see a download button on tiles (both masonry and spotlight)
- Download serves the original full-resolution file
- Logged-out users see no download UI
- The download mechanism uses the `data-original-url` attribute (images) or `data-src-original` (videos)

### Right-Click Protection

- Logged-out users cannot right-click on tile images/videos (context menu is suppressed)
- This is a deterrent, not a security measure — determined users can always access media via browser tools
- Logged-in users have full right-click capability

---

## 10. Tile Metadata API

### `abu_pg_get_tile_metadata($tile_post_id)`

Returns a complete metadata array for a single tile. Used by:
- `single-tile.php` for permalink rendering
- `abu_pg_get_all_tiles_from_kit()` for SPA navigation cache
- REST API endpoint for kit tiles

**Return shape:**

```php
[
    'id'           => int,       // Tile post ID
    'attachmentId' => int,       // WP attachment ID
    'type'         => string,    // 'image' or 'video'
    'url'          => string,    // Primary media URL
    'permalink'    => string,    // Tile canonical URL
    'title'        => string,
    'filename'     => string,
    'created'      => string,    // ISO 8601
    'width'        => int,
    'height'       => int,

    // Image-specific:
    'previewSrc'   => string,    // Grid-quality URL (for spotlight preview)
    'gridUrl'      => string,    // 600px variant
    'webUrl'       => string,    // 2048px variant
    'originalUrl'  => string,    // True original (no WP scaling)
    'gridSrcset'   => string,
    'gridSizes'    => string,

    // Video-specific:
    'poster'       => string,    // Poster image URL
    'src720'       => string,    // 720p video URL
    'src360'       => string,    // 360p video URL
    'srcOriginal'  => string,    // Original video URL
]
```

### `abu_pg_get_all_tiles_from_kit($kit_id)`

Returns an array of tile metadata objects for every tile in a Content Kit (across all chapters). Appends `?kit={kitId}` to each tile's permalink. Used to populate the SPA cache and REST API responses.

### `abu_pg_find_kits_containing_tile($tile_id)`

Returns an array of post IDs (Content Kits and posts/pages) that contain a given tile. Uses the `abu_pg_tile_index` meta for fast lookups without JSON parsing.

---

## 11. Future Extensibility

Tiles are designed to exist beyond the Content Kit they originated in. The architecture supports:

- **Liked tiles collection**: Query tiles by like data to build a "tiles I liked" view. With the repeated-meta-key pattern (see Section 9), this becomes a simple `WP_Query` with `meta_key='_abu_pg_like_user'` and `meta_value=$user_id`. No custom tables, no ABU Users plugin involvement for data storage — just a query against `wp_postmeta`.
- **Organization-scoped views**: Query kits by `abu_organization` taxonomy, then aggregate their tiles
- **User-curated boards**: New CPT or taxonomy that references tile IDs (same pattern as chapter `tileIds` arrays)
- **Cross-kit search/browse**: Tiles are independent CPT posts — they can be queried, filtered, and sorted independently of kits
- **Activity feeds**: Comments, likes, and downloads on tiles can be surfaced in feed-style UIs

**Storage principle:** All tile interaction data (likes, comments, downloads) should live on the tile post itself via `wp_postmeta` or `wp_comments`. User-centric queries ("show me all tiles this user liked") are standard WordPress meta queries. No custom database tables should be created for these features. WordPress core storage primitives — `post_meta`, `comments`, `taxonomies` — are sufficient at scale.

The key principle: **a tile's identity is independent of how it is displayed**. A tile is a tile whether it appears in a masonry grid, a spotlight, a liked-tiles page, a search result, or a future feature. The rendering always calls `abu_pg_render_tile()`.

---

## 12. Relationship to Other Plugins

### Video Behavior by ABU

- When a video is uploaded, Video Behavior queues it for FFmpeg processing
- Derivatives (poster, 720p, 360p) are created as child attachments of the source video attachment
- When a tile is created for a video attachment, `abu_pg_get_or_create_tile_post_for_attachment()` copies derivative references from the attachment to the tile post meta
- At render time, `abu_pg_render_tile()` resolves video derivatives from tile meta → attachment meta → filesystem (cascading fallback)

### ABU Users

- Tile permissions (download, like, comment) are gated by login state — ABU Users manages the login/org/invite flow
- The `abuPgConfig.isLoggedIn` flag is set at page load and consumed by gallery JS for UI gating
- ABU Users provides an auth-state AJAX endpoint that gallery JS can query if login state may have changed (e.g., session expiry)

---

## 13. Rules for Working with Tiles

1. **Never create tile posts manually.** Always use `abu_pg_get_or_create_tile_post_for_attachment()`. It enforces the 1:1 mapping and sets all required meta.

2. **Never render tile HTML outside of `abu_pg_render_tile()`.** This function is the single source of truth. See `UI-ELEMENTS-TRUE-NORTH.md`.

3. **Never pass attachment IDs where tile IDs are expected.** The system completed a clean break from legacy attachment-ID-based rendering. All chapter data uses `tileIds`, not `mediaIds`. All rendering expects tile post IDs.

4. **Always include `$kit_id` when rendering tiles in a kit context.** This appends `?kit={id}` to permalinks, which is required for SPA navigation.

5. **Never store HTML in the tile cache.** The SPA cache (`GalleryStateManager`) stores JSON metadata only. HTML is generated from templates at render time.

6. **Tile IDs are stable.** Once created, a tile post ID never changes. Tile IDs can be safely stored in external references, links, and caches.

7. **Tiles are public.** Do not add view restrictions to tiles. Feature-level permissions (download, like, comment) are the correct layer for access control.

8. **Respect the index.** When modifying kit chapter data, always call `abu_pg_rebuild_kit_tile_index()` afterward. The index enables `abu_pg_find_kits_containing_tile()` and must stay in sync.
