# Video Behavior by ABU — True North

> **This is an aspirational document.** It describes how this plugin works and the principles that govern all work on it. If the current implementation deviates from what is described here, this document is right and the code has a bug. Read this before making any changes.

**Last Updated:** 2026-02-06

---

## 1. What This Plugin Is

Video Behavior by ABU is a **background video processing pipeline**. When an MP4 video is uploaded to the WordPress Media Library, this plugin automatically generates three optimized derivatives:

1. **Poster image** (`poster.jpg`) — a single frame extracted as JPEG
2. **720p video** (`video-720p.mp4`) — H.264, ~5 Mbps, 128k audio, `faststart`
3. **360p video** (`video-360p.mp4`) — H.264, ~900k, 96k audio, `faststart`

These derivatives enable the gallery plugin to serve appropriately-sized video for different contexts (masonry grid preview at 360p, spotlight at 720p, download at original quality) without loading the full-resolution source file.

The plugin does **not** provide any frontend rendering. It operates entirely in the WordPress admin and via WP-Cron. The gallery plugin reads the derivatives at render time.

---

## 2. Architecture

```
video-behavior-by-abu/
├── video-behavior-by-abu.php   ← Main file: settings, hooks, derivative hiding, admin actions
├── includes/
│   ├── ffmpeg-status.php       ← FFmpeg detection and shell command execution
│   ├── queue.php               ← Processing queue (WP option-based)
│   ├── worker.php              ← FFmpeg processing, derivative generation, cleanup
│   ├── derivatives.php         ← Derivative attachment registration in WP Media Library
│   └── attachment-ui.php       ← Admin meta box on attachment edit screens
├── assets/
│   └── js/admin-media-id.js    ← Shows attachment IDs in Media Library (admin utility)
└── PROJECT_BRIEF.md
```

### Processing Pipeline

```
1. Admin uploads MP4 to Media Library
   └─ add_attachment hook fires
   └─ vba_on_attachment_added() checks: is it MP4? is it a derivative? (skip if so)
   └─ vba_enqueue_attachment() adds attachment ID to queue

2. Queue (WP option: vba_video_queue)
   └─ Array of attachment IDs awaiting processing
   └─ Schedules WP-Cron event: vba_process_video_queue (30-second delay)

3. WP-Cron fires → vba_process_video_queue()
   └─ Dequeues batch of 2 attachments
   └─ For each: vba_process_attachment()
   └─ If queue not empty: reschedules cron event

4. vba_process_attachment($attachment_id)
   └─ Acquires transient lock (10 minutes) to prevent double-processing
   └─ Verifies FFmpeg available
   └─ Gets video dimensions via ffprobe
   └─ Creates output directory: wp-content/uploads/abu-video/{id}/
   └─ Runs three FFmpeg commands (poster, 720p, 360p)
   └─ Registers each output as a WP attachment (child of source)
   └─ Updates attachment meta with derivative IDs and status
   └─ Sets status to 'ready' (or 'failed' with error message)
   └─ Releases transient lock

5. Cleanup (on source attachment deletion)
   └─ vba_on_attachment_deleted() fires
   └─ Removes from queue, deletes derivative attachments, removes directory
```

---

## 3. FFmpeg Dependency

This plugin requires **FFmpeg** installed on the server. It also uses **ffprobe** (ships with FFmpeg) for reading video dimensions.

### Detection

`vba_check_ffmpeg()` verifies:
1. Shell execution functions are available (`exec`, `shell_exec`, `proc_open`, `passthru`, `system` — needs at least one)
2. FFmpeg is at the configured path and responds to `ffmpeg -version`

### Command Execution

`vba_run_command($cmd)` tries three methods in order:
1. `proc_open` (preferred — captures stdout and stderr separately)
2. `exec` (fallback)
3. `shell_exec` (last resort)

### Configuration

- **Settings page:** Settings → Video Behavior by ABU
- **FFmpeg path:** Configurable via `vba_ffmpeg_path` option (default: `'ffmpeg'`, meaning it must be in `$PATH`)
- **Status display:** Shows FFmpeg availability in settings page and plugin row meta

### Local WP Note

