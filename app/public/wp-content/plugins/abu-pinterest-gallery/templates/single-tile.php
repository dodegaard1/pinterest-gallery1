<?php
/**
 * Template for single tile post (spotlight-first view).
 * 
 * This template renders a tile in spotlight mode when accessed via its permalink.
 * It uses the same spotlight UI components as the gallery shortcode.
 * 
 * @package ABU_Pinterest_Gallery
 */

defined( 'ABSPATH' ) || exit;

$tile_id = get_the_ID();
$kit_id = isset( $_GET['kit'] ) ? absint( $_GET['kit'] ) : 0;

// Get tile data
$tile_data = abu_pg_get_tile_metadata( $tile_id );
if ( ! $tile_data ) {
	wp_die( __( 'Tile not found.', 'abu-pg' ), 404 );
}

// Get kit context if provided
$kit_post = null;
$kit_title = '';
$kit_url = '';
$chapters = array();
$adjacent_tiles = array();

if ( $kit_id ) {
	$kit_post = get_post( $kit_id );
	if ( $kit_post ) {
		$kit_title = get_the_title( $kit_id );
		$kit_url = get_permalink( $kit_id );
		
		// Load chapters from kit to get adjacent tiles
		$chapters_json = get_post_meta( $kit_id, 'abu_pg_chapters_json', true );
		$chapters = abu_pg_parse_chapters( $chapters_json );
		
		// #region agent log
		// Hypothesis F: Log kit context loading
		error_log('[DEBUG] ' . json_encode(['sessionId'=>'debug-session','runId'=>'initial','hypothesisId'=>'F','location'=>'single-tile.php:36','message'=>'Kit context loaded','data'=>['kit_id'=>$kit_id,'has_chapters'=>!empty($chapters),'chapter_count'=>count($chapters)],'timestamp'=>time()*1000]));
		// #endregion
		
		// Get ALL tiles from this kit for adjacent tiles display
		$adjacent_tiles = abu_pg_get_all_tiles_from_kit( $kit_id );
		
		// #region agent log
		// Hypothesis G: Log adjacent tiles loading
		error_log('[DEBUG] ' . json_encode(['sessionId'=>'debug-session','runId'=>'initial','hypothesisId'=>'G','location'=>'single-tile.php:45','message'=>'Adjacent tiles loaded','data'=>['kit_id'=>$kit_id,'tile_count'=>count($adjacent_tiles),'current_tile_id'=>$tile_id],'timestamp'=>time()*1000]));
		// #endregion
		
		if ( $chapters ) {
			// Get adjacent tiles for this kit
			$tile_data_with_context = abu_pg_find_tile_in_chapters( $tile_id, $chapters );
			if ( $tile_data_with_context ) {
				$tile_data = array_merge( $tile_data, $tile_data_with_context );
			}
		}
		
		// Add adjacent tiles to tile_data for JavaScript
		if ( ! empty( $adjacent_tiles ) ) {
			$tile_data['adjacentTiles'] = $adjacent_tiles;
		}
	}
}

// Enqueue required assets
wp_enqueue_style( 'abu-pg-gallery' );
wp_enqueue_script( 'abu-pg-gallery' );

// Localize config for auth state and AJAX
wp_localize_script(
	'abu-pg-gallery',
	'abuPgConfig',
	array(
		'ajaxUrl'      => admin_url( 'admin-ajax.php' ),
		'nonce'        => wp_create_nonce( 'abu_pg_ajax' ),
		'isLoggedIn'   => is_user_logged_in(),
		'currentUserId' => get_current_user_id(), // Current user ID (0 if logged out)
		'canDownload'  => is_user_logged_in(),
		'canShare'     => is_user_logged_in(),
		'canLike'      => is_user_logged_in(),
		'canComment'   => is_user_logged_in(),
		'loginUrl'     => wp_login_url( get_permalink() ),
	)
);

// Debug mode detection
$debug_enabled = isset( $_GET['abu_pg_debug'] ) && '0' !== sanitize_text_field( wp_unslash( $_GET['abu_pg_debug'] ) );

if ( $debug_enabled ) {
	wp_localize_script(
		'abu-pg-gallery',
		'abuPgDebug',
		array(
			'enabled'  => true,
			'endpoint' => admin_url( 'admin-ajax.php' ),
			'deepLink' => true,
		)
	);
}

