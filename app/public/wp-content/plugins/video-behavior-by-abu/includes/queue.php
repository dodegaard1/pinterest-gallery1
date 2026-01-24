<?php

defined( 'ABSPATH' ) || exit;

function vba_enqueue_attachment( $attachment_id ) {
	$attachment_id = absint( $attachment_id );
	if ( ! $attachment_id ) {
		return;
	}

	$queue = get_option( VBA_OPTION_QUEUE, array() );
	if ( ! is_array( $queue ) ) {
		$queue = array();
	}

	if ( in_array( $attachment_id, $queue, true ) ) {
		return;
	}

	$queue[] = $attachment_id;
	update_option( VBA_OPTION_QUEUE, array_values( $queue ), false );

	update_post_meta( $attachment_id, '_abu_video_status', 'queued' );
	update_post_meta( $attachment_id, '_abu_video_queued_at', current_time( 'mysql' ) );

	error_log( '[video-behavior-by-abu] queued attachment ' . $attachment_id );

	if ( ! wp_next_scheduled( 'vba_process_video_queue' ) ) {
		wp_schedule_single_event( time() + 30, 'vba_process_video_queue' );
	}
}

function vba_dequeue_batch( $count = 2 ) {
	$queue = get_option( VBA_OPTION_QUEUE, array() );
	if ( ! is_array( $queue ) || empty( $queue ) ) {
		return array();
	}

	$batch = array_slice( $queue, 0, $count );
	$remaining = array_slice( $queue, $count );
	update_option( VBA_OPTION_QUEUE, array_values( $remaining ), false );
	return array_values( array_filter( array_map( 'absint', $batch ) ) );
}

function vba_queue_size() {
	$queue = get_option( VBA_OPTION_QUEUE, array() );
	return is_array( $queue ) ? count( $queue ) : 0;
}

function vba_remove_from_queue( $attachment_id ) {
	$attachment_id = absint( $attachment_id );
	if ( ! $attachment_id ) {
		return;
	}

	$queue = get_option( VBA_OPTION_QUEUE, array() );
	if ( ! is_array( $queue ) || empty( $queue ) ) {
		return;
	}

	$queue = array_values( array_filter( $queue, function( $item ) use ( $attachment_id ) {
		return absint( $item ) !== $attachment_id;
	} ) );

	update_option( VBA_OPTION_QUEUE, $queue, false );
}

function vba_get_video_status( $attachment_id ) {
	return get_post_meta( $attachment_id, '_abu_video_status', true );
}