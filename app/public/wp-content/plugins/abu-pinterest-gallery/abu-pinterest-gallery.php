<?php
/**
 * Plugin Name: ABU Pinterest Gallery
 * Description: Thin-slice Pinterest-style gallery for posts and pages with deep link support.
 * Version: 2.0.0
 * Author: ABU
 * 
 * IMPORTANT: After activating or updating this plugin, visit Settings > Permalinks and click "Save Changes"
 * to flush the rewrite rules and ensure tile permalinks work correctly.
 */

defined( 'ABSPATH' ) || exit;

define( 'ABU_PG_PATH', plugin_dir_path( __FILE__ ) );
define( 'ABU_PG_URL', plugin_dir_url( __FILE__ ) );
define( 'ABU_PG_META_KEY', '_abu_gallery_media_ids' );
define( 'ABU_PG_DEBUG_LOG_PATH', '/Users/danielodegaard/Local Sites/abu-dev/.cursor/debug.log' );

/**
 * ========================================
 * CPT REGISTRATION
 * ========================================
 */

/**
 * Register Tile CPT (abu_pg_tile)
 * 
 * Each tile is a canonical resource representing a single media item (image or video).
 * Tiles have their own permalinks, metadata, and WordPress comments.
 */
function abu_pg_register_tile_cpt() {
	$labels = array(
		'name'               => __( 'Tiles', 'abu-pg' ),
		'singular_name'      => __( 'Tile', 'abu-pg' ),
		'add_new'            => __( 'Add New Tile', 'abu-pg' ),
		'add_new_item'       => __( 'Add New Tile', 'abu-pg' ),
		'edit_item'          => __( 'Edit Tile', 'abu-pg' ),
		'new_item'           => __( 'New Tile', 'abu-pg' ),
		'view_item'          => __( 'View Tile', 'abu-pg' ),
		'search_items'       => __( 'Search Tiles', 'abu-pg' ),
		'not_found'          => __( 'No tiles found', 'abu-pg' ),
		'not_found_in_trash' => __( 'No tiles found in trash', 'abu-pg' ),
	);
	
	$args = array(
		'labels'              => $labels,
		'public'              => true,
		'publicly_queryable'  => true,
		'show_ui'             => false, // Hidden from admin menu (managed via Gallery Maker)
		'show_in_menu'        => false,
		'show_in_nav_menus'   => false,
		'show_in_admin_bar'   => false,
		'exclude_from_search' => true, // Prevent WP site search from showing tile posts
		'query_var'           => true,
		'rewrite'             => array(
			'slug'       => 'tile',
			'with_front' => false,
		),
		'capability_type'     => 'post',
		'has_archive'         => false,
		'hierarchical'        => false,
		'menu_position'       => null,
		'supports'            => array( 'title', 'comments', 'custom-fields' ),
		'show_in_rest'        => true, // For Gutenberg compatibility
	);
	
	register_post_type( 'abu_pg_tile', $args );
}
add_action( 'init', 'abu_pg_register_tile_cpt' );

/**
 * Register Content Kit CPT (abu_content_kit)
 * 
 * Content Kits represent galleries/boards with ordered tiles and chapter structure.
 * Phase 1: Optional (galleries can remain in post meta on regular posts/pages)
 * Phase 2: Full migration to CPT-based kits
 */
function abu_pg_register_content_kit_cpt() {
	$labels = array(
		'name'               => __( 'Content Kits', 'abu-pg' ),
		'singular_name'      => __( 'Content Kit', 'abu-pg' ),
		'add_new'            => __( 'Add New Kit', 'abu-pg' ),
		'add_new_item'       => __( 'Add New Content Kit', 'abu-pg' ),
		'edit_item'          => __( 'Edit Content Kit', 'abu-pg' ),
		'new_item'           => __( 'New Content Kit', 'abu-pg' ),
		'view_item'          => __( 'View Content Kit', 'abu-pg' ),
		'search_items'       => __( 'Search Content Kits', 'abu-pg' ),
		'not_found'          => __( 'No content kits found', 'abu-pg' ),
		'not_found_in_trash' => __( 'No content kits found in trash', 'abu-pg' ),
	);
	
	$args = array(
		'labels'              => $labels,
		'public'              => true,
		'publicly_queryable'  => true,
		'show_ui'             => true, // Show in admin menu
		'show_in_menu'        => true,
		'show_in_nav_menus'   => true,
		'show_in_admin_bar'   => true,
		'query_var'           => true,
		'rewrite'             => array(
			'slug'       => 'content-kit',
			'with_front' => false,
		),
		'capability_type'     => 'post',
		'has_archive'         => true,
		'hierarchical'        => false,
		'menu_position'       => 20,
		'menu_icon'           => 'dashicons-portfolio',
		'supports'            => array( 'title', 'editor', 'thumbnail', 'custom-fields', 'excerpt' ),
		'show_in_rest'        => true,
		'taxonomies'          => array( 'abu_organization' ), // Support organization taxonomy
	);
	
	register_post_type( 'abu_content_kit', $args );
}
add_action( 'init', 'abu_pg_register_content_kit_cpt' );

/**
 * Organization taxonomy registration moved to ABU Users plugin.
 * 
 * The abu_organization taxonomy is now registered by the ABU Users plugin
 * which owns all user/org logic. This plugin still supports the taxonomy
 * for content kit tagging and archive templates.
 */

/**
 * ========================================
 * PERMISSION FUNCTIONS
 * ========================================
 * 
 * NOTE: User/organization management has been moved to ABU Users plugin.
 * The functions abu_pg_get_user_primary_organization() and 
 * abu_pg_set_user_primary_organization() are now provided by ABU Users
 * as backward compatibility wrappers.
 */

/**
 * ========================================
 * RIGHT-CLICK PROTECTION
 * ========================================
 */

/**
 * Disable right-click on images for logged-out users
 */
function abu_pg_add_contextmenu_protection() {
	if ( ! is_user_logged_in() ) {
		?>
		<script>
		document.addEventListener('DOMContentLoaded', function() {
			document.querySelectorAll('.abu-pg-tile img, .abu-pg-tile video').forEach(function(el) {
				el.addEventListener('contextmenu', function(e) {
					e.preventDefault();
					return false;
				});
			});
		});
		</script>
		<?php
	}
}
add_action( 'wp_footer', 'abu_pg_add_contextmenu_protection' );

/**
 * ========================================
 * ADMIN MENU - GALLERY MAKER BUTTON
 * ========================================
 */

/**
 * Add "Gallery Maker" button to admin menu.
 * 
 * This provides easy access to create new Content Kits from the dashboard.
 * Redirects to the Content Kit post editor where the Gallery Maker block is available.
 */
function abu_pg_add_gallery_maker_menu() {
	add_menu_page(
		__( 'Gallery Maker', 'abu-pg' ),           // Page title
		__( 'Gallery Maker', 'abu-pg' ),           // Menu title
		'edit_posts',                               // Capability
		'post-new.php?post_type=abu_content_kit',  // URL
		'',                                         // Callback (not needed, using URL)
		'dashicons-images-alt2',                    // Icon
		21                                          // Position (right after Content Kits menu)
	);
}
add_action( 'admin_menu', 'abu_pg_add_gallery_maker_menu' );

