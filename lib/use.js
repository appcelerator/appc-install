// jscs:disable jsDoc
/**
 * This code is closed source and Confidential and Proprietary to
 * Appcelerator, Inc. All Rights Reserved.  This code MUST not be
 * modified, copied or otherwise redistributed without express
 * written permission of Appcelerator. This file is licensed as
 * part of the Appcelerator Platform and governed under the terms
 * of the Appcelerator license agreement.
 */
var util = require('./util'),
	errorlib = require('./error'),
	debug = require('debug')('appc:use'),
	chalk = require('chalk');

function use(opts, callback, wantVersion) {
	var args = util.parseArgs(opts),
		obj,
		getLatest = !wantVersion && args.length > 1 && args[1] === 'latest';

	debug('use called with args %o, getLatest=%d', args, getLatest);
	if (args.length > 1 && !getLatest) {
		var version = opts.version = wantVersion || args[1];
		// see if we have this version
		var installBin = util.getInstallBinary(opts, version);
		// we already have this version, so we just need to write our version file and exit
		if (installBin && !opts.force) {
			debug('making %s your active version, dir %s', version, installBin);
			util.writeVersion(version);
			util.restartDaemon(version, installBin, opts.quiet);
			util.installPlugins(version, installBin, opts.quiet);
			console.log(chalk.yellow(version) + ' is now your active version');
			process.exit(0);
		}
		opts.use = true;
		// otherwise, we didn't find it, fall through so we can install it
		return callback();
	}

	util.startSpinner();
	var latestUrl = util.makeURL(opts, '/api/appc/latest');
	util.requestJSON({ url: latestUrl }, function (err, latestVersion) {
		if (err) {
			if (err.name === 'AppCError') {
				return callback(err);
			}
			handleOffline(err, opts, getLatest);
			return callback(errorlib.createError('com.appcelerator.install.use.download.error', err.message || String(err)));
		}

		var apiPath = '/api/appc/list';
		if (opts.prerelease) {
			apiPath += '?prerelease=true';
		}
		var url = util.makeURL(opts, apiPath);
		util.requestJSON({ url: url }, function (err, result) {
			util.stopSpinner();
			if (err) {
				// if already an AppCError just return it
				if (err.name === 'AppCError') {
					return callback(err);
				}
				handleOffline(err, opts, getLatest);
				return callback(errorlib.createError('com.appcelerator.install.use.download.error', err.message || String(err)));
			}
			if (!result) {
				return callback(errorlib.createError('com.appcelerator.install.download.server.unavailable'));
			}
			debug('versions returned from registry:', result);
			if (result && result.key) {
				result = result[result.key];
			}
			opts.latest = findLatest(result, latestVersion);
			if (getLatest) {
				if (!result.length) {
					console.log(chalk.red('No versions are current deployed. Please check back in a few minutes.'));
					process.exit(1);
				}
				return use(opts, callback, opts.latest);
			}
			// Is this JSON output ?
			if (opts.output === 'json') {
				obj = util.getVersionJson(opts, result);
				console.log(JSON.stringify(obj, null, '\t'));
			} else if (result) {
				console.log(chalk.white.bold.underline('The following versions are available:\n'));
				util.listVersions(opts, result);
				console.log('');
			} else {
				console.log('No results returned. Make sure you are online.');
			}
			process.exit(0);
		});
	});
}

function handleOffline(err, opts, getLatest) {
	// looks like we are offline
	if (err.code === 'ENOTFOUND' || err.code === 'ENOENT') {
		var versions = util.getInstalledVersions();
		// set active version as latest installed version
		if (getLatest) {
			var latest = versions[0];
			var installBin = util.getInstallBinary(opts, latest);
			if (installBin) {
				debug('making %s your active version, dir %s', latest, installBin);
				util.writeVersion(latest);
				console.log(chalk.yellow(latest) + ' is now your active version');
			}
			// json output
		} else if (util.parseOpts(opts).o === 'json') {
			var obj = util.getVersionJson(versions);
			console.log(JSON.stringify(obj, null, '\t'));
			// display installed versions
		} else {
			console.log(chalk.white.bold.underline('The following versions are available offline:\n'));
			util.listVersions(opts, versions);
			console.log('');
		}
		process.exit(0);
	}
}

function findLatest(listResult, latestVerResult) {
	var latest = listResult[0] && listResult[0].version;
	// Fetch the details from latestVersion payload.
	if (latestVerResult) {
		if (latestVerResult.key) {
			latestVerResult = latestVerResult[latestVerResult.key];
		}
		if (latestVerResult.length > 0) {
			latest = latestVerResult[0].version;
		}
	}
	return latest;
}

module.exports = use;
