## Project Brief — Video Behavior by ABU

### Purpose
- Detect FFmpeg availability and expose status in admin.
- Generate video derivatives for MP4 attachments via a queued background job.
- Provide an attachment UI to view status/URLs and trigger regenerate.

### FFmpeg Detection
- Implemented in `includes/ffmpeg-status.php`.
- Checks for disabled shell functions and logs helpful errors.
- Executes `ffmpeg -version` using `proc_open` / `exec` / `shell_exec`.
- Configurable FFmpeg path via Settings → Video Behavior by ABU.

### Queue + Worker
- Queue stored in option: `vba_video_queue` (array of attachment IDs).
- Enqueue on `add_attachment` for `video/mp4`.
- Single WP‑Cron event `vba_process_video_queue` scheduled if not present.
- Worker processes small batches (2 per run) to avoid timeouts.
- Uses transient lock per attachment to avoid double processing.

### Derivative Outputs
- Poster JPEG (frame 0): `poster.jpg`
- 720p MP4 (H.264/AAC, faststart, ~5 Mbps): `video-720p.mp4`
- 360p MP4 (H.264/AAC, faststart, ~0.8–1.2 Mbps): `video-360p.mp4`
- Stored under: `wp-content/uploads/abu-video/<attachment-id>/`

### Attachment Meta Schema
Stored in single meta key `_abu_video_derivatives`:
- `status`: `queued` | `processing` | `ready` | `failed`
- `poster_url`, `720p_url`, `360p_url`
- `queued_at`, `started_at`, `finished_at`
- `width`, `height` (from ffprobe if available)
- `last_error` (message when failed)

### Admin UI
- Attachment “Edit Media” screen: **ABU Video Derivatives** meta box.
- Shows status, poster/360p/720p URLs, derivatives folder path, last error.
- “Regenerate” button enqueues the job (no inline FFmpeg).

### Troubleshooting Notes
- If FFmpeg or shell execution is missing, status shows ❌ and logs error.
- Regenerate uses `admin-post.php` with nonce; redirects back to media edit.
- WP‑Cron must run for queued jobs to process (use WP Crontrol to verify).
- “Run Queue Now” button on Settings page schedules the cron event.
