/**
 * WordPress Dependencies
 */
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const path = require( 'path' );

module.exports = {
	...defaultConfig,
	entry: path.resolve( __dirname, 'gallery-maker/src/index.js' ),
	output: {
		filename: 'index.js',
		path: path.resolve( __dirname, 'gallery-maker/build' ),
	},
};
