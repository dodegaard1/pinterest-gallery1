<?php
/**
 * Plugin Name: ABU Pinterest Gallery
 * Description: Thin-slice Pinterest-style gallery for posts and pages.
 * Version: 0.1.0
 * Author: ABU
 */

defined( 'ABSPATH' ) || exit;

define( 'ABU_PG_PATH', plugin_dir_path( __FILE__ ) );
define( 'ABU_PG_URL', plugin_dir_url( __FILE__ ) );
define( 'ABU_PG_META_KEY', '_abu_gallery_media_ids' );
define( 'ABU_PG_DEBUG_LOG_PATH', '/Users/danielodegaard/Local Sites/abu-dev/.cursor/debug.log' );

/**
 * Register custom image sizes for grid/web variants.
 * Grid: optimized for masonry tiles (smaller, faster)
 * Web: higher quality for spotlight and sharing
 * Original: full-res source for print/download
 */
function abu_pg_register_image_sizes() {
	// Grid size: optimized for masonry tiles (~280px display width)
	// Use 2x for retina = ~560px, rounded up to 600px for safety
	add_image_size( 'abu_grid', 600, 0, false ); // width, height (0 = maintain aspect), no crop
	
	// Web size: high quality for spotlight and sharing
	// Good balance between quality and file size
	add_image_size( 'abu_web', 2048, 0, false );
}
add_action( 'after_setup_theme', 'abu_pg_register_image_sizes' );

if ( ! function_exists( 'your_plugin_icon' ) ) {
	function your_plugin_icon( $name, $class = '' ) {
		$name = sanitize_file_name( $name );
		$path = ABU_PG_PATH . 'assets/icons/radix/' . $name . '.svg';
		if ( ! file_exists( $path ) ) {
			return '';
		}

		$svg = file_get_contents( $path );
		if ( ! $svg ) {
			return '';
		}

		$class_attr = $class ? ' class="' . esc_attr( $class ) . '"' : '';
		$svg        = preg_replace( '/<svg\b(?![^>]*\bclass=)/', '<svg' . $class_attr, $svg, 1 );
		return $svg;
	}
}

if ( ! function_exists( 'abu_pg_debug_log' ) ) {
	function abu_pg_debug_log( $payload ) {
		if ( ! is_array( $payload ) ) {
			return;
		}
		$line = wp_json_encode( $payload );
		if ( ! $line ) {
			return;
		}
		@file_put_contents( ABU_PG_DEBUG_LOG_PATH, $line . PHP_EOL, FILE_APPEND );
	}
}

if ( ! function_exists( 'abu_pg_handle_debug_log' ) ) {
	function abu_pg_handle_debug_log() {
		$raw = file_get_contents( 'php://input' );
		if ( ! $raw ) {
			wp_send_json_error( array( 'message' => 'empty' ), 400 );
		}
		$payload = json_decode( $raw, true );
		if ( ! is_array( $payload ) ) {
			wp_send_json_error( array( 'message' => 'invalid' ), 400 );
		}
		$payload['serverTimestamp'] = round( microtime( true ) * 1000 );
		abu_pg_debug_log( $payload );
		wp_send_json_success();
	}
}

function abu_pg_register_assets() {
	// Legacy admin assets (no longer used)
	wp_register_style(
		'abu-pg-admin',
		ABU_PG_URL . 'assets/css/admin.css',
		array(),
		'0.1.0'
	);
	wp_register_script(
		'abu-pg-admin',
		ABU_PG_URL . 'assets/js/admin-media.js',
		array( 'jquery', 'media-editor', 'media-views' ),
		'0.1.0',
		true
	);

	// Front-end gallery assets (masonry + lightbox)
	wp_register_style(
		'abu-pg-gallery',
		ABU_PG_URL . 'assets/css/gallery.css',
		array(),
		'0.4.0' // Updated: added download popover styles
	);
	$gallery_version = '0.7.3'; // Updated: variant system + lazy loading + performance overlay + true original URLs (no -scaled)
	$debug_enabled = isset( $_GET['abu_pg_debug'] ) && '0' !== sanitize_text_field( wp_unslash( $_GET['abu_pg_debug'] ) );
	if ( is_user_logged_in() || $debug_enabled ) {
		$gallery_version .= '-' . time();
	}
	wp_register_script(
		'abu-pg-gallery',
		ABU_PG_URL . 'assets/js/gallery.js',
		array(),
		$gallery_version,
		true
	);
	
	// Phase 2: Chapter navigation and multi-grid support
	wp_register_style(
		'abu-pg-chapters',
		ABU_PG_URL . 'assets/css/abu-chapters.css',
		array(),
		'1.1.4'
	);
	wp_register_script(
		'abu-pg-chapters',
		ABU_PG_URL . 'assets/js/abu-chapters.js',
		array(),
		'1.1.0',
		true
	);
}
add_action( 'init', 'abu_pg_register_assets' );
add_action( 'wp_ajax_abu_pg_debug_log', 'abu_pg_handle_debug_log' );
add_action( 'wp_ajax_nopriv_abu_pg_debug_log', 'abu_pg_handle_debug_log' );