?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="robots" content="max-image-preview:large">
	<title><?php echo esc_html( get_the_title() ); ?> - <?php bloginfo( 'name' ); ?></title>
	<?php wp_head(); ?>
	<style>
		/* Minimal page styles for spotlight-first view */
		body {
			margin: 0;
			padding: 0;
			overflow: hidden;
			background: #000;
		}
		.abu-pg-tile-spotlight-container {
			position: relative;
			width: 100%;
			height: 100vh;
		}
		/* Ensure spotlight opens immediately */
		.abu-pg-spotlight {
			display: flex !important;
			opacity: 1 !important;
		}
	</style>
</head>
<body <?php body_class( 'abu-pg-tile-single' ); ?>>

	<!-- Icon templates for spotlight UI (using existing icon system) -->
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

	<div class="abu-pg-tile-spotlight-container" data-tile-id="<?php echo esc_attr( $tile_id ); ?>" <?php if ( $kit_id ) : ?>data-kit-id="<?php echo esc_attr( $kit_id ); ?>"<?php endif; ?>>
		<!-- Tile data for JS -->
		<script type="application/json" id="abu-pg-tile-data">
			<?php echo wp_json_encode( $tile_data ); ?>
		</script>
		
		<?php if ( $kit_url ) : ?>
			<!-- Kit context for back navigation -->
			<script type="application/json" id="abu-pg-kit-context">
				<?php
				echo wp_json_encode(
					array(
						'kitId'    => $kit_id,
						'kitTitle' => $kit_title,
						'kitUrl'   => $kit_url,
					)
				);
				?>
			</script>
		<?php endif; ?>
		
		<!-- Comments container (always rendered, permission handled by JS) -->
		<div id="abu-pg-comments-container" class="abu-pg-comments-container" data-tile-id="<?php echo esc_attr( $tile_id ); ?>" data-can-comment="<?php echo is_user_logged_in() ? 'true' : 'false'; ?>">
			<!-- Comments loaded/displayed by gallery.js in spotlight UI -->
		</div>
	</div>

	<?php wp_footer(); ?>
	
	<script>
		/**
		 * Initialize spotlight-first mode when DOM is ready.
		 * 
		 * CLEAN BREAK: Simplified tile permalink initialization.
		 * Opens spotlight using canonical tile data (no query param handling).
		 */
		(function() {
			'use strict';
			
			const ready = (fn) => {
				if (document.readyState === 'loading') {
					document.addEventListener('DOMContentLoaded', fn);
				} else {
					fn();
				}
			};
			
			ready(function() {
				// Enable debug mode for mobile spotlight debugging
				window.ABU_DEBUG = true;
				console.log('[ABU_DEBUG] Debug mode enabled on tile permalink page');
				
				const tileDataEl = document.getElementById('abu-pg-tile-data');
				const kitContextEl = document.getElementById('abu-pg-kit-context');
				
				if (!tileDataEl) {
					console.error('[Tile Permalink] Tile data element not found');
					return;
				}
				
				let tileData;
				try {
					tileData = JSON.parse(tileDataEl.textContent);
				} catch (e) {
					console.error('[Tile Permalink] Failed to parse tile data:', e);
					return;
				}
				
				let kitContext = null;
				if (kitContextEl) {
					try {
						kitContext = JSON.parse(kitContextEl.textContent);
					} catch (e) {
						console.warn('[Tile Permalink] Failed to parse kit context:', e);
					}
				}
				
				// Wait for gallery.js to be available
				const checkGalleryReady = () => {
					// Check if spotlight infrastructure is available (from gallery.js)
					if (typeof window.openSpotlightForTilePermalink === 'function') {
						try {
							// Call the spotlight opener with tile data
							window.openSpotlightForTilePermalink(tileData, kitContext);
						} catch (e) {
							console.error('[Tile Permalink] Spotlight open error:', e);
						}
					} else {
						// Gallery.js not loaded yet, wait a bit
						setTimeout(checkGalleryReady, 50);
					}
				};
				
				checkGalleryReady();
			});
		})();
	</script>
	
</body>
</html>
