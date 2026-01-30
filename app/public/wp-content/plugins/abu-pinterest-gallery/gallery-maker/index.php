<?php
/**
 * ABU Gallery Maker Block Registration
 * 
 * Registers the Gutenberg block and post meta for chapter-based gallery organization.
 * 
 * @package ABU_Pinterest_Gallery
 */

defined( 'ABSPATH' ) || exit;

/**
 * Register the post meta key for chapter data.
 * 
 * This meta key stores JSON-encoded chapter data including chapter names,
 * order, and media attachment IDs.
 */
function abu_gallery_maker_register_meta() {
	$post_types = array( 'post', 'page' );
	
	foreach ( $post_types as $post_type ) {
		register_post_meta(
			$post_type,
			'abu_pg_chapters_json',
			array(
				'type'              => 'string',
				'description'       => 'Gallery chapter data (JSON)',
				'single'            => true,
				'show_in_rest'      => true,
				'default'           => '[]',
				'sanitize_callback' => 'abu_gallery_maker_sanitize_chapters_json',
				'auth_callback'     => function() {
					return current_user_can( 'edit_posts' ) || current_user_can( 'edit_pages' );
				},
			)
		);
	}
}
add_action( 'init', 'abu_gallery_maker_register_meta' );

/**
 * Sanitize and validate chapter JSON data.
 * 
 * @param string $meta_value The raw meta value.
 * @return string Sanitized JSON string.
 */
function abu_gallery_maker_sanitize_chapters_json( $meta_value ) {
	if ( empty( $meta_value ) ) {
		return '[]';
	}
	
	// Decode JSON
	$chapters = json_decode( $meta_value, true );
	
	// If invalid JSON, return empty array
	if ( ! is_array( $chapters ) ) {
		return '[]';
	}
	
	// Sanitize each chapter
	$sanitized = array();
	foreach ( $chapters as $chapter ) {
		if ( ! is_array( $chapter ) ) {
			continue;
		}
		
		$sanitized_chapter = array(
			'id'       => isset( $chapter['id'] ) ? sanitize_text_field( $chapter['id'] ) : '',
			'name'     => isset( $chapter['name'] ) ? sanitize_text_field( $chapter['name'] ) : '',
			'order'    => isset( $chapter['order'] ) ? absint( $chapter['order'] ) : 0,
			'mediaIds' => array(),
		);
		
		// Sanitize media IDs (must be positive integers)
		if ( isset( $chapter['mediaIds'] ) && is_array( $chapter['mediaIds'] ) ) {
			foreach ( $chapter['mediaIds'] as $id ) {
				$id = absint( $id );
				if ( $id > 0 ) {
					$sanitized_chapter['mediaIds'][] = $id;
				}
			}
		}
		
		// Only include chapters with valid IDs
		if ( ! empty( $sanitized_chapter['id'] ) ) {
			$sanitized[] = $sanitized_chapter;
		}
	}
	
	return wp_json_encode( $sanitized );
}

/**
 * Register the Gutenberg block.
 */
function abu_gallery_maker_register_block() {
	register_block_type( __DIR__ );
}
add_action( 'init', 'abu_gallery_maker_register_block' );
