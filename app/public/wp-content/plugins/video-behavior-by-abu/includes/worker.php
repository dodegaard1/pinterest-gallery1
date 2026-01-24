<?php

defined( 'ABSPATH' ) || exit;

add_action( 'vba_process_video_queue', 'vba_process_video_queue' );

function vba_process_video_queue() {
	$batch = vba_dequeue_batch( 2 );
	if ( empty( $batch ) ) {
		return;
	}

	foreach ( $batch as $attachment_id ) {
		vba_process_attachment( $attachment_id );
	}

	if ( vba_queue_size() > 0 && ! wp_next_scheduled( 'vba_process_video_queue' ) ) {
		wp_schedule_single_event( time() + 30, 'vba_process_video_queue' );
	}
}

function vba_process_attachment( $attachment_id ) {
	$attachment_id = absint( $attachment_id );
	if ( ! $attachment_id ) {
		return;
	}

	$lock_key = 'vba_processing_lock_' . $attachment_id;
	if ( get_transient( $lock_key ) ) {
		return;
	}
	set_transient( $lock_key, 1, MINUTE_IN_SECONDS * 10 );

	update_post_meta( $attachment_id, '_abu_video_status', 'processing' );
	update_post_meta( $attachment_id, '_abu_video_started_at', current_time( 'mysql' ) );

	$file_path = get_attached_file( $attachment_id );
	if ( ! $file_path || ! file_exists( $file_path ) ) {
		vba_fail_attachment( $attachment_id, 'File missing for attachment.' );
		delete_transient( $lock_key );
		return;
	}

	error_log( '[video-behavior-by-abu] processing attachment ' . $attachment_id );

	$status = vba_get_ffmpeg_status();
	if ( ! $status['ok'] ) {
		vba_fail_attachment( $attachment_id, $status['message'] );
		delete_transient( $lock_key );
		return;
	}

	$upload_dir = wp_upload_dir();
	$base_dir = trailingslashit( $upload_dir['basedir'] ) . 'abu-video/' . $attachment_id . '/';
	$base_url = trailingslashit( $upload_dir['baseurl'] ) . 'abu-video/' . $attachment_id . '/';
	wp_mkdir_p( $base_dir );

	$poster_path = $base_dir . 'poster.jpg';
	$poster_url  = $base_url . 'poster.jpg';
	$video_720_path = $base_dir . 'video-720p.mp4';
	$video_360_path = $base_dir . 'video-360p.mp4';
	$video_720_url  = $base_url . 'video-720p.mp4';
	$video_360_url  = $base_url . 'video-360p.mp4';

	$ffmpeg = vba_get_ffmpeg_path();
	$dimensions = vba_get_video_dimensions( $file_path );
	if ( $dimensions['width'] && $dimensions['height'] ) {
		update_post_meta( $attachment_id, '_abu_video_width', absint( $dimensions['width'] ) );
		update_post_meta( $attachment_id, '_abu_video_height', absint( $dimensions['height'] ) );
	}

	$poster_cmd = sprintf(
		'%s -y -i %s -frames:v 1 -q:v 2 %s',
		escapeshellcmd( $ffmpeg ),
		escapeshellarg( $file_path ),
		escapeshellarg( $poster_path )
	);

	$mp4_720_cmd = sprintf(
		'%s -y -i %s -vf %s -c:v libx264 -profile:v main -preset veryfast -b:v 5M -maxrate 5M -bufsize 10M -c:a aac -b:a 128k -movflags +faststart %s',
		escapeshellcmd( $ffmpeg ),
		escapeshellarg( $file_path ),
		escapeshellarg( 'scale=-2:720' ),
		escapeshellarg( $video_720_path )
	);

	$mp4_360_cmd = sprintf(
		'%s -y -i %s -vf %s -c:v libx264 -profile:v main -preset veryfast -b:v 900k -maxrate 1200k -bufsize 2400k -c:a aac -b:a 96k -movflags +faststart %s',
		escapeshellcmd( $ffmpeg ),
		escapeshellarg( $file_path ),
		escapeshellarg( 'scale=-2:360' ),
		escapeshellarg( $video_360_path )
	);

	$poster_result = vba_run_command( $poster_cmd );
	if ( ! $poster_result['ok'] ) {
		vba_fail_attachment( $attachment_id, $poster_result['message'] );
		delete_transient( $lock_key );
		return;
	}

	$video_720_result = vba_run_command( $mp4_720_cmd );
	if ( ! $video_720_result['ok'] ) {
		vba_fail_attachment( $attachment_id, $video_720_result['message'] );
		delete_transient( $lock_key );
		return;
	}

	$video_360_result = vba_run_command( $mp4_360_cmd );
	if ( ! $video_360_result['ok'] ) {
		vba_fail_attachment( $attachment_id, $video_360_result['message'] );
		delete_transient( $lock_key );
		return;
	}

	$parent = get_post( $attachment_id );
	$base_title = $parent && $parent->post_title ? $parent->post_title : 'Video';

	$poster_id = vba_register_derivative_attachment(
		$attachment_id,
		$poster_path,
		$poster_url,
		'poster',
		$base_title . ' (poster)'
	);
	$video_720_id = vba_register_derivative_attachment(
		$attachment_id,
		$video_720_path,
		$video_720_url,
		'720',
		$base_title . ' (720p)'
	);
	$video_360_id = vba_register_derivative_attachment(
		$attachment_id,
		$video_360_path,
		$video_360_url,
		'360',
		$base_title . ' (360p)'
	);

	if ( $poster_id ) {
		update_post_meta( $attachment_id, '_abu_video_poster_id', $poster_id );
	}
	if ( $video_720_id ) {
		update_post_meta( $attachment_id, '_abu_video_720_id', $video_720_id );
	}
	if ( $video_360_id ) {
		update_post_meta( $attachment_id, '_abu_video_360_id', $video_360_id );
	}

	update_post_meta( $attachment_id, '_abu_video_status', 'ready' );
	update_post_meta( $attachment_id, '_abu_video_finished_at', current_time( 'mysql' ) );
	update_post_meta( $attachment_id, '_abu_video_last_error', '' );

	error_log( '[video-behavior-by-abu] completed attachment ' . $attachment_id );

	delete_transient( $lock_key );
}

