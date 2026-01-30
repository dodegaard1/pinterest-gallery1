/**
 * WordPress Dependencies
 */
const path = require( 'path' );

module.exports = {
	entry: path.resolve( __dirname, 'gallery-maker/src/index.js' ),
	output: {
		filename: 'index.js',
		path: path.resolve( __dirname, 'gallery-maker/build' ),
	},
};