// Load ABU Gallery Maker block (Phase 1 - Editor only)
require_once ABU_PG_PATH . 'gallery-maker/index.php';

// Legacy admin enqueue removed - ABU Gallery Maker block handles its own assets

// Legacy meta box removed - use ABU Gallery Maker block instead

/**
 * Generate a URL-safe slug from chapter name.
 * 
 * @param string $chapter_name The chapter name.
 * @return string URL-safe slug.
 */
function abu_pg_generate_chapter_slug( $chapter_name ) {
	// Convert to lowercase
	$slug = strtolower( $chapter_name );
	
	// Replace spaces with dashes
	$slug = preg_replace( '/\s+/', '-', $slug );
	
	// Remove any character that isn't alphanumeric, dash, or underscore
	$slug = preg_replace( '/[^a-z0-9\-_]/', '', $slug );
	
	// Remove multiple consecutive dashes
	$slug = preg_replace( '/-+/', '-', $slug );
	
	// Remove leading/trailing dashes
	$slug = trim( $slug, '-' );
	
	// Fallback if slug is empty
	if ( empty( $slug ) ) {
		$slug = 'chapter';
	}
	
	return $slug;
}

/**
 * Parse and validate chapter JSON data.
 * 
 * @param string $json_string Raw JSON from post meta.
 * @return array|false Array of validated chapters or false if invalid.
 */
function abu_pg_parse_chapters( $json_string ) {
	if ( empty( $json_string ) ) {
		return false;
	}
	
	$chapters = json_decode( $json_string, true );
	
	if ( ! is_array( $chapters ) || empty( $chapters ) ) {
		return false;
	}
	
	$validated = array();
	$used_slugs = array(); // Track used slugs to prevent collisions
	
	foreach ( $chapters as $chapter ) {
		if ( ! is_array( $chapter ) ) {
			continue;
		}
		
		// Validate required fields
		if ( empty( $chapter['id'] ) || empty( $chapter['name'] ) || ! isset( $chapter['mediaIds'] ) ) {
			continue;
		}
		
		// Generate slug from name
		$base_slug = abu_pg_generate_chapter_slug( $chapter['name'] );
		$slug = $base_slug;
		$counter = 2;
		
		// Handle slug collisions by appending a number
		while ( in_array( $slug, $used_slugs, true ) ) {
			$slug = $base_slug . '-' . $counter;
			$counter++;
		}
		
		$used_slugs[] = $slug;
		
		// Sanitize chapter data
		$clean_chapter = array(
			'id'       => sanitize_key( $chapter['id'] ),
			'name'     => sanitize_text_field( $chapter['name'] ),
			'slug'     => $slug,
			'order'    => isset( $chapter['order'] ) ? absint( $chapter['order'] ) : 0,
			'mediaIds' => array(),
		);
		
		// Validate media IDs (must be positive integers)
		if ( is_array( $chapter['mediaIds'] ) ) {
			foreach ( $chapter['mediaIds'] as $id ) {
				$id = absint( $id );
				if ( $id > 0 ) {
					$clean_chapter['mediaIds'][] = $id;
				}
			}
		}
		
		// Skip chapters with no valid media
		if ( ! empty( $clean_chapter['mediaIds'] ) ) {
			$validated[] = $clean_chapter;
		}
	}
	
	return ! empty( $validated ) ? $validated : false;
}

