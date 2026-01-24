<?php

defined( 'ABSPATH' ) || exit;

function vba_ensure_media_includes() {
	if ( ! function_exists( 'wp_generate_attachment_metadata' ) ) {
		require_once ABSPATH . 'wp-admin/includes/image.php';
	}
	if ( ! function_exists( 'wp_read_video_metadata' ) ) {
		require_once ABSPATH . 'wp-admin/includes/media.php';
	}
}

function vba_relative_upload_path( $file_path ) {
	$upload_dir = wp_upload_dir();
	if ( ! empty( $upload_dir['basedir'] ) && 0 === strpos( $file_path, $upload_dir['basedir'] ) ) {
		$relative = ltrim( substr( $file_path, strlen( $upload_dir['basedir'] ) ), '/' );
		return $relative;
	}
	return '';
}

function vba_find_derivative_attachment( $parent_id, $quality ) {
	$parent_id = absint( $parent_id );
	if ( ! $parent_id || ! $quality ) {
		return 0;
	}

	$existing = get_posts(
		array(
			'post_type'      => 'attachment',
			'post_status'    => 'inherit',
			'posts_per_page' => 1,
			'fields'         => 'ids',
			'post_parent'    => $parent_id,
			'meta_key'       => '_abu_video_quality',
			'meta_value'     => $quality,
		)
	);

	return ! empty( $existing ) ? absint( $existing[0] ) : 0;
}

function vba_find_attachment_by_path( $file_path ) {
	$relative = vba_relative_upload_path( $file_path );
	if ( ! $relative ) {
		return 0;
	}

	$existing = get_posts(
		array(
			'post_type'      => 'attachment',
			'post_status'    => 'inherit',
			'posts_per_page' => 1,
			'fields'         => 'ids',
			'meta_key'       => '_wp_attached_file',
			'meta_value'     => $relative,
		)
	);

	return ! empty( $existing ) ? absint( $existing[0] ) : 0;
}

function vba_register_derivative_attachment( $parent_id, $file_path, $url, $quality, $title = '' ) {
	$parent_id = absint( $parent_id );
	if ( ! $parent_id || ! $file_path || ! file_exists( $file_path ) ) {
		return 0;
	}

	$file_name = wp_basename( $file_path );
	$file_info = wp_check_filetype_and_ext( $file_path, $file_name );
	$mime_type = isset( $file_info['type'] ) && $file_info['type'] ? $file_info['type'] : '';
	if ( ! $mime_type && preg_match( '/\.mp4$/i', $file_name ) ) {
		$mime_type = 'video/mp4';
	}
	if ( ! $url ) {
		$relative = vba_relative_upload_path( $file_path );
		if ( $relative ) {
			$upload_dir = wp_upload_dir();
			$url = trailingslashit( $upload_dir['baseurl'] ) . ltrim( $relative, '/' );
		}
	}

	$relative = vba_relative_upload_path( $file_path );
	if ( ! $relative ) {
		error_log( '[video-behavior-by-abu] derivative file outside uploads: ' . $file_path );
		return 0;
	}

	$existing_id = vba_find_derivative_attachment( $parent_id, $quality );
	if ( ! $existing_id ) {
		$existing_id = vba_find_attachment_by_path( $file_path );
	}
	if ( $existing_id ) {
		update_post_meta( $existing_id, '_abu_video_quality', $quality );
		wp_update_post(
			array(
				'ID'          => $existing_id,
				'post_parent' => $parent_id,
			)
		);
		if ( $title ) {
			wp_update_post(
				array(
					'ID'         => $existing_id,
					'post_title' => $title,
				)
			);
		}
		update_attached_file( $existing_id, $file_path );
		if ( $url ) {
			wp_update_post(
				array(
					'ID'   => $existing_id,
					'guid' => esc_url_raw( $url ),
				)
			);
		}
		vba_ensure_media_includes();
		$metadata = wp_generate_attachment_metadata( $existing_id, $file_path );
		if ( $metadata ) {
			wp_update_attachment_metadata( $existing_id, $metadata );
		}
		return $existing_id;
	}

	$attachment = array(
		'post_mime_type' => $mime_type,
		'post_title'     => $title ? $title : wp_basename( $file_path ),
		'post_status'    => 'inherit',
		'post_parent'    => $parent_id,
		'guid'           => $url ? esc_url_raw( $url ) : '',
	);

	$attach_id = wp_insert_attachment( $attachment, $file_path, $parent_id );
	if ( ! $attach_id || is_wp_error( $attach_id ) ) {
		$error_message = is_wp_error( $attach_id ) ? $attach_id->get_error_message() : 'unknown error';
		error_log( '[video-behavior-by-abu] failed to register derivative attachment for ' . $file_path );
		error_log( '[video-behavior-by-abu] attachment insert error: ' . $error_message );
		return 0;
	}

	update_post_meta( $attach_id, '_abu_video_quality', $quality );
	update_post_meta( $attach_id, '_wp_attached_file', $relative );

	vba_ensure_media_includes();
	$metadata = wp_generate_attachment_metadata( $attach_id, $file_path );
	if ( $metadata ) {
		wp_update_attachment_metadata( $attach_id, $metadata );
	}

	return $attach_id;
}
