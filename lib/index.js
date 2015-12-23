/**
 * This code is closed source and Confidential and Proprietary to
 * Appcelerator, Inc. All Rights Reserved.  This code MUST not be
 * modified, copied or otherwise redistributed without express
 * written permission of Appcelerator. This file is licensed as
 * part of the Appcelerator Platform and governed under the terms
 * of the Appcelerator license agreement.
 */
// load based on the platform to allow it to override
try {
	module.exports = require('./'+process.platform);
}
catch (e) {
	// this is OK, no platform to load
}

// if the platform library doesn't implement, provide defaults

if (!module.exports.run) {
	module.exports.run = require('./run');
}

if (!module.exports.install) {
	module.exports.install = require('./install');
}

if (!module.exports.use) {
	module.exports.use = require('./use');
}

if (!module.exports.remove) {
	module.exports.remove = require('./remove');
}
