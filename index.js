/**
 * This code is closed source and Confidential and Proprietary to
 * Appcelerator, Inc. All Rights Reserved.  This code MUST not be
 * modified, copied or otherwise redistributed without express
 * written permission of Appcelerator. This file is licensed as
 * part of the Appcelerator Platform and governed under the terms
 * of the Appcelerator license agreement.
 */
/**
 * this file will attempt to locate the correct appcelerator module version
 * and then will export its module.exports as its own
 */
var fs = require('fs'),
	path = require('path'),
	util = require('./lib/util'),
	version;

// see if we're being loaded from a parent module and if so, we need
// to check and see if that module is requiring a specific version of
// appc and if so, attempt to load it
if (module.parent && module.parent.filename) {
	// attempt to find the package.json for this file
	var dir = path.dirname(module.parent.filename);
	while (fs.existsSync(dir)) {
		var pk = path.join(dir, 'package.json');
		// if we found it, check and see if it has an appc-version key with a specific version
		if (fs.existsSync(pk)) {
			pk = require(pk);
			version = pk['appc-version'];
			break;
		}
		// else walk backwards
		dir = path.join(dir, '..');
	}
}

var bin = util.getInstallBinary(null, version);

// if we didn't find the version, we need to bail
if (!bin) {
	// if we didn't specify a version and we couldn't find one. we don't have appc installed
	if (!version) {
		throw new Error('you must run `appc setup` before you can require this module');
	} else {
		// we specified a version but we don't have it installed.  ideally we could auto-install
		// but since module loading is synchronous we have to just bail and make the user do it
		throw new Error('you must run `appc use ' + version + '` to install the required version');
	}
}

// we found our appc module so we need to export our module impersonating
// the module we're delegating to as if we had loaded it directly
var pkgdir = path.join(path.dirname(bin), '..');
module.exports = require(pkgdir);
