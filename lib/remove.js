/**
 * This code is closed source and Confidential and Proprietary to
 * Appcelerator, Inc. All Rights Reserved.  This code MUST not be
 * modified, copied or otherwise redistributed without express
 * written permission of Appcelerator. This file is licensed as
 * part of the Appcelerator Platform and governed under the terms
 * of the Appcelerator license agreement.
 */

module.exports = remove;

// 1. appc remove --all --force
// 2. appc remove -a -f
// 3. appc remove <*-wildcard style glob> -f
// 4. appc remove <version> -f
// The only way to remove an active version is to specify it.

var util = require('./util'),
	chalk = require('chalk'),
	debug = require('debug')('appc:remove'),
	fs = require('fs'),
	inquirer = require('inquirer'),
	path = require('path');

function removeVersions (list, opts) {
	var installDir = util.getInstallDir();

	if (opts.deactivateVersion) {
		debug('remove current active version');
		util.writeVersion('');
	}

	util.printConsoleOut(opts.force, 'Removing ...');
	list.forEach(function (item) {
		util.rmdirSyncRecursive(path.join(installDir, item), true);
	});
	util.printConsoleOut(opts.force, 'Done!');
}

function remove(args, cb) {
	var installedVersions =  util.getInstalledVersions();

	// no point to continue when nothing is installed
	if (!args.length || !installedVersions) {
		return cb();
	}

	var opts = {
			force: false,
			all: false,
			version: null
		},
		hasWildcard,
		pattern,
		regexp,
		totalMatch,
		toRemoveList,
		message,
		activeVersion = util.getActiveVersion(),
		activeIndex = installedVersions.indexOf(activeVersion);

	args.forEach(function(arg) {
		if (arg === '--force' || arg === '-f') {
			opts.force = true;
		} else if (arg === '--all' || arg === '-a') {
			opts.all = true;
		} else if (!/^--?/.test(arg)) {
			opts.version = arg;
			hasWildcard = (arg.indexOf('*') !== -1);
		}
	});

	debug('remove called with args %o', args);
	debug('opts %o', opts);

	if (opts.all) {
		debug('remove all non-active');
		pattern = '.*';
	} else if (hasWildcard) {
		debug('remove *-wildcard matched versions');
		pattern = opts.version.replace('.', '\\.').replace('*', '.*');
	} else {
		debug('remove a particular version');
		pattern = opts.version.replace('.', '\\.');
	}

	debug('remove pattern %s', pattern);

	regexp = new RegExp('^' + pattern + '$');
	toRemoveList = installedVersions.filter(function (item) {
		return regexp.test(item);
	});

	if (opts.version === activeVersion) {
		opts.deactivateVersion = true;
		message = opts.version;
	} else if (toRemoveList.indexOf(activeVersion) !== -1) {
		// we don't want to remove the active version unless it's specified
		toRemoveList.splice(toRemoveList.indexOf(activeVersion), 1);
	}

	totalMatch = toRemoveList.length;
	if (!totalMatch) {
		util.printConsoleOut(opts.force, chalk.yellow('Version does not exist.'));
		return cb(null, toRemoveList);
	}

	debug('Removing %j: ', toRemoveList);

	if (opts.force) {
		removeVersions(toRemoveList, opts);
		return cb(null, toRemoveList);
	} else {
		if (!message) {
			message = totalMatch + ' ' + (totalMatch > 1 ? 'matches' : 'match');
		}
		util.printConsoleOut(false, chalk.red('This will permanently remove %s! \n'), message);
		inquirer.prompt([{
			type: 'input',
			name: 'confirm',
			message: 'Enter \'' + chalk.cyan('yes') + '\' to confirm removal: '
		}], function(result) {
			if (result.confirm.toLowerCase() === 'yes') {
				removeVersions(toRemoveList, opts);
			}
			return cb(null, toRemoveList);
		});
	}
}