/**
 * ========================================
 * HEARTS/LIKES SYSTEM
 * ========================================
 */

/**
 * Check if user has liked a tile.
 * 
 * @param int $user_id User ID (0 for current user).
 * @param int $tile_id Tile post ID.
 * @return bool True if user has liked this tile.
 */
function abu_pg_user_has_liked_tile( $user_id, $tile_id ) {
	if ( ! $user_id ) {
		$user_id = get_current_user_id();
	}
	
	if ( ! $user_id || ! $tile_id ) {
		return false;
	}
	
	$likes = get_post_meta( $tile_id, '_abu_pg_likes', true );
	if ( ! is_array( $likes ) ) {
		$likes = array();
	}
	
	return in_array( $user_id, $likes, true );
}

/**
 * Get like count for a tile.
 * 
 * @param int $tile_id Tile post ID.
 * @return int Number of likes.
 */
function abu_pg_get_tile_like_count( $tile_id ) {
	$likes = get_post_meta( $tile_id, '_abu_pg_likes', true );
	if ( ! is_array( $likes ) ) {
		return 0;
	}
	return count( $likes );
}

/**
 * AJAX handler to like a tile.
 */
function abu_pg_ajax_like_tile() {
	if ( ! is_user_logged_in() ) {
		wp_send_json_error( array( 'message' => 'Must be logged in to like' ), 403 );
	}
	
	$tile_id = isset( $_POST['tile_id'] ) ? absint( $_POST['tile_id'] ) : 0;
	
	if ( ! $tile_id ) {
		wp_send_json_error( array( 'message' => 'Invalid tile ID' ), 400 );
	}
	
	// Verify tile exists
	$tile_post = get_post( $tile_id );
	if ( ! $tile_post || 'abu_pg_tile' !== $tile_post->post_type ) {
		wp_send_json_error( array( 'message' => 'Tile not found' ), 404 );
	}
	
	// Check if user can view this tile
	if ( ! abu_pg_user_can_view_tile( 0, $tile_id ) ) {
		wp_send_json_error( array( 'message' => 'Permission denied' ), 403 );
	}
	
	$user_id = get_current_user_id();
	
	// Get existing likes
	$likes = get_post_meta( $tile_id, '_abu_pg_likes', true );
	if ( ! is_array( $likes ) ) {
		$likes = array();
	}
	
	// Add user to likes if not already present
	if ( ! in_array( $user_id, $likes, true ) ) {
		$likes[] = $user_id;
		update_post_meta( $tile_id, '_abu_pg_likes', $likes );
	}
	
	wp_send_json_success(
		array(
			'liked'     => true,
			'likeCount' => count( $likes ),
		)
	);
}
add_action( 'wp_ajax_abu_pg_like_tile', 'abu_pg_ajax_like_tile' );

/**
 * AJAX handler to unlike a tile.
 */
function abu_pg_ajax_unlike_tile() {
	if ( ! is_user_logged_in() ) {
		wp_send_json_error( array( 'message' => 'Must be logged in to unlike' ), 403 );
	}
	
	$tile_id = isset( $_POST['tile_id'] ) ? absint( $_POST['tile_id'] ) : 0;
	
	if ( ! $tile_id ) {
		wp_send_json_error( array( 'message' => 'Invalid tile ID' ), 400 );
	}
	
	// Verify tile exists
	$tile_post = get_post( $tile_id );
	if ( ! $tile_post || 'abu_pg_tile' !== $tile_post->post_type ) {
		wp_send_json_error( array( 'message' => 'Tile not found' ), 404 );
	}
	
	$user_id = get_current_user_id();
	
	// Get existing likes
	$likes = get_post_meta( $tile_id, '_abu_pg_likes', true );
	if ( ! is_array( $likes ) ) {
		$likes = array();
	}
	
	// Remove user from likes
	$likes = array_diff( $likes, array( $user_id ) );
	$likes = array_values( $likes ); // Re-index array
	
	update_post_meta( $tile_id, '_abu_pg_likes', $likes );
	
	wp_send_json_success(
		array(
			'liked'     => false,
			'likeCount' => count( $likes ),
		)
	);
}
add_action( 'wp_ajax_abu_pg_unlike_tile', 'abu_pg_ajax_unlike_tile' );

/**
 * ========================================
 * REST API ENDPOINT FOR KIT TILES (PHASE 4)
 * ========================================
 * 
 * Endpoint: /wp-json/abu-pg/v1/kit/{kitId}/tiles
 * Used by SPA navigation to bootstrap kit context when cache is empty.
 */
function abu_pg_register_rest_routes() {
	register_rest_route( 'abu-pg/v1', '/kit/(?P<kit_id>\d+)/tiles', array(
		'methods'             => 'GET',
		'callback'            => 'abu_pg_rest_get_kit_tiles',
		'permission_callback' => '__return_true', // Public endpoint (tiles are public)
		'args'                => array(
			'kit_id' => array(
				'required'          => true,
				'validate_callback' => function( $param ) {
					return is_numeric( $param );
				},
			),
		),
	) );
}
add_action( 'rest_api_init', 'abu_pg_register_rest_routes' );

/**
 * REST API callback: Get all tiles from a Content Kit.
 * Returns minimal tile metadata for SPA navigation.
 * 
 * @param WP_REST_Request $request REST request object.
 * @return WP_REST_Response|WP_Error
 */
function abu_pg_rest_get_kit_tiles( $request ) {
	$kit_id = absint( $request['kit_id'] );
	
	// Validate kit exists
	$kit_post = get_post( $kit_id );
	if ( ! $kit_post || 'abu_content_kit' !== $kit_post->post_type ) {
		return new WP_Error( 'invalid_kit', 'Content Kit not found', array( 'status' => 404 ) );
	}
	
	// Check if kit is published (public)
	if ( 'publish' !== $kit_post->post_status ) {
		return new WP_Error( 'kit_not_public', 'Content Kit is not public', array( 'status' => 403 ) );
	}
	
	// Get all tiles from kit using existing helper
	$tiles = abu_pg_get_all_tiles_from_kit( $kit_id );
	
	if ( empty( $tiles ) ) {
		return new WP_Error( 'no_tiles', 'No tiles found in kit', array( 'status' => 404 ) );
	}
	
	// Return minimal response
	return new WP_REST_Response(
		array(
			'kitId'    => $kit_id,
			'kitUrl'   => get_permalink( $kit_id ),
			'kitTitle' => get_the_title( $kit_id ),
			'tiles'    => $tiles,
		),
		200
	);
}





/**
 * Check if user can view a content kit.
 * 
 * @param int $user_id User ID (0 for current user).
 * @param int $kit_id Content Kit post ID or post/page ID with kit in meta.
 * @return bool
 */
function abu_pg_user_can_view_content_kit( $user_id, $kit_id ) {
	if ( ! $user_id ) {
		$user_id = get_current_user_id();
	}
	
	$post = get_post( $kit_id );
	if ( ! $post ) {
		return false;
	}
	
	// Public content (published) is viewable by anyone
	if ( 'publish' === $post->post_status ) {
		return true;
	}
	
	// Private content requires login
	if ( ! $user_id ) {
		return false;
	}
	
	// User must be able to edit posts or be the author
	if ( current_user_can( 'edit_posts' ) || absint( $post->post_author ) === $user_id ) {
		return true;
	}
	
	// Future: Add custom taxonomy/meta-based access control here
	// e.g., check if user belongs to a specific client/dashboard group
	
	return false;
}