Local WP includes its own PHP runtime. FFmpeg must be installed on the host Mac (e.g., via Homebrew: `brew install ffmpeg`). The FFmpeg path may need to be set to the full path (e.g., `/opt/homebrew/bin/ffmpeg`) depending on the Local WP shell environment.

---

## 4. Derivative Storage

### File System

Derivatives are stored outside the normal WordPress upload date structure:

```
wp-content/uploads/abu-video/{attachment_id}/
├── poster.jpg
├── video-720p.mp4
└── video-360p.mp4
```

Each source video gets its own directory keyed by attachment ID. This makes cleanup simple (delete the directory).

### WordPress Attachments

Each derivative file is registered as a **WordPress attachment post** (child of the source video):

| Derivative | Quality Meta | MIME Type | Parent |
|-----------|-------------|-----------|--------|
| Poster | `_abu_video_quality = 'poster'` | `image/jpeg` | Source video attachment |
| 720p | `_abu_video_quality = '720'` | `video/mp4` | Source video attachment |
| 360p | `_abu_video_quality = '360'` | `video/mp4` | Source video attachment |

The `_abu_video_quality` meta key is the marker that identifies a derivative. It is also used to **hide derivatives** from the Media Library and the Media Library modal (so admins don't see poster images and transcoded videos cluttering their library).

### Why Register as Attachments?

- WordPress manages the file relationship (path, URL, metadata)
- If the site migrates, attachment URLs update automatically
- Derivatives can be served via `wp_get_attachment_url()` — same as any media
- Cleanup is simple: `wp_delete_attachment()` handles file deletion

---

## 5. Attachment Meta Schema

All metadata lives on the **source video attachment** (not on derivative attachments):

| Meta Key | Type | Description |
|----------|------|-------------|
| `_abu_video_status` | string | `'queued'` \| `'processing'` \| `'ready'` \| `'failed'` |
| `_abu_video_queued_at` | string | MySQL datetime when queued |
| `_abu_video_started_at` | string | MySQL datetime when processing began |
| `_abu_video_finished_at` | string | MySQL datetime when processing completed |
| `_abu_video_last_error` | string | Error message (empty on success) |
| `_abu_video_width` | int | Source video width (from ffprobe) |
| `_abu_video_height` | int | Source video height (from ffprobe) |
| `_abu_video_poster_id` | int | Attachment ID of poster derivative |
| `_abu_video_720_id` | int | Attachment ID of 720p derivative |
| `_abu_video_360_id` | int | Attachment ID of 360p derivative |

### Status Lifecycle

```
(upload) → queued → processing → ready
                              → failed (with _abu_video_last_error set)
```

A failed attachment can be re-queued via the "Regenerate" button in the admin meta box.

---

## 6. Admin UI

### Settings Page (Settings → Video Behavior by ABU)

- Shows FFmpeg status (available or not)
- Configurable FFmpeg path
- "Run Queue Now" button (schedules the cron event immediately)

### Attachment Meta Box (Edit Media → ABU Video Derivatives)

Only visible on MP4 attachments. Shows:

- Processing status
- Poster / 720p / 360p URLs (links to view)
- Derivatives folder path
- Last error message (if failed)
- "Regenerate" button — re-queues the attachment for processing
- "Sync From Disk" button — scans the filesystem for existing derivatives and registers them (useful if derivatives exist but the database is out of sync)

### Media Library Filtering

Derivative attachments are **hidden** from:
- The Media Library grid/list view (`pre_get_posts` filter)
- The Media Library modal used by Gallery Maker and other blocks (`ajax_query_attachments_args` filter)

This prevents admins from accidentally selecting poster images or transcoded videos as regular media.

---

## 7. Integration with ABU Pinterest Gallery

This plugin and the gallery plugin have a **producer/consumer relationship**. Video Behavior produces derivatives; the gallery plugin consumes them.

### How the Gallery Plugin Reads Derivatives

When `abu_pg_render_tile()` encounters a video tile, it resolves derivatives through a cascading fallback:

```
1. Check tile post meta (_abu_pg_poster_attachment_id, etc.) → attachment URL
2. Check source attachment meta (_abu_video_poster_id, etc.) → attachment URL
3. Check source attachment meta (_abu_video_poster_url, etc.) → direct URL
4. Check _abu_video_derivatives JSON meta → URLs
5. Check filesystem (abu-video/{id}/poster.jpg exists?) → constructed URL
```

This multi-level fallback ensures videos display correctly even if some meta is missing or stale.

### What the Gallery Plugin Expects

For a video tile to render fully, it needs:
- A poster image URL (for the masonry grid thumbnail and spotlight poster)
- A 360p video URL (for masonry grid autoplay)
- A 720p video URL (for spotlight playback)
- The original video URL (for download)
- Width and height (for aspect ratio calculation)

If derivatives are missing (status is `'queued'` or `'failed'`), the gallery plugin falls back gracefully — it may show the original video without optimized sources, or display without a poster.

### Boundary

Video Behavior **never touches tile posts**. It operates exclusively on WP attachment posts. When the gallery plugin creates a tile for a video attachment, it copies derivative references from the attachment meta to the tile post meta for fast access. But the source of truth for processing status and derivative locations is always the attachment.

---

## 8. Queue and Concurrency

### Queue Storage

The queue is a simple array of attachment IDs stored in a WordPress option (`vba_video_queue`). It uses `update_option()` with autoload disabled.

### Batch Size

The worker dequeues **2 attachments per batch** to avoid PHP timeout issues. After processing a batch, if the queue is not empty, it schedules another cron event in 30 seconds.

### Concurrency Protection

Each attachment is locked with a WordPress transient (`vba_processing_lock_{id}`) for 10 minutes. This prevents:
- Double-processing if WP-Cron fires twice
- Race conditions if "Run Queue Now" is clicked during processing

### WP-Cron Dependency

Processing depends on WP-Cron. If WP-Cron is disabled or unreliable:
- Use the "Run Queue Now" button on the settings page
- Or configure a system cron to hit `wp-cron.php` at regular intervals
- Or use WP Crontrol plugin to monitor and manually trigger cron events

---

## 9. Limitations

### Server Requirements

- **FFmpeg must be installed** on the server. Most shared hosting does not provide FFmpeg. Managed WordPress hosting varies. Local WP environments need it installed on the host machine.
- **Shell execution must be enabled.** At least one of `exec`, `shell_exec`, or `proc_open` must be available (not disabled in `php.ini`).
- **Sufficient disk space.** Each video generates three derivatives. A 100MB source video might produce ~30MB of derivatives. At scale with thousands of videos, storage grows significantly.
- **PHP execution time.** FFmpeg transcoding can take seconds to minutes depending on video length and server CPU. The worker uses `veryfast` preset to minimize processing time, but long videos may approach PHP `max_execution_time` limits.

### Format Support

- **Only MP4 is supported.** The `add_attachment` hook only triggers for `video/mp4` MIME type. Other video formats (MOV, AVI, WebM) are ignored.
- **Only H.264 output.** Derivatives use `libx264` codec. No WebM/VP9 or HEVC output.

### Processing Limitations

- **No progress reporting.** There is no real-time progress indicator during processing. Status transitions directly from `'processing'` to `'ready'` or `'failed'`.
- **No retry logic.** Failed attachments stay in `'failed'` status until manually re-queued via the "Regenerate" button.
- **Batch size is fixed.** 2 per batch. Not configurable without code change.
- **Poster is frame 0 only.** The poster image is extracted from the first frame. There is no option to select a specific frame or timestamp.

---

## 10. Scalability

### Current Design (Suitable for Hundreds of Videos)

The current queue-and-cron approach works well for the development phase and moderate production load. Processing is serial (one batch at a time), which is simple and reliable.

### At Scale (Thousands of Videos)

| Concern | Current | At Scale |
|---------|---------|----------|
| Processing speed | 2 per batch, ~30s intervals | May need larger batches or parallel workers |
| PHP timeouts | `veryfast` preset helps | Long videos may need async processing outside PHP |
| Storage | `abu-video/` directory | May need CDN or object storage for derivative serving |
| Queue reliability | WP option (single row) | May need dedicated queue table or external queue (e.g., Redis) |
| Cron reliability | WP-Cron | System cron required for predictable scheduling |

**Important:** Any scalability upgrades should maintain the same meta schema and derivative structure so the gallery plugin's consumption logic doesn't change.

---

## 11. Good Patterns / Bad Patterns

### Processing Videos

**Good:** Let the queue and worker handle processing. Never call FFmpeg inline during a request.
```php
// GOOD: Queue for background processing
vba_enqueue_attachment($attachment_id);
```

**Bad:** Running FFmpeg during a web request (blocks the page, hits timeouts).
```php
// BAD: Synchronous processing
$result = vba_run_command("ffmpeg -i $file -vf scale=-2:720 $output");
// User waits for this to finish
```

### Registering Derivatives

**Good:** Use `vba_register_derivative_attachment()` which handles idempotency, parent linking, and meta.
```php
// GOOD: Proper registration
$poster_id = vba_register_derivative_attachment($parent_id, $path, $url, 'poster', $title);
```

**Bad:** Creating attachment posts manually without the derivative marker.
```php
// BAD: No _abu_video_quality meta — derivative won't be hidden from library
wp_insert_attachment(['post_mime_type' => 'image/jpeg', ...], $path);
```

### Checking Derivative Status

**Good:** Check the attachment meta directly.
```php
// GOOD: Standard meta check
$status = get_post_meta($attachment_id, '_abu_video_status', true);
if ('ready' === $status) { /* derivatives available */ }
```

**Bad:** Checking the filesystem directly without checking meta first.
```php
// BAD: Filesystem check without status awareness
if (file_exists($upload_dir . '/abu-video/' . $id . '/poster.jpg')) { /* assume ready */ }
// The file might exist from a partial/failed run
```

### Detecting Derivatives

**Good:** Use `vba_is_derivative_attachment()` to check if an attachment is a derivative.
```php
// GOOD: Built-in check
if (vba_is_derivative_attachment($attachment_id)) {
    // Skip — this is a generated file, not a user upload
}
```

**Bad:** Checking by filename pattern or directory path manually.
```php
// BAD: Fragile path-based detection
if (strpos(get_attached_file($id), 'video-720p') !== false) { /* assume derivative */ }
```

---

## 12. What This Plugin Must Never Do

1. **Never run FFmpeg synchronously during a web request.** All processing must go through the queue and cron worker.

2. **Never modify tile posts.** This plugin operates on WP attachments only. The gallery plugin owns the tile layer.

3. **Never create frontend output.** No shortcodes, no templates, no JavaScript on the frontend. This is an admin/background plugin.

4. **Never add external service dependencies.** No cloud transcoding APIs, no CDN integrations, no external queues. The plugin must work with just WordPress + FFmpeg on the local server.

5. **Never store derivatives outside `wp-content/uploads/abu-video/`.** The gallery plugin has filesystem fallback logic that depends on this path structure.

6. **Never delete the source video.** The plugin creates derivatives alongside the original. The original is always preserved for download.

7. **Never re-process without explicit trigger.** Processing only happens on initial upload or manual "Regenerate" click. There is no automatic re-processing.

8. **Never leave orphaned derivatives.** When a source video is deleted, all derivatives (attachments + files + directory) must be cleaned up via `vba_cleanup_derivatives()`.

---

## 13. Related True North Documents

| Document | Location | Relevance |
|----------|----------|-----------|
| `ABU-PINTEREST-GALLERY-TRUE-NORTH.md` | Gallery plugin directory | How the gallery plugin consumes video derivatives |
| `CANONICAL-TILES-TRUE-NORTH.md` | Gallery plugin directory | How tiles reference video derivatives via meta |
| `UI-ELEMENTS-TRUE-NORTH.md` | Gallery plugin directory | How video tiles are rendered (poster, play button, quality sources) |

---

## 14. File Reference

| File | Purpose |
|------|---------|
| `video-behavior-by-abu.php` | Main plugin: settings, hooks, derivative hiding, admin post handlers |
| `includes/ffmpeg-status.php` | FFmpeg detection, path config, shell command runner |
| `includes/queue.php` | Queue management (enqueue, dequeue, size, remove) |
| `includes/worker.php` | FFmpeg processing, dimension detection, derivative generation, cleanup |
| `includes/derivatives.php` | Registers derivative files as WP attachment posts |
| `includes/attachment-ui.php` | Admin meta box on attachment edit screen, regenerate/sync handlers |
| `assets/js/admin-media-id.js` | Displays attachment IDs in the Media Library (admin utility) |