function vba_fail_attachment( $attachment_id, $message ) {
	update_post_meta( $attachment_id, '_abu_video_status', 'failed' );
	update_post_meta( $attachment_id, '_abu_video_finished_at', current_time( 'mysql' ) );
	update_post_meta( $attachment_id, '_abu_video_last_error', $message );
	error_log( '[video-behavior-by-abu] failed attachment ' . $attachment_id . ': ' . $message );
}

function vba_get_ffprobe_path() {
	$ffmpeg = vba_get_ffmpeg_path();
	if ( false !== strpos( $ffmpeg, '/' ) ) {
		$candidate = trailingslashit( dirname( $ffmpeg ) ) . 'ffprobe';
		if ( file_exists( $candidate ) ) {
			return $candidate;
		}
	}
	return 'ffprobe';
}

function vba_get_video_dimensions( $file_path ) {
	$ffprobe = vba_get_ffprobe_path();
	$cmd = sprintf(
		'%s -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x %s',
		escapeshellcmd( $ffprobe ),
		escapeshellarg( $file_path )
	);
	$result = vba_run_command( $cmd );
	if ( ! $result['ok'] || empty( $result['output'] ) ) {
		error_log( '[video-behavior-by-abu] ffprobe failed for dimensions.' );
		return array( 'width' => 0, 'height' => 0 );
	}

	$parts = explode( 'x', trim( $result['output'] ) );
	if ( 2 !== count( $parts ) ) {
		return array( 'width' => 0, 'height' => 0 );
	}

	return array(
		'width'  => absint( $parts[0] ),
		'height' => absint( $parts[1] ),
	);
}

function vba_cleanup_derivatives( $attachment_id ) {
	$attachment_id = absint( $attachment_id );
	if ( ! $attachment_id ) {
		return;
	}

	delete_post_meta( $attachment_id, '_abu_video_derivatives' );
	delete_post_meta( $attachment_id, '_abu_video_poster_id' );
	delete_post_meta( $attachment_id, '_abu_video_720_id' );
	delete_post_meta( $attachment_id, '_abu_video_360_id' );
	delete_post_meta( $attachment_id, '_abu_video_status' );
	delete_post_meta( $attachment_id, '_abu_video_queued_at' );
	delete_post_meta( $attachment_id, '_abu_video_started_at' );
	delete_post_meta( $attachment_id, '_abu_video_finished_at' );
	delete_post_meta( $attachment_id, '_abu_video_last_error' );
	delete_post_meta( $attachment_id, '_abu_video_width' );
	delete_post_meta( $attachment_id, '_abu_video_height' );
	delete_transient( 'vba_processing_lock_' . $attachment_id );

	$children = get_posts(
		array(
			'post_type'      => 'attachment',
			'post_status'    => 'inherit',
			'posts_per_page' => -1,
			'fields'         => 'ids',
			'post_parent'    => $attachment_id,
			'meta_key'       => '_abu_video_quality',
		)
	);
	foreach ( $children as $child_id ) {
		wp_delete_attachment( $child_id, true );
	}

	$upload_dir = wp_upload_dir();
	$base_dir = trailingslashit( $upload_dir['basedir'] ) . 'abu-video/' . $attachment_id . '/';
	if ( ! is_dir( $base_dir ) ) {
		return;
	}

	$iterator = new RecursiveIteratorIterator(
		new RecursiveDirectoryIterator( $base_dir, RecursiveDirectoryIterator::SKIP_DOTS ),
		RecursiveIteratorIterator::CHILD_FIRST
	);

	foreach ( $iterator as $item ) {
		if ( $item->isDir() ) {
			@rmdir( $item->getPathname() );
		} else {
			@unlink( $item->getPathname() );
		}
	}

	@rmdir( $base_dir );
	error_log( '[video-behavior-by-abu] cleaned derivatives for attachment ' . $attachment_id );
}