/**
 * Check if user can view a tile.
 * 
 * @param int $user_id User ID (0 for current user).
 * @param int $tile_id Tile post ID.
 * @param int $kit_id Optional kit context.
 * @return bool
 */
function abu_pg_user_can_view_tile( $user_id, $tile_id, $kit_id = 0 ) {
	if ( ! $user_id ) {
		$user_id = get_current_user_id();
	}
	
	$tile_post = get_post( $tile_id );
	if ( ! $tile_post || 'abu_pg_tile' !== $tile_post->post_type ) {
		return false;
	}
	
	// TILES ARE PUBLICLY VIEWABLE
	// All tiles can be viewed by anyone (logged in or out)
	// Only features (download/like/comment) are permission-gated
	return true;
}

/**
 * Check if user can comment on a tile.
 * 
 * @param int $user_id User ID (0 for current user).
 * @param int $tile_id Tile post ID.
 * @return bool
 */
function abu_pg_user_can_comment_on_tile( $user_id, $tile_id ) {
	if ( ! $user_id ) {
		$user_id = get_current_user_id();
	}
	
	// User must be logged in
	if ( ! $user_id ) {
		return false;
	}
	
	// User must have view access to the tile
	if ( ! abu_pg_user_can_view_tile( $user_id, $tile_id ) ) {
		return false;
	}
	
	// Comments must be open on the tile post
	$tile_post = get_post( $tile_id );
	if ( ! $tile_post || 'open' !== $tile_post->comment_status ) {
		return false;
	}
	
	return true;
}

/**
 * Find all kits (post/page or CPT) containing a specific tile.
 * 
 * CLEAN BREAK: Uses meta index (abu_pg_tile_index), not JSON LIKE searches.
 * 
 * @param int $tile_id Tile post ID.
 * @return array Array of post IDs containing this tile.
 */
function abu_pg_find_kits_containing_tile( $tile_id ) {
	$tile_id = absint( $tile_id );
	if ( ! $tile_id ) {
		return array();
	}
	
	// Query using the tile index
	$query = new WP_Query(
		array(
			'post_type'      => array( 'post', 'page', 'abu_content_kit' ),
			'post_status'    => 'any',
			'posts_per_page' => -1,
			'fields'         => 'ids',
			'meta_query'     => array(
				array(
					'key'     => 'abu_pg_tile_index',
					'value'   => $tile_id,
					'compare' => '=',
				),
			),
		)
	);
	
	return $query->posts;
}

/**
 * Rebuild the kit->tile index for a given kit.
 * 
 * Creates repeated postmeta entries (abu_pg_tile_index) for each tile in the kit.
 * This enables fast querying of which kits contain a specific tile.
 * 
 * @param int   $kit_id   Kit/post ID.
 * @param array $chapters Array of chapter data with tileIds.
 */
function abu_pg_rebuild_kit_tile_index( $kit_id, $chapters ) {
	$kit_id = absint( $kit_id );
	if ( ! $kit_id || ! is_array( $chapters ) ) {
		return;
	}
	
	// Delete all existing index entries for this kit
	delete_post_meta( $kit_id, 'abu_pg_tile_index' );
	
	// Collect all unique tile IDs across all chapters
	$all_tile_ids = array();
	foreach ( $chapters as $chapter ) {
		if ( ! empty( $chapter['tileIds'] ) && is_array( $chapter['tileIds'] ) ) {
			foreach ( $chapter['tileIds'] as $tile_id ) {
				$tile_id = absint( $tile_id );
				if ( $tile_id > 0 ) {
					$all_tile_ids[ $tile_id ] = true; // Use array keys to ensure uniqueness
				}
			}
		}
	}
	
	// Add index entry for each unique tile
	foreach ( array_keys( $all_tile_ids ) as $tile_id ) {
		add_post_meta( $kit_id, 'abu_pg_tile_index', $tile_id, false ); // false = allow multiple values
	}
}

/**
 * ========================================
 * TILE POST MAPPING & MANAGEMENT
 * ========================================
 */

/**
 * Get or create a tile post for an attachment.
 * 
 * Implements 1:1 mapping between attachments and tile posts.
 * If a tile already exists for this attachment, return its ID.
 * Otherwise, create a new tile post.
 * 
 * @param int   $attachment_id WP attachment ID.
 * @param array $tile_data Optional tile metadata (type, derivatives).
 * @return int|false Tile post ID on success, false on failure.
 */
function abu_pg_get_or_create_tile_post_for_attachment( $attachment_id, $tile_data = array() ) {
	$attachment_id = absint( $attachment_id );
	if ( ! $attachment_id ) {
		return false;
	}
	
	// Check if tile already exists for this attachment
	$existing_tile_id = get_post_meta( $attachment_id, '_abu_pg_tile_post_id', true );
	if ( $existing_tile_id ) {
		$existing_tile = get_post( $existing_tile_id );
		if ( $existing_tile && 'abu_pg_tile' === $existing_tile->post_type ) {
			return absint( $existing_tile_id );
		}
	}
	
	// Get attachment details
	$attachment = get_post( $attachment_id );
	if ( ! $attachment ) {
		return false;
	}
	
	$mime_type = get_post_mime_type( $attachment_id );
	$is_video = 0 === strpos( $mime_type, 'video/' );
	$is_image = 0 === strpos( $mime_type, 'image/' );
	
	if ( ! $is_video && ! $is_image ) {
		return false;
	}
	
	// Determine tile type
	$tile_type = $is_video ? 'video' : 'image';
	if ( isset( $tile_data['type'] ) ) {
		$tile_type = $tile_data['type'];
	}
	
	// Create tile post
	$tile_title = $attachment->post_title;
	if ( empty( $tile_title ) ) {
		$tile_title = 'Tile ' . $attachment_id;
	}
	
	$tile_post_data = array(
		'post_title'   => $tile_title,
		'post_type'    => 'abu_pg_tile',
		'post_status'  => 'publish',
		'comment_status' => 'open', // Enable comments by default
		'post_author'  => $attachment->post_author,
	);
	
	$tile_post_id = wp_insert_post( $tile_post_data, true );
	
	if ( is_wp_error( $tile_post_id ) ) {
		return false;
	}
	
	// Store tile meta
	update_post_meta( $tile_post_id, '_abu_pg_attachment_id', $attachment_id );
	update_post_meta( $tile_post_id, '_abu_pg_tile_type', $tile_type );
	
	// Store derivative references for videos
	if ( $is_video ) {
		$poster_id = absint( get_post_meta( $attachment_id, '_abu_video_poster_id', true ) );
		$video_720_id = absint( get_post_meta( $attachment_id, '_abu_video_720_id', true ) );
		$video_360_id = absint( get_post_meta( $attachment_id, '_abu_video_360_id', true ) );
		
		if ( $poster_id ) {
			update_post_meta( $tile_post_id, '_abu_pg_poster_attachment_id', $poster_id );
		}
		if ( $video_720_id ) {
			update_post_meta( $tile_post_id, '_abu_pg_video_720_attachment_id', $video_720_id );
		}
		if ( $video_360_id ) {
			update_post_meta( $tile_post_id, '_abu_pg_video_360_attachment_id', $video_360_id );
		}
		
		// Store derivatives JSON if provided
		if ( isset( $tile_data['derivatives'] ) ) {
			update_post_meta( $tile_post_id, '_abu_pg_derivatives_json', wp_json_encode( $tile_data['derivatives'] ) );
		}
	}
	
	// Create reverse mapping: attachment -> tile
	update_post_meta( $attachment_id, '_abu_pg_tile_post_id', $tile_post_id );
	
	return $tile_post_id;
}

