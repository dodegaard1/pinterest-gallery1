<?php

defined( 'ABSPATH' ) || exit;

add_action( 'add_meta_boxes_attachment', 'vba_add_attachment_meta_box' );
add_action( 'admin_post_vba_regenerate_derivatives', 'vba_handle_regenerate_derivatives' );
add_action( 'admin_post_vba_sync_derivatives', 'vba_handle_sync_derivatives' );

function vba_add_attachment_meta_box() {
	add_meta_box(
		'vba-video-derivatives',
		'ABU Video Derivatives',
		'vba_render_attachment_meta_box',
		'attachment',
		'side',
		'default'
	);
}

function vba_render_attachment_meta_box( $post ) {
	$mime = get_post_mime_type( $post );
	if ( 'video/mp4' !== $mime ) {
		echo '<p>This panel is available for MP4 videos only.</p>';
		return;
	}

	$status = get_post_meta( $post->ID, '_abu_video_status', true );
	$poster_id = absint( get_post_meta( $post->ID, '_abu_video_poster_id', true ) );
	$video_720_id = absint( get_post_meta( $post->ID, '_abu_video_720_id', true ) );
	$video_360_id = absint( get_post_meta( $post->ID, '_abu_video_360_id', true ) );
	$poster_url = $poster_id ? wp_get_attachment_url( $poster_id ) : '';
	$video_720_url = $video_720_id ? wp_get_attachment_url( $video_720_id ) : '';
	$video_360_url = $video_360_id ? wp_get_attachment_url( $video_360_id ) : '';
	$last_error = get_post_meta( $post->ID, '_abu_video_last_error', true );
	$upload_dir = wp_upload_dir();
	$folder_path = trailingslashit( $upload_dir['basedir'] ) . 'abu-video/' . $post->ID . '/';
	?>
	<table class="widefat striped">
		<tbody>
			<tr>
				<td><strong>Status</strong></td>
				<td><?php echo esc_html( $status ? $status : 'new' ); ?></td>
			</tr>
			<tr>
				<td><strong>Poster URL</strong></td>
				<td>
					<?php if ( $poster_url ) : ?>
						<a href="<?php echo esc_url( $poster_url ); ?>" target="_blank" rel="noopener">View</a>
					<?php else : ?>
						—
					<?php endif; ?>
				</td>
			</tr>
			<tr>
				<td><strong>720p URL</strong></td>
				<td>
					<?php if ( $video_720_url ) : ?>
						<a href="<?php echo esc_url( $video_720_url ); ?>" target="_blank" rel="noopener">View</a>
					<?php else : ?>
						—
					<?php endif; ?>
				</td>
			</tr>
			<tr>
				<td><strong>360p URL</strong></td>
				<td>
					<?php if ( $video_360_url ) : ?>
						<a href="<?php echo esc_url( $video_360_url ); ?>" target="_blank" rel="noopener">View</a>
					<?php else : ?>
						—
					<?php endif; ?>
				</td>
			</tr>
		</tbody>
	</table>

	<p style="margin-top:10px;">
		<label for="vba-derivative-path"><strong>Derivatives Folder</strong></label>
		<input type="text" id="vba-derivative-path" class="widefat" readonly value="<?php echo esc_attr( $folder_path ); ?>">
	</p>

	<?php if ( ! empty( $last_error ) ) : ?>
		<p><strong>Last Error</strong></p>
		<p style="color:#b32d2e;"><?php echo esc_html( $last_error ); ?></p>
	<?php endif; ?>

	<?php
		$regen_url = admin_url(
			'admin-post.php?action=vba_regenerate_derivatives&attachment_id=' . $post->ID . '&redirect_to=' . rawurlencode( get_edit_post_link( $post->ID, 'url' ) )
		);
		$regen_url = wp_nonce_url( $regen_url, 'vba_regenerate_derivatives', 'vba_regenerate_nonce' );

		$sync_url = admin_url(
			'admin-post.php?action=vba_sync_derivatives&attachment_id=' . $post->ID . '&redirect_to=' . rawurlencode( get_edit_post_link( $post->ID, 'url' ) )
		);
		$sync_url = wp_nonce_url( $sync_url, 'vba_sync_derivatives', 'vba_sync_nonce' );
	?>
	<p>
		<a class="button button-secondary" href="<?php echo esc_url( $regen_url ); ?>">Regenerate</a>
		<a class="button button-secondary" href="<?php echo esc_url( $sync_url ); ?>">Sync From Disk</a>
	</p>
	<?php
}

