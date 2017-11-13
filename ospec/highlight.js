/* eslint-disable global-require, no-bitwise, no-process-exit */
"use strict"

var hasProcess = typeof process === "object"

module.exports = function highlight(message) {
	return hasProcess ? "\x1b[31m" + message + "\x1b[0m" : "%c" + message + "%c "
}