/**
 * Get the true original image URL, bypassing WordPress's "-scaled" version.
 * 
 * WordPress creates "-scaled" versions of large images (>2560px). This function
 * uses the WordPress API to get the actual original file if it exists.
 * 
 * @param int $id Attachment ID.
 * @return string Original image URL.
 */
function abu_pg_get_original_image_url( $id ) {
	// Check attachment metadata for original_image key (WordPress 5.3+)
	$metadata = wp_get_attachment_metadata( $id );
	
	if ( ! empty( $metadata['original_image'] ) ) {
		// Original unscaled image exists
		$upload_dir = wp_upload_dir();
		$file_path = get_attached_file( $id );
		
		if ( $file_path ) {
			// Replace the scaled filename with the original filename
			$original_file_path = str_replace( wp_basename( $file_path ), $metadata['original_image'], $file_path );
			
			// Convert file path to URL
			$original_url = str_replace( $upload_dir['basedir'], $upload_dir['baseurl'], $original_file_path );
			return $original_url;
		}
	}
	
	// No original_image metadata exists, return the standard attachment URL
	// (this is already the original for images that weren't scaled)
	return wp_get_attachment_url( $id );
}

/**
 * Get image variant URLs (grid, web, original) with fallbacks.
 * 
 * @param int $id Attachment ID.
 * @return array Array with 'grid_url', 'web_url', 'original_url', 'grid_srcset', 'grid_sizes'.
 */
function abu_pg_get_image_variants( $id ) {
	$variants = array(
		'grid_url'     => '',
		'web_url'      => '',
		'original_url' => '',
		'grid_srcset'  => '',
		'grid_sizes'   => '(max-width: 600px) 50vw, 280px',
	);
	
	// Grid variant (for masonry tiles)
	$grid_image = wp_get_attachment_image_src( $id, 'abu_grid' );
	if ( $grid_image && ! empty( $grid_image[0] ) ) {
		$variants['grid_url'] = $grid_image[0];
	} else {
		// Fallback to medium_large if abu_grid doesn't exist yet
		$fallback = wp_get_attachment_image_src( $id, 'medium_large' );
		$variants['grid_url'] = $fallback && ! empty( $fallback[0] ) ? $fallback[0] : '';
	}
	
	// Web variant (for spotlight and sharing)
	$web_image = wp_get_attachment_image_src( $id, 'abu_web' );
	if ( $web_image && ! empty( $web_image[0] ) ) {
		$variants['web_url'] = $web_image[0];
	} else {
		// Fallback to 2048 size if abu_web doesn't exist yet
		$fallback = wp_get_attachment_image_src( $id, '2048x2048' );
		if ( ! $fallback || empty( $fallback[0] ) ) {
			// Fallback to large
			$fallback = wp_get_attachment_image_src( $id, 'large' );
		}
		$variants['web_url'] = $fallback && ! empty( $fallback[0] ) ? $fallback[0] : '';
	}
	
	// Original (full-res source) - get TRUE original, not scaled version
	$variants['original_url'] = abu_pg_get_original_image_url( $id );
	
	// Generate srcset for grid size
	$srcset = wp_get_attachment_image_srcset( $id, 'abu_grid' );
	if ( ! $srcset ) {
		$srcset = wp_get_attachment_image_srcset( $id, 'medium_large' );
	}
	$variants['grid_srcset'] = $srcset ? $srcset : '';
	
	return $variants;
}

/**
 * Render a single media tile (image or video).
 * 
 * @param int  $id            Attachment ID.
 * @param bool $debug_enabled Whether debug mode is enabled.
 * @return string HTML markup for the tile.
 */
