<?php

defined( 'ABSPATH' ) || exit;

function vba_get_ffmpeg_path() {
	$path = get_option( VBA_OPTION_FFMPEG_PATH, 'ffmpeg' );
	return $path ? $path : 'ffmpeg';
}

function vba_get_ffmpeg_status() {
	static $cached = null;
	if ( null !== $cached ) {
		return $cached;
	}

	$path = vba_get_ffmpeg_path();
	$cached = vba_check_ffmpeg( $path );
	return $cached;
}

function vba_check_ffmpeg( $path ) {
	$disabled_functions = array_map( 'trim', explode( ',', (string) ini_get( 'disable_functions' ) ) );
	$blocked = array();
	foreach ( array( 'exec', 'shell_exec', 'proc_open', 'passthru', 'system' ) as $fn ) {
		if ( in_array( $fn, $disabled_functions, true ) || ! function_exists( $fn ) ) {
			$blocked[] = $fn;
		}
	}

	if ( count( $blocked ) === 5 ) {
		$message = 'Shell execution is disabled. Enable exec/proc_open or configure server to allow running FFmpeg.';
		error_log( '[video-behavior-by-abu] ' . $message );
		return array(
			'ok'      => false,
			'message' => $message,
		);
	}

	$cmd = escapeshellcmd( $path ) . ' -version';
	$result = vba_run_command( $cmd );
	if ( ! $result['ok'] ) {
		$message = $result['message'] ? $result['message'] : 'FFmpeg not found or not executable.';
		error_log( '[video-behavior-by-abu] ' . $message );
		return array(
			'ok'      => false,
			'message' => $message,
		);
	}

	return array(
		'ok'      => true,
		'message' => 'FFmpeg detected: ' . $result['output'],
	);
}

function vba_run_command( $cmd ) {
	$output = '';
	$exit_code = null;

	if ( function_exists( 'proc_open' ) && ! vba_function_disabled( 'proc_open' ) ) {
		$descriptors = array(
			1 => array( 'pipe', 'w' ),
			2 => array( 'pipe', 'w' ),
		);
		$process = @proc_open( $cmd, $descriptors, $pipes );
		if ( is_resource( $process ) ) {
			$output = stream_get_contents( $pipes[1] );
			$error  = stream_get_contents( $pipes[2] );
			foreach ( $pipes as $pipe ) {
				fclose( $pipe );
			}
			$exit_code = proc_close( $process );
			if ( 0 === $exit_code ) {
				return array(
					'ok'     => true,
					'output' => trim( $output ),
				);
			}

			return array(
				'ok'      => false,
				'message' => trim( $error ? $error : $output ),
			);
		}
	}

	if ( function_exists( 'exec' ) && ! vba_function_disabled( 'exec' ) ) {
		$lines = array();
		@exec( $cmd, $lines, $exit_code );
		if ( 0 === $exit_code ) {
			$output = implode( "\n", $lines );
			return array(
				'ok'     => true,
				'output' => trim( $output ),
			);
		}
	}

	if ( function_exists( 'shell_exec' ) && ! vba_function_disabled( 'shell_exec' ) ) {
		$raw = @shell_exec( $cmd );
		if ( $raw ) {
			return array(
				'ok'     => true,
				'output' => trim( $raw ),
			);
		}
	}

	return array(
		'ok'      => false,
		'message' => 'Unable to execute shell command for FFmpeg detection.',
	);
}

function vba_function_disabled( $function_name ) {
	$disabled = array_map( 'trim', explode( ',', (string) ini_get( 'disable_functions' ) ) );
	return in_array( $function_name, $disabled, true );
}