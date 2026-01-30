/**
 * WordPress dependencies
 */
import { registerBlockType } from '@wordpress/blocks';

/**
 * Internal dependencies
 */
import Edit from './edit';
import './editor.css';

/**
 * Block metadata
 */
import metadata from '../block.json';

/**
 * Register the ABU Gallery Maker block.
 * 
 * This block provides a chapter-based media organization UI in the block editor.
 * Phase 1: Editor-only, no front-end rendering.
 */
registerBlockType( metadata.name, {
	edit: Edit,
	// No save function - this is an editor-only block that stores data in post meta
	save: () => null,
} );