function abu_pg_render_tile( $id, $debug_enabled = false ) {
	$url  = wp_get_attachment_url( $id );
	$mime = get_post_mime_type( $id );
	
	if ( ! $url || ! $mime ) {
		return '';
	}
	
	$is_image = 0 === strpos( $mime, 'image/' );
	$is_video = 0 === strpos( $mime, 'video/' );
	
	if ( ! $is_image && ! $is_video ) {
		return '';
	}
	
	$attachment = get_post( $id );
	$created_at = $attachment ? get_post_time( DATE_ATOM, true, $attachment ) : '';
	$filename   = $url ? wp_basename( $url ) : '';
	$title      = $attachment ? $attachment->post_title : '';
	$media_width  = 0;
	$media_height = 0;
	
	// Video-specific handling
	$poster_url = '';
	$url_720    = '';
	$url_360    = '';
	$poster_id     = 0;
	$video_720_id  = 0;
	$video_360_id  = 0;
	
	if ( $is_video ) {
		$poster_id    = absint( get_post_meta( $id, '_abu_video_poster_id', true ) );
		$video_720_id = absint( get_post_meta( $id, '_abu_video_720_id', true ) );
		$video_360_id = absint( get_post_meta( $id, '_abu_video_360_id', true ) );

		if ( ! $poster_id || ! $video_720_id || ! $video_360_id ) {
			$child_ids = get_posts(
				array(
					'post_type'      => 'attachment',
					'post_status'    => 'inherit',
					'posts_per_page' => -1,
					'fields'         => 'ids',
					'post_parent'    => $id,
					'meta_key'       => '_abu_video_quality',
				)
			);
			foreach ( $child_ids as $child_id ) {
				$quality = get_post_meta( $child_id, '_abu_video_quality', true );
				if ( 'poster' === $quality && ! $poster_id ) {
					$poster_id = absint( $child_id );
					update_post_meta( $id, '_abu_video_poster_id', $poster_id );
				}
				if ( '720' === $quality && ! $video_720_id ) {
					$video_720_id = absint( $child_id );
					update_post_meta( $id, '_abu_video_720_id', $video_720_id );
				}
				if ( '360' === $quality && ! $video_360_id ) {
					$video_360_id = absint( $child_id );
					update_post_meta( $id, '_abu_video_360_id', $video_360_id );
				}
			}
		}

		$media_width  = absint( get_post_meta( $id, '_abu_video_width', true ) );
		$media_height = absint( get_post_meta( $id, '_abu_video_height', true ) );
		
		$poster_url = $poster_id ? wp_get_attachment_url( $poster_id ) : '';
		$url_720    = $video_720_id ? wp_get_attachment_url( $video_720_id ) : '';
		$url_360    = $video_360_id ? wp_get_attachment_url( $video_360_id ) : '';
		
		if ( ! $poster_url ) {
			$poster_url = get_post_meta( $id, '_abu_video_poster_url', true );
		}
		if ( ! $url_720 ) {
			$url_720 = get_post_meta( $id, '_abu_video_720p_url', true );
		}
		if ( ! $url_360 ) {
			$url_360 = get_post_meta( $id, '_abu_video_360p_url', true );
		}

		$derivatives_meta = get_post_meta( $id, '_abu_video_derivatives', true );
		if ( $derivatives_meta && ! is_array( $derivatives_meta ) && is_string( $derivatives_meta ) ) {
			$decoded = json_decode( $derivatives_meta, true );
			if ( is_array( $decoded ) ) {
				$derivatives_meta = $decoded;
			}
		}
		if ( is_array( $derivatives_meta ) ) {
			if ( ! $poster_url && ! empty( $derivatives_meta['poster_url'] ) ) {
				$poster_url = $derivatives_meta['poster_url'];
			}
			if ( ! $url_720 && ! empty( $derivatives_meta['720p_url'] ) ) {
				$url_720 = $derivatives_meta['720p_url'];
			}
			if ( ! $url_360 && ! empty( $derivatives_meta['360p_url'] ) ) {
				$url_360 = $derivatives_meta['360p_url'];
			}
			if ( ! $media_width && ! empty( $derivatives_meta['width'] ) ) {
				$media_width = absint( $derivatives_meta['width'] );
			}
			if ( ! $media_height && ! empty( $derivatives_meta['height'] ) ) {
				$media_height = absint( $derivatives_meta['height'] );
			}
		}

		if ( ! $poster_url || ! $url_720 || ! $url_360 ) {
			$upload_dir = wp_upload_dir();
			$base_dir   = trailingslashit( $upload_dir['basedir'] ) . 'abu-video/' . $id . '/';
			$base_url   = trailingslashit( $upload_dir['baseurl'] ) . 'abu-video/' . $id . '/';
			if ( ! $poster_url && file_exists( $base_dir . 'poster.jpg' ) ) {
				$poster_url = $base_url . 'poster.jpg';
			}
			if ( ! $url_720 && file_exists( $base_dir . 'video-720p.mp4' ) ) {
				$url_720 = $base_url . 'video-720p.mp4';
			}
			if ( ! $url_360 && file_exists( $base_dir . 'video-360p.mp4' ) ) {
				$url_360 = $base_url . 'video-360p.mp4';
			}
		}
	} else {
		// Get dimensions from the abu_grid size being rendered
		$image_src = wp_get_attachment_image_src( $id, 'abu_grid' );
		if ( $image_src && ! empty( $image_src[1] ) && ! empty( $image_src[2] ) ) {
			$media_width  = absint( $image_src[1] );
			$media_height = absint( $image_src[2] );
		} else {
			// Fallback to medium_large if abu_grid doesn't exist yet
			$image_src = wp_get_attachment_image_src( $id, 'medium_large' );
			if ( $image_src && ! empty( $image_src[1] ) && ! empty( $image_src[2] ) ) {
				$media_width  = absint( $image_src[1] );
				$media_height = absint( $image_src[2] );
			} else {
				// Final fallback to full size metadata
				$meta = wp_get_attachment_metadata( $id );
				if ( is_array( $meta ) && ! empty( $meta['width'] ) && ! empty( $meta['height'] ) ) {
					$media_width  = absint( $meta['width'] );
					$media_height = absint( $meta['height'] );
				}
			}
		}
	}
	
	$debug_meta = array(
		'poster' => $poster_url ? 'yes' : 'no',
		'360'    => $url_360 ? 'yes' : 'no',
		'720'    => $url_720 ? 'yes' : 'no',
	);
	$debug_ids = array(
		'poster' => $poster_id,
		'360'    => $video_360_id,
		'720'    => $video_720_id,
	);
	
	// Get image variants for images
	$image_variants = array();
	if ( $is_image ) {
		$image_variants = abu_pg_get_image_variants( $id );
	}
	
	// Get true original URL (handles WordPress "-scaled" versions for both images and videos)
	$original_url = $is_image 
		? ( ! empty( $image_variants['original_url'] ) ? $image_variants['original_url'] : $url )
		: abu_pg_get_original_image_url( $id ); // Videos can also have scaled versions
	
	ob_start();
	?>
	<div class="abu-pg-tile"
		data-id="<?php echo esc_attr( $id ); ?>"
		data-url="<?php echo esc_url( $url ); ?>"
		data-type="<?php echo esc_attr( $is_video ? 'video' : 'image' ); ?>"
		<?php if ( $created_at ) : ?>data-created="<?php echo esc_attr( $created_at ); ?>"<?php endif; ?>
		<?php if ( $filename ) : ?>data-filename="<?php echo esc_attr( $filename ); ?>"<?php endif; ?>
		<?php if ( $title ) : ?>data-title="<?php echo esc_attr( $title ); ?>"<?php endif; ?>
		<?php if ( $media_width ) : ?>data-width="<?php echo esc_attr( $media_width ); ?>"<?php endif; ?>
		<?php if ( $media_height ) : ?>data-height="<?php echo esc_attr( $media_height ); ?>"<?php endif; ?>
		data-original-url="<?php echo esc_url( $original_url ); ?>"
		<?php if ( $is_image && ! empty( $image_variants['grid_url'] ) ) : ?>data-grid-url="<?php echo esc_url( $image_variants['grid_url'] ); ?>"<?php endif; ?>
		<?php if ( $is_image && ! empty( $image_variants['web_url'] ) ) : ?>data-web-url="<?php echo esc_url( $image_variants['web_url'] ); ?>"<?php endif; ?>
		<?php if ( $is_image && ! empty( $image_variants['grid_srcset'] ) ) : ?>data-grid-srcset="<?php echo esc_attr( $image_variants['grid_srcset'] ); ?>"<?php endif; ?>
		<?php if ( $is_image && ! empty( $image_variants['grid_sizes'] ) ) : ?>data-grid-sizes="<?php echo esc_attr( $image_variants['grid_sizes'] ); ?>"<?php endif; ?>
		<?php if ( $debug_enabled && $is_video ) : ?>
			data-abu-meta-360="<?php echo esc_attr( $debug_meta['360'] ); ?>"
			data-abu-meta-720="<?php echo esc_attr( $debug_meta['720'] ); ?>"
			data-abu-meta-poster="<?php echo esc_attr( $debug_meta['poster'] ); ?>"
			data-abu-meta-360-id="<?php echo esc_attr( $debug_ids['360'] ); ?>"
			data-abu-meta-720-id="<?php echo esc_attr( $debug_ids['720'] ); ?>"
			data-abu-meta-poster-id="<?php echo esc_attr( $debug_ids['poster'] ); ?>"
		<?php endif; ?>>
	<?php if ( $is_image ) : ?>
		<?php
		// Use true lazy loading: data-src instead of src
		// IntersectionObserver will attach src when near viewport
		$alt_text = get_post_meta( $id, '_wp_attachment_image_alt', true );
		?>
		<img 
			class="abu-pg-image"
			data-src="<?php echo esc_url( $image_variants['grid_url'] ); ?>"
			<?php if ( ! empty( $image_variants['grid_srcset'] ) ) : ?>data-srcset="<?php echo esc_attr( $image_variants['grid_srcset'] ); ?>"<?php endif; ?>
			<?php if ( ! empty( $image_variants['grid_sizes'] ) ) : ?>data-sizes="<?php echo esc_attr( $image_variants['grid_sizes'] ); ?>"<?php endif; ?>
			alt="<?php echo esc_attr( $alt_text ); ?>"
			width="<?php echo esc_attr( $media_width ); ?>"
			height="<?php echo esc_attr( $media_height ); ?>"
			decoding="async"
		>
	<?php else : ?>
			<video class="abu-pg-video" playsinline preload="metadata"
				data-src-original="<?php echo esc_url( $url ); ?>"
				<?php if ( $url_360 ) : ?>data-src-360="<?php echo esc_url( $url_360 ); ?>"<?php endif; ?>
				<?php if ( $url_720 ) : ?>data-src-720="<?php echo esc_url( $url_720 ); ?>"<?php endif; ?>
				<?php if ( $poster_url ) : ?>data-poster="<?php echo esc_url( $poster_url ); ?>" poster="<?php echo esc_url( $poster_url ); ?>"<?php endif; ?>>
				<source type="<?php echo esc_attr( $mime ); ?>">
			</video>
			<div class="abu-pg-video-overlay" aria-hidden="true"></div>
			<div class="abu-pg-video-play" aria-hidden="true">
				<span class="abu-pg-video-play-bg"></span>
				<?php echo your_plugin_icon( 'play', 'yp-icon' ); ?>
			</div>
			<button type="button" class="abu-pg-mute yp-icon-button" aria-pressed="false" aria-label="Mute">
				<span class="abu-pg-mute-icon abu-pg-mute-icon-on">
					<?php echo your_plugin_icon( 'speaker-loud', 'yp-icon' ); ?>
				</span>
				<span class="abu-pg-mute-icon abu-pg-mute-icon-off">
					<?php echo your_plugin_icon( 'speaker-off', 'yp-icon' ); ?>
				</span>
			</button>
		<?php endif; ?>
		<button type="button" class="abu-pg-download yp-icon-button" aria-label="Download">
			<?php echo your_plugin_icon( 'download', 'yp-icon' ); ?>
		</button>
	</div>
	<?php
	return ob_get_clean();
}

