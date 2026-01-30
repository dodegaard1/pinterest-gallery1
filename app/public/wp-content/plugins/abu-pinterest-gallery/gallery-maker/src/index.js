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
 * Automatically renders the gallery shortcode on the frontend.
 */
registerBlockType( metadata.name, {
	edit: Edit,
	// Output the shortcode on the frontend
	save: () => {
		return (
			<div className="wp-block-abu-gallery-maker">
				[abu_pinterest_gallery]
			</div>
		);
	},
} );
