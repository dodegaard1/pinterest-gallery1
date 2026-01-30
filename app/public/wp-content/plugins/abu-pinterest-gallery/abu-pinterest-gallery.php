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
		'0.3.6'
	);
	$gallery_version = '0.6.0';
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
		'1.0.0',
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
	
	foreach ( $chapters as $chapter ) {
		if ( ! is_array( $chapter ) ) {
			continue;
		}
		
		// Validate required fields
		if ( empty( $chapter['id'] ) || empty( $chapter['name'] ) || ! isset( $chapter['mediaIds'] ) ) {
			continue;
		}
		
		// Sanitize chapter data
		$clean_chapter = array(
			'id'       => sanitize_key( $chapter['id'] ),
			'name'     => sanitize_text_field( $chapter['name'] ),
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
		// Get dimensions from the actual medium_large size being rendered
		$image_src = wp_get_attachment_image_src( $id, 'medium_large' );
		if ( $image_src && ! empty( $image_src[1] ) && ! empty( $image_src[2] ) ) {
			$media_width  = absint( $image_src[1] );
			$media_height = absint( $image_src[2] );
		} else {
			// Fallback to full size metadata
			$meta = wp_get_attachment_metadata( $id );
			if ( is_array( $meta ) && ! empty( $meta['width'] ) && ! empty( $meta['height'] ) ) {
				$media_width  = absint( $meta['width'] );
				$media_height = absint( $meta['height'] );
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
		echo wp_get_attachment_image(
			$id,
			'medium_large',
			false,
			array(
				'loading'  => 'lazy',
				'decoding' => 'async',
				'sizes'    => '(max-width: 600px) 50vw, 280px',
			)
		);
		?>
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
					<a href="#abu-chapter-<?php echo esc_attr( $chapter['id'] ); ?>" 
					   class="abu-pg-chapter-link" 
					   data-chapter-id="<?php echo esc_attr( $chapter['id'] ); ?>">
						<?php echo esc_html( $chapter['name'] ); ?>
					</a>
				<?php endforeach; ?>
			</div>
		</nav>

		<!-- Chapter Sections -->
		<div class="abu-pg-chapters-content">
			<?php foreach ( $chapters as $index => $chapter ) : ?>
				<section id="abu-chapter-<?php echo esc_attr( $chapter['id'] ); ?>" 
				         class="abu-pg-chapter-section" 
				         data-chapter-id="<?php echo esc_attr( $chapter['id'] ); ?>">
					
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