function abu_pg_shortcode() {
	if ( ! is_singular() ) {
		return '';
	}

	$post_id = get_the_ID();
	if ( ! $post_id ) {
		return '';
	}

	// Read chapter JSON data (Phase 2: ONLY source of truth)
	$chapters_json = get_post_meta( $post_id, 'abu_pg_chapters_json', true );
	$chapters      = abu_pg_parse_chapters( $chapters_json );
	
	// If no valid chapters, show appropriate message
	if ( ! $chapters ) {
		if ( current_user_can( 'edit_posts' ) ) {
			return '<div class="abu-pg-empty-state" style="padding: 40px; text-align: center; color: #666; font-family: system-ui, sans-serif;">
				<p style="font-size: 16px; margin: 0;">No chapters found. Add an <strong>ABU Gallery Maker</strong> block and configure chapters.</p>
			</div>';
		}
		return ''; // Public users see nothing
	}

	$debug_enabled = isset( $_GET['abu_pg_debug'] ) && '0' !== sanitize_text_field( wp_unslash( $_GET['abu_pg_debug'] ) );

	// Enqueue assets
	wp_enqueue_style( 'abu-pg-gallery' );
	wp_enqueue_script( 'abu-pg-gallery' );
	wp_enqueue_style( 'abu-pg-chapters' );
	wp_enqueue_script( 'abu-pg-chapters' );
	
	if ( $debug_enabled ) {
		wp_localize_script(
			'abu-pg-gallery',
			'abuPgDebug',
			array(
				'enabled'  => true,
				'endpoint' => admin_url( 'admin-ajax.php' ),
			)
		);
	}

	ob_start();
	?>
	<div class="abu-pg-chapters-wrapper" data-post-id="<?php echo esc_attr( $post_id ); ?>">
		<!-- Icon templates (shared across all chapters) -->
		<div class="abu-pg-icon-template" data-icon="caret-left" hidden>
			<?php echo your_plugin_icon( 'caret-left', 'yp-icon' ); ?>
		</div>
		<div class="abu-pg-icon-template" data-icon="heart" hidden>
			<?php echo your_plugin_icon( 'heart', 'yp-icon' ); ?>
		</div>
		<div class="abu-pg-icon-template" data-icon="heart-filled" hidden>
			<?php echo your_plugin_icon( 'heart-filled', 'yp-icon' ); ?>
		</div>
		<div class="abu-pg-icon-template" data-icon="chat-bubble" hidden>
			<?php echo your_plugin_icon( 'chat-bubble', 'yp-icon' ); ?>
		</div>
		<div class="abu-pg-icon-template" data-icon="share-2" hidden>
			<?php echo your_plugin_icon( 'share-2', 'yp-icon' ); ?>
		</div>
		<div class="abu-pg-icon-template" data-icon="speaker-loud" hidden>
			<?php echo your_plugin_icon( 'speaker-loud', 'yp-icon' ); ?>
		</div>
		<div class="abu-pg-icon-template" data-icon="speaker-off" hidden>
			<?php echo your_plugin_icon( 'speaker-off', 'yp-icon' ); ?>
		</div>
		
		<!-- Sticky Chapter Navigation -->
		<nav class="abu-pg-chapters-nav" aria-label="Gallery chapters">
			<div class="abu-pg-chapters-nav-inner">
				<?php foreach ( $chapters as $chapter ) : ?>
					<a href="#<?php echo esc_attr( $chapter['slug'] ); ?>" 
					   class="abu-pg-chapter-link" 
					   data-chapter-id="<?php echo esc_attr( $chapter['id'] ); ?>"
					   data-chapter-slug="<?php echo esc_attr( $chapter['slug'] ); ?>">
						<?php echo esc_html( $chapter['name'] ); ?>
					</a>
				<?php endforeach; ?>
			</div>
		</nav>

		<!-- Chapter Sections -->
		<div class="abu-pg-chapters-content">
			<?php foreach ( $chapters as $index => $chapter ) : ?>
				<section id="<?php echo esc_attr( $chapter['slug'] ); ?>" 
				         class="abu-pg-chapter-section" 
				         data-chapter-id="<?php echo esc_attr( $chapter['id'] ); ?>"
				         data-chapter-slug="<?php echo esc_attr( $chapter['slug'] ); ?>">
					
					<!-- Masonry grid for this chapter -->
					<div class="abu-pg-gallery" data-post-id="<?php echo esc_attr( $post_id ); ?>" data-column-width="280" data-gutter="16" data-chapter-id="<?php echo esc_attr( $chapter['id'] ); ?>">
						<?php foreach ( $chapter['mediaIds'] as $id ) : ?>
							<?php echo abu_pg_render_tile( $id, $debug_enabled ); ?>
						<?php endforeach; ?>
					</div>
				</section>
			<?php endforeach; ?>
		</div>
	</div>
	<?php
	return ob_get_clean();
}
add_shortcode( 'abu_pinterest_gallery', 'abu_pg_shortcode' ); 