function vba_handle_regenerate_derivatives() {
	if ( ! current_user_can( 'edit_posts' ) ) {
		wp_die( 'Insufficient permissions.' );
	}

	$nonce = isset( $_REQUEST['vba_regenerate_nonce'] ) ? sanitize_text_field( wp_unslash( $_REQUEST['vba_regenerate_nonce'] ) ) : '';
	if ( ! $nonce || ! wp_verify_nonce( $nonce, 'vba_regenerate_derivatives' ) ) {
		wp_die( 'Invalid request.' );
	}

	$attachment_id = isset( $_REQUEST['attachment_id'] ) ? absint( $_REQUEST['attachment_id'] ) : 0;
	if ( ! $attachment_id ) {
		wp_die( 'Invalid attachment.' );
	}

	$mime = get_post_mime_type( $attachment_id );
	if ( 'video/mp4' !== $mime ) {
		wp_die( 'Attachment is not an MP4.' );
	}

	error_log( '[video-behavior-by-abu] regenerate requested for attachment ' . $attachment_id );
	vba_enqueue_attachment( $attachment_id );

	$redirect = isset( $_REQUEST['redirect_to'] ) ? esc_url_raw( wp_unslash( $_REQUEST['redirect_to'] ) ) : '';
	if ( ! $redirect ) {
		$redirect = admin_url( 'post.php?post=' . $attachment_id . '&action=edit' );
	}
	wp_safe_redirect( $redirect );
	exit;
}

function vba_handle_sync_derivatives() {
	if ( ! current_user_can( 'edit_posts' ) ) {
		wp_die( 'Insufficient permissions.' );
	}

	$nonce = isset( $_REQUEST['vba_sync_nonce'] ) ? sanitize_text_field( wp_unslash( $_REQUEST['vba_sync_nonce'] ) ) : '';
	if ( ! $nonce || ! wp_verify_nonce( $nonce, 'vba_sync_derivatives' ) ) {
		wp_die( 'Invalid request.' );
	}

	$attachment_id = isset( $_REQUEST['attachment_id'] ) ? absint( $_REQUEST['attachment_id'] ) : 0;
	if ( ! $attachment_id ) {
		wp_die( 'Invalid attachment.' );
	}

	$mime = get_post_mime_type( $attachment_id );
	if ( 'video/mp4' !== $mime ) {
		wp_die( 'Attachment is not an MP4.' );
	}

	$upload_dir = wp_upload_dir();
	$base_dir = trailingslashit( $upload_dir['basedir'] ) . 'abu-video/' . $attachment_id . '/';
	$base_url = trailingslashit( $upload_dir['baseurl'] ) . 'abu-video/' . $attachment_id . '/';

	$poster_path = $base_dir . 'poster.jpg';
	$video_720_path = $base_dir . 'video-720p.mp4';
	$video_360_path = $base_dir . 'video-360p.mp4';

	$found_any = false;
	$parent = get_post( $attachment_id );
	$base_title = $parent && $parent->post_title ? $parent->post_title : 'Video';

	if ( file_exists( $poster_path ) ) {
		$poster_id = vba_register_derivative_attachment(
			$attachment_id,
			$poster_path,
			$base_url . 'poster.jpg',
			'poster',
			$base_title . ' (poster)'
		);
		if ( $poster_id ) {
			update_post_meta( $attachment_id, '_abu_video_poster_id', $poster_id );
		}
		$found_any = true;
	}

	if ( file_exists( $video_720_path ) ) {
		$video_720_id = vba_register_derivative_attachment(
			$attachment_id,
			$video_720_path,
			$base_url . 'video-720p.mp4',
			'720',
			$base_title . ' (720p)'
		);
		if ( $video_720_id ) {
			update_post_meta( $attachment_id, '_abu_video_720_id', $video_720_id );
		}
		$found_any = true;
	}

	if ( file_exists( $video_360_path ) ) {
		$video_360_id = vba_register_derivative_attachment(
			$attachment_id,
			$video_360_path,
			$base_url . 'video-360p.mp4',
			'360',
			$base_title . ' (360p)'
		);
		if ( $video_360_id ) {
			update_post_meta( $attachment_id, '_abu_video_360_id', $video_360_id );
		}
		$found_any = true;
	}

	if ( $found_any ) {
		update_post_meta( $attachment_id, '_abu_video_status', 'ready' );
		update_post_meta( $attachment_id, '_abu_video_finished_at', current_time( 'mysql' ) );
		update_post_meta( $attachment_id, '_abu_video_last_error', '' );
	}

	$redirect = isset( $_REQUEST['redirect_to'] ) ? esc_url_raw( wp_unslash( $_REQUEST['redirect_to'] ) ) : '';
	if ( ! $redirect ) {
		$redirect = admin_url( 'post.php?post=' . $attachment_id . '&action=edit' );
	}
	wp_safe_redirect( $redirect );
	exit;
}