/**
 * Get tile post ID for an attachment.
 * 
 * @param int $attachment_id WP attachment ID.
 * @return int|false Tile post ID or false if not found.
 */
function abu_pg_get_tile_post_id_for_attachment( $attachment_id ) {
	$attachment_id = absint( $attachment_id );
	if ( ! $attachment_id ) {
		return false;
	}
	
	$tile_post_id = get_post_meta( $attachment_id, '_abu_pg_tile_post_id', true );
	if ( ! $tile_post_id ) {
		return false;
	}
	
	// Verify tile post exists and is correct type
	$tile_post = get_post( $tile_post_id );
	if ( ! $tile_post || 'abu_pg_tile' !== $tile_post->post_type ) {
		// Clean up stale reference
		delete_post_meta( $attachment_id, '_abu_pg_tile_post_id' );
		return false;
	}
	
	return absint( $tile_post_id );
}

/**
 * Get attachment ID for a tile post.
 * 
 * @param int $tile_post_id Tile post ID.
 * @return int|false Attachment ID or false if not found.
 */
function abu_pg_get_attachment_id_for_tile( $tile_post_id ) {
	$tile_post_id = absint( $tile_post_id );
	if ( ! $tile_post_id ) {
		return false;
	}
	
	return absint( get_post_meta( $tile_post_id, '_abu_pg_attachment_id', true ) );
}

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

/**
 * ========================================
 * GALLERY MAKER SAVE HOOK
 * ========================================
 * 
 * Intercepts post save to convert attachment IDs to tile IDs.
 * This creates tile posts for all attachments in the gallery structure.
 */

/**
 * Convert attachment IDs to tile IDs in gallery structure on save.
 * 
 * CLEAN BREAK: Outputs only tileIds[] arrays. No legacy mediaIds stored.
 * Failed conversions are SKIPPED (not preserved as attachment IDs).
 * 
 * This hook runs when a post/page is saved and:
 * 1. Checks if abu_pg_chapters_json exists
 * 2. For each ID in mediaIds OR tileIds, validates/converts to tile post
 * 3. Outputs canonical structure with ONLY tileIds[]
 * 4. Saves the updated structure back to post meta
 * 
 * @param int $post_id Post ID being saved.
 */
function abu_pg_convert_attachments_to_tiles_on_save( $post_id ) {
	// Skip autosaves and revisions
	if ( wp_is_post_autosave( $post_id ) || wp_is_post_revision( $post_id ) ) {
		return;
	}
	
	// Check if user has permission to edit this post
	$post_type = get_post_type( $post_id );
	if ( ! current_user_can( 'edit_post', $post_id ) ) {
		return;
	}
	
	// Get chapters JSON from post meta
	$chapters_json = get_post_meta( $post_id, 'abu_pg_chapters_json', true );
	if ( empty( $chapters_json ) ) {
		return;
	}
	
	// Parse chapters
	$chapters = json_decode( $chapters_json, true );
	if ( ! is_array( $chapters ) || empty( $chapters ) ) {
		return;
	}
	
	$needs_update = false;
	$converted_chapters = array();
	
	foreach ( $chapters as $chapter ) {
		if ( ! is_array( $chapter ) ) {
			$converted_chapters[] = $chapter;
			continue;
		}
		
		// Get IDs from either mediaIds (legacy) or tileIds (canonical)
		$input_ids = array();
		if ( ! empty( $chapter['mediaIds'] ) && is_array( $chapter['mediaIds'] ) ) {
			$input_ids = $chapter['mediaIds'];
			$needs_update = true; // Legacy key present, force update
		} elseif ( ! empty( $chapter['tileIds'] ) && is_array( $chapter['tileIds'] ) ) {
			$input_ids = $chapter['tileIds'];
		}
		
		if ( empty( $input_ids ) ) {
			// No IDs at all, preserve chapter structure but skip tile processing
			$converted_chapter = $chapter;
			unset( $converted_chapter['mediaIds'] ); // Remove legacy key
			$converted_chapter['tileIds'] = array();
			$converted_chapters[] = $converted_chapter;
			continue;
		}
		
		$tile_ids = array();
		
		foreach ( $input_ids as $media_id ) {
			$media_id = absint( $media_id );
			if ( ! $media_id ) {
				continue;
			}
			
			// Check if this is already a tile ID (tile post exists)
			$maybe_tile_post = get_post( $media_id );
			if ( $maybe_tile_post && 'abu_pg_tile' === $maybe_tile_post->post_type ) {
				// Already a tile ID, keep it
				$tile_ids[] = $media_id;
				continue;
			}
			
			// This is an attachment ID, convert to tile
			$tile_post_id = abu_pg_get_or_create_tile_post_for_attachment( $media_id );
			if ( $tile_post_id ) {
				$tile_ids[] = $tile_post_id;
				$needs_update = true;
			}
			// CLEAN BREAK: If conversion fails, SKIP (do not keep original ID)
		}
		
		// Build canonical chapter structure with tileIds
		$converted_chapter = $chapter;
		unset( $converted_chapter['mediaIds'] ); // Remove legacy key
		$converted_chapter['tileIds'] = $tile_ids;
		$converted_chapters[] = $converted_chapter;
	}
	
	// If any conversions happened OR structure changed, save the updated canonical structure
	if ( $needs_update ) {
		// Remove the hook temporarily to avoid infinite loop
		remove_action( 'save_post', 'abu_pg_convert_attachments_to_tiles_on_save', 20 );
		
		update_post_meta( $post_id, 'abu_pg_chapters_json', wp_json_encode( $converted_chapters ) );
		
		// Rebuild tile index
		abu_pg_rebuild_kit_tile_index( $post_id, $converted_chapters );
		
		// Re-add the hook
		add_action( 'save_post', 'abu_pg_convert_attachments_to_tiles_on_save', 20 );
	}
}
add_action( 'save_post', 'abu_pg_convert_attachments_to_tiles_on_save', 20 );

/**
 * REST API hook to convert attachments to tiles when meta is updated via REST API.
 * 
 * CLEAN BREAK: Outputs only tileIds[] arrays. No legacy mediaIds stored.
 * 
 * The Gallery Maker block updates post meta via REST API, so we need to intercept
 * the REST API meta update as well.
 */
