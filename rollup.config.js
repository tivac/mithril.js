"use strict";

module.exports = {
	input : "./index.js",

	output : {
		format : "umd",
		file   : "./mithril.js",
		name   : "mithril",
	},

	plugins : [
		require("rollup-plugin-commonjs")(),
	],
};