function abu_pg_convert_tiles_on_rest_update( $value, $object, $field_name ) {
	// Only process abu_pg_chapters_json updates
	if ( 'abu_pg_chapters_json' !== $field_name ) {
		return $value;
	}
	
	if ( empty( $value ) ) {
		return $value;
	}
	
	// Parse chapters
	$chapters = json_decode( $value, true );
	if ( ! is_array( $chapters ) || empty( $chapters ) ) {
		return $value;
	}
	
	$needs_update = false;
	$converted_chapters = array();
	
	foreach ( $chapters as $chapter ) {
		if ( ! is_array( $chapter ) ) {
			$converted_chapters[] = $chapter;
			continue;
		}
		
		// Get IDs from either mediaIds (legacy) or tileIds (canonical)
		$input_ids = array();
		if ( ! empty( $chapter['mediaIds'] ) && is_array( $chapter['mediaIds'] ) ) {
			$input_ids = $chapter['mediaIds'];
			$needs_update = true; // Legacy key present, force update
		} elseif ( ! empty( $chapter['tileIds'] ) && is_array( $chapter['tileIds'] ) ) {
			$input_ids = $chapter['tileIds'];
		}
		
		if ( empty( $input_ids ) ) {
			// No IDs, skip chapter
			continue;
		}
		
		$tile_ids = array();
		
		foreach ( $input_ids as $media_id ) {
			$media_id = absint( $media_id );
			if ( ! $media_id ) {
				continue;
			}
			
			// Check if this is already a tile ID
			$maybe_tile_post = get_post( $media_id );
			if ( $maybe_tile_post && 'abu_pg_tile' === $maybe_tile_post->post_type ) {
				$tile_ids[] = $media_id;
				continue;
			}
			
			// Convert attachment to tile
			$tile_post_id = abu_pg_get_or_create_tile_post_for_attachment( $media_id );
			if ( $tile_post_id ) {
				$tile_ids[] = $tile_post_id;
				$needs_update = true;
			}
			// CLEAN BREAK: If conversion fails, SKIP (do not keep original ID)
		}
		
		// Build canonical chapter structure with tileIds
		$converted_chapter = $chapter;
		unset( $converted_chapter['mediaIds'] ); // Remove legacy key
		$converted_chapter['tileIds'] = $tile_ids;
		$converted_chapters[] = $converted_chapter;
	}
	
	// Rebuild tile index for this post
	if ( $object && isset( $object->ID ) ) {
		abu_pg_rebuild_kit_tile_index( $object->ID, $converted_chapters );
	}
	
	// Return the converted structure
	if ( $needs_update ) {
		return wp_json_encode( $converted_chapters );
	}
	
	return $value;
}
add_filter( 'rest_pre_update_post_meta', 'abu_pg_convert_tiles_on_rest_update', 10, 3 );

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
		'1.0.0' // Deep links feature added
	);
	$gallery_version = '1.0.0'; // Deep links feature implementation
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
		'1.0.0'
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
 * CLEAN BREAK: Expects canonical structure with tileIds[] arrays.
 * Accepts legacy mediaIds[] for backward compatibility during reads, but outputs tileIds[] only.
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
		
		// Validate required fields - accept either tileIds OR mediaIds (legacy)
		if ( empty( $chapter['id'] ) || empty( $chapter['name'] ) ) {
			continue;
		}
		
		// Get tile IDs from either tileIds (canonical) or mediaIds (legacy)
		$tile_ids = array();
		if ( ! empty( $chapter['tileIds'] ) && is_array( $chapter['tileIds'] ) ) {
			$tile_ids = $chapter['tileIds'];
		} elseif ( ! empty( $chapter['mediaIds'] ) && is_array( $chapter['mediaIds'] ) ) {
			// Legacy: mediaIds present but tileIds not
			$tile_ids = $chapter['mediaIds'];
		} else {
			// No tile data at all
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
		
		// Sanitize chapter data - output with canonical tileIds key
		$clean_chapter = array(
			'id'      => sanitize_key( $chapter['id'] ),
			'name'    => sanitize_text_field( $chapter['name'] ),
			'slug'    => $slug,
			'order'   => isset( $chapter['order'] ) ? absint( $chapter['order'] ) : 0,
			'tileIds' => array(),
		);
		
		// Validate tile IDs (must be positive integers)
		foreach ( $tile_ids as $id ) {
			$id = absint( $id );
			if ( $id > 0 ) {
				$clean_chapter['tileIds'][] = $id;
			}
		}
		
		// Skip chapters with no valid tiles
		if ( ! empty( $clean_chapter['tileIds'] ) ) {
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
 * CLEAN BREAK: Only accepts tile post IDs. No legacy attachment ID fallback.
 * 
 * @param int  $tile_post_id  Tile post ID (must be abu_pg_tile CPT).
 * @param bool $debug_enabled Whether debug mode is enabled.
 * @param int  $kit_id        Optional Content Kit ID for adding ?kit= parameter to permalink.
 * @return string HTML markup for the tile, or empty string if invalid.
 */
function abu_pg_render_tile( $tile_post_id, $debug_enabled = false, $kit_id = 0 ) {
	$tile_post_id = absint( $tile_post_id );
	if ( ! $tile_post_id ) {
		if ( $debug_enabled ) {
			error_log( "[ABU PG] render_tile: Invalid tile_post_id (zero or null)" );
		}
		return '';
	}
	
	// Validate that this is a tile CPT post
	$tile_post = get_post( $tile_post_id );
	if ( ! $tile_post || 'abu_pg_tile' !== $tile_post->post_type ) {
		if ( $debug_enabled ) {
			error_log( "[ABU PG] render_tile: ID {$tile_post_id} is not a valid abu_pg_tile post" );
		}
		return '';
	}
	
	// Get attachment ID from tile post
	$id = abu_pg_get_attachment_id_for_tile( $tile_post_id );
	if ( ! $id ) {
		if ( $debug_enabled ) {
			error_log( "[ABU PG] render_tile: Tile post {$tile_post_id} has no attachment ID" );
		}
		return '';
	}
	
	// Get tile permalink (required)
	$tile_permalink = get_permalink( $tile_post_id );
	if ( ! $tile_permalink ) {
		if ( $debug_enabled ) {
			error_log( "[ABU PG] render_tile: Tile post {$tile_post_id} has no permalink" );
		}
		return '';
	}
	
	// Add kit parameter to permalink if kit_id provided
	if ( $kit_id ) {
		$tile_permalink = add_query_arg( 'kit', $kit_id, $tile_permalink );
	}
	
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
	
	// Permission checks
	$is_logged_in = is_user_logged_in();
	$can_download = $is_logged_in;
	$can_share = $is_logged_in;
	$can_like = $is_logged_in;
	
	// Like data
	$like_count = abu_pg_get_tile_like_count( $tile_post_id );
	$user_has_liked = $is_logged_in && abu_pg_user_has_liked_tile( 0, $tile_post_id );
	
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
	<div class="abu-pg-tile <?php echo $can_download ? '' : 'abu-pg-requires-login'; ?>"
		data-id="<?php echo esc_attr( $tile_post_id ); ?>"
		data-attachment-id="<?php echo esc_attr( $id ); ?>"
		data-url="<?php echo esc_url( $url ); ?>"
		data-type="<?php echo esc_attr( $is_video ? 'video' : 'image' ); ?>"
		data-permalink="<?php echo esc_url( $tile_permalink ); ?>"
		data-can-download="<?php echo $can_download ? 'true' : 'false'; ?>"
		data-can-share="<?php echo $can_share ? 'true' : 'false'; ?>"
		data-can-like="<?php echo $can_like ? 'true' : 'false'; ?>"
		data-like-count="<?php echo esc_attr( $like_count ); ?>"
		data-user-has-liked="<?php echo $user_has_liked ? 'true' : 'false'; ?>"
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
			<!-- Button container for flexbox layout -->
			<div class="abu-pg-tile-button-container">
				<?php if ( $can_download ) : ?>
					<button type="button" class="abu-pg-download yp-icon-button" aria-label="Download">
						<?php echo your_plugin_icon( 'download', 'yp-icon' ); ?>
					</button>
				<?php endif; ?>
				<button type="button" class="abu-pg-mute yp-icon-button" aria-pressed="false" aria-label="Mute">
					<span class="abu-pg-mute-icon abu-pg-mute-icon-on">
						<?php echo your_plugin_icon( 'speaker-loud', 'yp-icon' ); ?>
					</span>
					<span class="abu-pg-mute-icon abu-pg-mute-icon-off">
						<?php echo your_plugin_icon( 'speaker-off', 'yp-icon' ); ?>
					</span>
				</button>
			</div>
		<?php endif; ?>
	</div>
	<?php
	return ob_get_clean();
}

/**
 * Get data for a specific item by ID from chapters
 * 
 * @param string $item_id Tile post ID
 * @param array  $chapters Array of chapter data
 * @return array|false Item data with chapter context, or false if not found
 */
function abu_pg_get_item_data( $item_id, $chapters ) {
	// Convert to integer for strict comparison with tileIds
	$item_id = absint( $item_id );
	
	foreach ( $chapters as $chapter ) {
		if ( ! empty( $chapter['tileIds'] ) && in_array( $item_id, $chapter['tileIds'], true ) ) {
			return array(
				'id'          => $item_id,
				'chapterSlug' => $chapter['slug'],
				'chapterName' => $chapter['name'],
				'chapterId'   => $chapter['id'],
			);
		}
	}
	return false;
}

/**
 * Find tile in chapters and return complete tile data for deep linking
 * 
 * @param int   $tile_id Tile post ID
 * @param array $chapters Array of chapter data
 * @return array|false Complete tile data with adjacent tiles or false if not found
 */
function abu_pg_find_tile_in_chapters( $tile_id, $chapters ) {
	$tile_id = absint( $tile_id );
	if ( ! $tile_id ) {
		return false;
	}
	
	// Find which chapter contains this tile and get adjacent tiles
	$adjacent_data = abu_pg_get_adjacent_items( $tile_id, $chapters, 20 );
	if ( ! $adjacent_data ) {
		return false;
	}
	
	// Get complete tile metadata for the target tile
	$tile_data = abu_pg_get_tile_metadata( $tile_id );
	if ( ! $tile_data ) {
		return false;
	}
	
	// Add chapter context
	$tile_data['chapterSlug'] = $adjacent_data['chapterSlug'];
	$tile_data['chapterName'] = $adjacent_data['chapterName'];
	$tile_data['chapterId']   = $adjacent_data['chapterId'];
	
	// Add adjacent tiles metadata
	$tile_data['adjacentTiles'] = array();
	foreach ( $adjacent_data['adjacentItems'] as $adj_id ) {
		if ( $adj_id === $tile_id ) {
			continue; // Skip the target tile itself
		}
		$adj_tile = abu_pg_get_tile_metadata( $adj_id );
		if ( $adj_tile ) {
			$tile_data['adjacentTiles'][] = $adj_tile;
		}
	}
	
	return $tile_data;
}

/**
 * Get all tiles from a Content Kit
 * 
 * @param int $kit_id Content Kit post ID
 * @return array Array of tile metadata objects
 */
function abu_pg_get_all_tiles_from_kit( $kit_id ) {
	$kit_id = absint( $kit_id );
	if ( ! $kit_id ) {
		return array();
	}
	
	// Load chapters from kit
	$chapters_json = get_post_meta( $kit_id, 'abu_pg_chapters_json', true );
	$chapters = abu_pg_parse_chapters( $chapters_json );
	
	if ( ! $chapters ) {
		return array();
	}
	
	// Collect all tile IDs from all chapters
	$all_tile_ids = array();
	foreach ( $chapters as $chapter ) {
		if ( ! empty( $chapter['tileIds'] ) && is_array( $chapter['tileIds'] ) ) {
			$all_tile_ids = array_merge( $all_tile_ids, $chapter['tileIds'] );
		}
	}
	
	// Remove duplicates and get metadata for each tile
	$all_tile_ids = array_unique( $all_tile_ids );
	$tiles_metadata = array();
	
	foreach ( $all_tile_ids as $tile_id ) {
		$metadata = abu_pg_get_tile_metadata( $tile_id );
		if ( $metadata ) {
			// Add kit parameter to permalink if present
			if ( ! empty( $metadata['permalink'] ) ) {
				$metadata['permalink'] = add_query_arg( 'kit', $kit_id, $metadata['permalink'] );
			}
			$tiles_metadata[] = $metadata;
		}
	}
	
	return $tiles_metadata;
}

/**
 * Get complete metadata for a single tile
 * 
 * @param int $tile_post_id Tile post ID (or legacy: attachment ID).
 * @return array|false Tile metadata or false if not found
 */
function abu_pg_get_tile_metadata( $tile_post_id ) {
	$tile_post_id = absint( $tile_post_id );
	if ( ! $tile_post_id ) {
		return false;
	}
	
	// Check if this is a tile post or legacy attachment
	$tile_post = get_post( $tile_post_id );
	$is_tile_cpt = $tile_post && 'abu_pg_tile' === $tile_post->post_type;
	
	if ( $is_tile_cpt ) {
		$tile_id = abu_pg_get_attachment_id_for_tile( $tile_post_id );
		if ( ! $tile_id ) {
			return false;
		}
	} else {
		// Legacy attachment mode
		$tile_id = $tile_post_id;
	}
	
	$url  = wp_get_attachment_url( $tile_id );
	$mime = get_post_mime_type( $tile_id );
	
	if ( ! $url || ! $mime ) {
		return false;
	}
	
	$is_image = 0 === strpos( $mime, 'image/' );
	$is_video = 0 === strpos( $mime, 'video/' );
	
	if ( ! $is_image && ! $is_video ) {
		return false;
	}
	
	$attachment = get_post( $tile_id );
	$created_at = $attachment ? get_post_time( DATE_ATOM, true, $attachment ) : '';
	$filename   = $url ? wp_basename( $url ) : '';
	$title      = $attachment ? $attachment->post_title : '';
	
	// Get dimensions
	$media_width  = 0;
	$media_height = 0;
	
	$tile_data = array(
		'id'       => $tile_post_id, // Return tile post ID (not attachment ID)
		'attachmentId' => $tile_id,  // Include attachment ID separately
		'type'     => $is_video ? 'video' : 'image',
		'url'      => $url,
		'created'  => $created_at,
		'filename' => $filename,
		'title'    => $title,
	);
	
	if ( $is_tile_cpt ) {
		$tile_data['permalink'] = get_permalink( $tile_post_id );
	}
	
	if ( $is_video ) {
		// Get video-specific data
		$poster_id    = absint( get_post_meta( $tile_id, '_abu_video_poster_id', true ) );
		$video_720_id = absint( get_post_meta( $tile_id, '_abu_video_720_id', true ) );
		$video_360_id = absint( get_post_meta( $tile_id, '_abu_video_360_id', true ) );
		
		$media_width  = absint( get_post_meta( $tile_id, '_abu_video_width', true ) );
		$media_height = absint( get_post_meta( $tile_id, '_abu_video_height', true ) );
		
		$poster_url = $poster_id ? wp_get_attachment_url( $poster_id ) : '';
		$url_720    = $video_720_id ? wp_get_attachment_url( $video_720_id ) : '';
		$url_360    = $video_360_id ? wp_get_attachment_url( $video_360_id ) : '';
		
		// Fallback to metadata if IDs not available
		if ( ! $poster_url ) {
			$poster_url = get_post_meta( $tile_id, '_abu_video_poster_url', true );
		}
		if ( ! $url_720 ) {
			$url_720 = get_post_meta( $tile_id, '_abu_video_720p_url', true );
		}
		if ( ! $url_360 ) {
			$url_360 = get_post_meta( $tile_id, '_abu_video_360p_url', true );
		}
		
		// Check derivatives meta
		$derivatives_meta = get_post_meta( $tile_id, '_abu_video_derivatives', true );
		if ( $derivatives_meta && is_string( $derivatives_meta ) ) {
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
		
		// Check file system fallback
		if ( ! $poster_url || ! $url_720 || ! $url_360 ) {
			$upload_dir = wp_upload_dir();
			$base_dir   = trailingslashit( $upload_dir['basedir'] ) . 'abu-video/' . $tile_id . '/';
			$base_url   = trailingslashit( $upload_dir['baseurl'] ) . 'abu-video/' . $tile_id . '/';
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
		
		$tile_data['poster']      = $poster_url;
		$tile_data['src720']      = $url_720;
		$tile_data['src360']      = $url_360;
		$tile_data['srcOriginal'] = abu_pg_get_original_image_url( $tile_id );
		$tile_data['width']       = $media_width;
		$tile_data['height']      = $media_height;
	} else {
		// Get image variants
		$image_variants = abu_pg_get_image_variants( $tile_id );
		
		// Get dimensions from the abu_grid size being rendered
		$image_src = wp_get_attachment_image_src( $tile_id, 'abu_grid' );
		if ( $image_src && ! empty( $image_src[1] ) && ! empty( $image_src[2] ) ) {
			$media_width  = absint( $image_src[1] );
			$media_height = absint( $image_src[2] );
		} else {
			// Fallback to metadata
			$meta = wp_get_attachment_metadata( $tile_id );
			if ( is_array( $meta ) && ! empty( $meta['width'] ) && ! empty( $meta['height'] ) ) {
				$media_width  = absint( $meta['width'] );
				$media_height = absint( $meta['height'] );
			}
		}
		
		// FIX: Add previewSrc using same source as masonry grid
		// This ensures spotlight preview quality matches masonry tiles
		$tile_data['previewSrc']  = $image_variants['grid_url'];
		$tile_data['gridUrl']     = $image_variants['grid_url'];
		$tile_data['webUrl']      = $image_variants['web_url'];
		$tile_data['originalUrl'] = $image_variants['original_url'];
		$tile_data['gridSrcset']  = $image_variants['grid_srcset'];
		$tile_data['gridSizes']   = $image_variants['grid_sizes'];
		$tile_data['width']       = $media_width;
		$tile_data['height']      = $media_height;
	}
	
	return $tile_data;
}

/**
 * Get adjacent items for right column context
 * 
 * @param string $item_id Tile post ID
 * @param array  $chapters Array of chapter data
 * @param int    $count How many adjacent items to return
 * @return array|false Adjacent items data, or false if not found
 */
function abu_pg_get_adjacent_items( $item_id, $chapters, $count = 20 ) {
	// Convert to integer for strict comparison with tileIds
	$item_id = absint( $item_id );
	
	foreach ( $chapters as $chapter ) {
		if ( empty( $chapter['tileIds'] ) ) {
			continue;
		}
		
		$position = array_search( $item_id, $chapter['tileIds'], true );
		
		if ( false !== $position ) {
			// Found the item, get adjacent items
			$half_count = floor( $count / 2 );
			$start      = max( 0, $position - $half_count );
			$items      = array_slice( $chapter['tileIds'], $start, $count );
			
			return array(
				'targetItemId'  => $item_id,
				'adjacentItems' => $items,
				'chapterSlug'   => $chapter['slug'],
				'chapterName'   => $chapter['name'],
				'chapterId'     => $chapter['id'],
				'allItems'      => $chapter['tileIds'], // For complete context
			);
		}
	}
	return false;
}

/**
 * Render full gallery (normal mode or background for direct mode)
 * 
 * @param int   $post_id Post ID
 * @param array $chapters Array of chapter data
 * @param bool  $debug_enabled Whether debug mode is enabled
 * @return string HTML output
 */
function abu_pg_render_full_gallery( $post_id, $chapters, $debug_enabled ) {
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
					<?php
					if ( ! empty( $chapter['tileIds'] ) ) {
						foreach ( $chapter['tileIds'] as $id ) {
							echo abu_pg_render_tile( $id, $debug_enabled, $post_id );
						}
					}
					?>
				</div>
				</section>
			<?php endforeach; ?>
		</div>
	</div>
	<?php
	return ob_get_clean();
}

function abu_pg_shortcode( $atts = array() ) {
	// Parse shortcode attributes
	$atts = shortcode_atts(
		array(
			'kit_id' => 0, // Optional: specific Content Kit ID to render
		),
		$atts,
		'abu_pinterest_gallery'
	);
	
	// Determine which post ID to use for gallery data
	$post_id = absint( $atts['kit_id'] );
	
	// If no kit_id provided, use current post
	if ( ! $post_id ) {
		if ( ! is_singular() ) {
			return '';
		}
		$post_id = get_the_ID();
	}
	
	if ( ! $post_id ) {
		return '';
	}

	// Read chapter JSON data from the specified post
	$chapters_json = get_post_meta( $post_id, 'abu_pg_chapters_json', true );
	
	$chapters = abu_pg_parse_chapters( $chapters_json );
	
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
	
	// Localize script with permission data and AJAX endpoints
	wp_localize_script(
		'abu-pg-gallery',
		'abuPgConfig',
		array(
			'ajaxUrl'      => admin_url( 'admin-ajax.php' ),
			'nonce'        => wp_create_nonce( 'abu_pg_ajax' ),
			'isLoggedIn'   => is_user_logged_in(),
			'canDownload'  => is_user_logged_in(),
			'canShare'     => is_user_logged_in(),
			'canLike'      => is_user_logged_in(),
			'canComment'   => is_user_logged_in(),
			'loginUrl'     => wp_login_url( get_permalink() ),
		)
	);
	
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
	
	// Render gallery
	// CLEAN BREAK: No legacy deep-link query param handling (?abu_pg_tile= or ?item=)
	// Deep linking now handled by visiting canonical tile permalinks (/tile/slug/)
	$gallery_html = abu_pg_render_full_gallery( $post_id, $chapters, $debug_enabled );

	return $gallery_html;
}
add_shortcode( 'abu_pinterest_gallery', 'abu_pg_shortcode' );

/**
 * ========================================
 * TILE PERMALINK TEMPLATE
 * ========================================
 * 
 * Custom template for abu_pg_tile posts that renders spotlight-first view.
 */

/**
 * Intercept template loading for tile posts and content kits.
 * 
 * @param string $template The path of the template to include.
 * @return string Modified template path.
 */
function abu_pg_tile_template_include( $template ) {
	// Handle tile posts
	if ( is_singular( 'abu_pg_tile' ) ) {
		// Tiles are publicly viewable - no permission check needed
		// Feature permissions (download/like/comment) are handled in the template
		
		// Use our custom template
		$plugin_template = ABU_PG_PATH . 'templates/single-tile.php';
		if ( file_exists( $plugin_template ) ) {
			return $plugin_template;
		}
	}
	
	// Handle Content Kit posts
	if ( is_singular( 'abu_content_kit' ) ) {
		$plugin_template = ABU_PG_PATH . 'templates/single-abu_content_kit.php';
		if ( file_exists( $plugin_template ) ) {
			return $plugin_template;
		}
	}
	
	// Handle Organization taxonomy archive
	if ( is_tax( 'abu_organization' ) ) {
		$plugin_template = ABU_PG_PATH . 'templates/taxonomy-abu_organization.php';
		if ( file_exists( $plugin_template ) ) {
			return $plugin_template;
		}
	}
	
	return $template;
}
add_filter( 'template_include', 'abu_pg_tile_template_include' );

/**
 * ========================================
 * COMMENTS SUPPORT
 * ========================================
 */

/**
 * Enforce comment permissions server-side for tile posts.
 * 
 * SECURITY: Blocks unauthorized comment submissions at the server level.
 * UI-only gating is not sufficient - this prevents direct POST to wp-comments-post.php.
 * 
 * @param array $commentdata Comment data being processed.
 * @return array Comment data (if authorized) or wp_die on failure.
 */
function abu_pg_enforce_tile_comment_permissions( $commentdata ) {
	$comment_post_id = isset( $commentdata['comment_post_ID'] ) ? absint( $commentdata['comment_post_ID'] ) : 0;
	
	if ( ! $comment_post_id ) {
		return $commentdata;
	}
	
	// Check if this is a tile post
	$post = get_post( $comment_post_id );
	if ( ! $post || 'abu_pg_tile' !== $post->post_type ) {
		// Not a tile post, allow normal WordPress comment handling
		return $commentdata;
	}
	
	// This is a tile post - enforce our permissions
	$user_id = get_current_user_id();
	
	if ( ! abu_pg_user_can_comment_on_tile( $user_id, $comment_post_id ) ) {
		// User not authorized to comment on this tile
		wp_die(
			__( 'You do not have permission to post comments on this content.', 'abu-pg' ),
			__( 'Comment Submission Denied', 'abu-pg' ),
			array(
				'response'  => 403,
				'back_link' => true,
			)
		);
	}
	
	// Authorized, allow comment
	return $commentdata;
}
add_filter( 'preprocess_comment', 'abu_pg_enforce_tile_comment_permissions', 10, 1 );

/**
 * AJAX handler to load comments for a tile.
 * 
 * Returns HTML for comments list and comment form.
 * Permission-gated: only returns content if user can comment on the tile.
 */
function abu_pg_ajax_load_tile_comments() {
	$tile_id = isset( $_GET['tile_id'] ) ? absint( $_GET['tile_id'] ) : 0;
	
	if ( ! $tile_id ) {
		wp_send_json_error( array( 'message' => 'Invalid tile ID' ), 400 );
	}
	
	// Check permissions
	if ( ! abu_pg_user_can_view_tile( 0, $tile_id ) ) {
		wp_send_json_error( array( 'message' => 'Permission denied' ), 403 );
	}
	
	$can_comment = abu_pg_user_can_comment_on_tile( 0, $tile_id );
	
	// Get comments
	$comments = get_comments(
		array(
			'post_id' => $tile_id,
			'status'  => 'approve',
			'order'   => 'ASC',
		)
	);
	
	ob_start();
	
	if ( $can_comment ) {
		?>
		<div class="abu-pg-comments-wrapper">
			<h3 class="abu-pg-comments-title"><?php _e( 'Comments', 'abu-pg' ); ?></h3>
			
			<?php if ( ! empty( $comments ) ) : ?>
				<div class="abu-pg-comments-list">
					<?php
					wp_list_comments(
						array(
							'style'       => 'div',
							'short_ping'  => true,
							'avatar_size' => 32,
						),
						$comments
					);
					?>
				</div>
			<?php endif; ?>
			
			<?php if ( comments_open( $tile_id ) ) : ?>
				<div class="abu-pg-comment-form-wrapper">
					<?php
					// Set global post for comment form
					global $post;
					$original_post = $post;
					$post = get_post( $tile_id );
					setup_postdata( $post );
					
					comment_form(
						array(
							'title_reply'         => __( 'Leave a Comment', 'abu-pg' ),
							'logged_in_as'        => null,
							'comment_notes_after' => '',
							'class_submit'        => 'submit abu-pg-submit-comment',
							'label_submit'        => __( 'Post Comment', 'abu-pg' ),
							'comment_field'       => '<textarea id="comment" name="comment" cols="45" rows="4" maxlength="65525" required="required" placeholder="' . esc_attr__( 'Your comment...', 'abu-pg' ) . '"></textarea>',
						)
					);
					
					wp_reset_postdata();
					$post = $original_post;
					?>
				</div>
			<?php endif; ?>
		</div>
		<?php
	} else {
		?>
		<div class="abu-pg-comments-wrapper">
			<?php if ( ! is_user_logged_in() ) : ?>
				<p><?php _e( 'Please log in to view and post comments.', 'abu-pg' ); ?></p>
				<p><a href="<?php echo esc_url( wp_login_url( get_permalink( $tile_id ) ) ); ?>"><?php _e( 'Log In', 'abu-pg' ); ?></a></p>
			<?php else : ?>
				<p><?php _e( 'Comments are not available for this content.', 'abu-pg' ); ?></p>
			<?php endif; ?>
		</div>
		<?php
	}
	
	$html = ob_get_clean();
	
	wp_send_json_success(
		array(
			'html'       => $html,
			'canComment' => $can_comment,
			'count'      => count( $comments ),
		)
	);
}
add_action( 'wp_ajax_abu_pg_load_tile_comments', 'abu_pg_ajax_load_tile_comments' );
add_action( 'wp_ajax_nopriv_abu_pg_load_tile_comments', 'abu_pg_ajax_load_tile_comments' );

/**
 * Filter comment post redirect to return JSON for AJAX submissions.
 */
function abu_pg_comment_post_redirect( $location, $comment ) {
	if ( isset( $_SERVER['HTTP_X_REQUESTED_WITH'] ) && 'XMLHttpRequest' === $_SERVER['HTTP_X_REQUESTED_WITH'] ) {
		// AJAX request, return JSON instead of redirect
		wp_send_json_success(
			array(
				'message'    => __( 'Comment posted successfully!', 'abu-pg' ),
				'comment_id' => $comment->comment_ID,
			)
		);
		exit;
	}
	
	return $location;
}
add_filter( 'comment_post_redirect', 'abu_pg_comment_post_redirect', 10, 2 ); 