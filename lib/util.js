// jscs:disable jsDoc
/**
 * This code is closed source and Confidential and Proprietary to
 * Appcelerator, Inc. All Rights Reserved.  This code MUST not be
 * modified, copied or otherwise redistributed without express
 * written permission of Appcelerator. This file is licensed as
 * part of the Appcelerator Platform and governed under the terms
 * of the Appcelerator license agreement.
 */
var fs = require('fs'),
	path = require('path'),
	os = require('os'),
	chalk,
	urllib = require('url'),
	PacAgent = require('pac-proxy-agent'),
	semver = require('semver'),
	debug = require('debug')('appc:util'),
	spinner,
	spriteIndex = 0,
	cachedConfig,
	sprite = '/-\\|',
	execSync = require('child_process').execSync; // eslint-disable-line security/detect-child-process

var MAX_RETRIES = exports.MAX_RETRIES = 5;
var CONN_TIMEOUT = 10000;

// NOTE: not using char-spinner because i don't want it to reset to beginning
// of line each time it starts/stops. i want to spin in place at point of cursor

/*
 Testing Utilities.
 */
exports.stdout = process.stdout;
/* istanbul ignore next */
exports.exit = function (code) {
	process.exit(code);
};
/* istanbul ignore next */
exports.setCachedConfig = function (val) {
	cachedConfig = val;
};

/**
 * start the spinner
 */
function startSpinner() {
	stopSpinner();
	if (!spinner && exports.stdout.isTTY && !process.env.TRAVIS) {
		var count = 0;
		spinner = setInterval(function () {
			if (count++ > 0) {
				// go back one column
				exports.stdout.write('\u001b[1D');
			}
			var s = ++spriteIndex % sprite.length;
			var c = sprite[s];
			exports.stdout.write(c);
		}, 50);
	}
}

/**
 * stop the spinner
 */
function stopSpinner() {
	if (spinner) {
		clearInterval(spinner);
		// go back on column
		exports.stdout.write('\u001b[1D');
		spinner = null;
	}
}

/**
 * write a wait message and start spinner
 * @param {string} msg - message to output
 */
function waitMessage(msg) {
	exports.stdout.write(msg);
	startSpinner();
}

/**
 * write OK mark and stop spinner
 * @param {string} msg - message to output
 */
function okMessage(msg) {
	chalk = chalk || require('chalk');
	stopSpinner();
	msg = msg || '';
	exports.stdout.write(msg + ' ' + chalk.green(isWindows() ? 'OK' : '✓') + '\n');
}

/**
 * write message and stop spinner
 * @param {string} msg - message to output
 */
function infoMessage(msg) {
	stopSpinner();
	exports.stdout.write(msg + '\n');
}

/**
 * return the platform specific HOME directory
 * @returns {string}
 */
function getHomeDir() {
	return os.homedir();
}

/**
 * return our AppC directory
 * @returns {string}
 */
function getAppcDir() {
	return path.join(getHomeDir(), '.appcelerator');
}

/**
 * return the AppC install tag file
 * @returns {string}
 */
function getInstallTag() {
	return path.join(getAppcDir(), '.installing');
}

/**
 * return the global cache directory in the users home folder
 * @returns {string}
 */
function getCacheDir() {
	return path.join(getAppcDir(), 'cache');
}

/**
 * return the platform specific install directory
 * @returns {string}
 */
function getInstallDir() {
	return path.join(getAppcDir(), 'install');
}

/**
 * return the version file
 * @returns {string}
 */
function getVersionFile() {
	return path.join(getInstallDir(), '.version');
}

/**
 * return the config file
 * @returns {string}
 */
function getConfigFile() {
	return path.join(getAppcDir(), 'appc-cli.json');
}

/**
 * return the private npm cache directory
 * @returns {string}
 */
function getNpmCacheDirectory() {
	return path.join(getAppcDir(), '.npm');
}

/**
 * write out the current version file
 * @param {string} version - Version to write
 */
function writeVersion(version) {
	var versionFile = getVersionFile();
	debug('writing version: %s to %s', version, versionFile);
	if (fs.existsSync(versionFile)) {
		fs.unlinkSync(versionFile);
	}
	fs.writeFileSync(versionFile, version);
}

/**
 * return the active version (if specified) or undefined
 * @returns {string|undefined}
 */
function getActiveVersion() {
	var versionFile = getVersionFile();
	if (fs.existsSync(versionFile)) {
		return fs.readFileSync(versionFile).toString().trim();
	}
}

/**
 * remove version file
 */
function removeVersion() {
	var versionFile = getVersionFile();
	debug('remove version %s', versionFile);
	if (fs.existsSync(versionFile)) {
		fs.unlinkSync(versionFile);
	}
}

/**
 * list versions installed
 * @param {object} opts - Options
 * @param {object} versions - Versions of the CLI
 * @returns {undefined}
 */
function listVersions(opts, versions) {
	chalk = chalk || require('chalk');
	if (!versions) {
		exports.stdout.write(chalk.red('No versions available') + '\n');
		return;
	}
	var activeVersion = getActiveVersion();

	// If we don't find latest version from api/appc/list endpoint, then inject the latest version into the list.
	var versionsList = Object.keys(versions).map(function (value, index) {
		return versions[index].version || versions[index];
	});

	if (opts.latest && versionsList.indexOf(opts.latest) === -1) {
		versionsList.push(opts.latest);
	}

	versions = versionsList.sort(semver.compareLoose);

	versions.forEach(function (entry) {
		var ver = entry.version ? entry.version : entry,
			suffix = getInstallBinary(opts, ver) ? 'Installed' : 'Not Installed';
		if (opts.latest === ver) {
			suffix += chalk.white.bold(' (Latest)');
		}
		if (activeVersion && activeVersion === ver) {
			suffix += chalk.red(' (Active)');
		}
		var date = entry.date ? ' ' + chalk.grey(pad(new Date(Date.parse(entry.date)), 15)) : '';
		exports.stdout.write(chalk.yellow(pad(ver, 10)) + ' ' + chalk.cyan(pad(suffix, 40)) + date + '\n');
	});
}

/**
 * return json object of versions
 * @param {object} opts - Options
 * @param {object} versions - CLI versions
 * @return {object}
 */
function getVersionJson(opts, versions) {
	var activeVersion = getActiveVersion(),
		obj = {
			versions: [],
			installed: getInstalledVersions(),
			latest: opts.latest,
			active: activeVersion
		};
	if (Array.isArray(versions)) {
		if (versions[0] && versions[0].version) {
			obj.versions = Object.keys(versions).map(function (value, index) {
				return versions[index].version;
			});
		} else {
			obj.versions = versions;
		}
	}
	return obj;
}

/**
 * return the current versions installed
 * @returns {string[]}
 */
function getInstalledVersions() {
	var installDir = getInstallDir();
	if (fs.existsSync(installDir)) {
		// try and resolve the latest
		try {
			var dirs = fs.readdirSync(installDir);
			if (dirs.length) {
				if (dirs.length > 1) {
					// attempt to sort by latest version
					dirs = dirs
						.filter(function (e) {
							return e[0] !== '.';
						})
						.sort(function (a, b) {
							var av = parseInt(a.replace(/\./g, '')),
								bv = parseInt(b.replace(/\./g, ''));
							return bv - av;
						});
				}
				debug('found the following version directories: %j', dirs);
				return dirs;
			}
		} catch (E) {
			debug('error reading install directory %o', E);
			if (E.code === 'EACCES') {
				chalk = chalk || require('chalk');
				var chPer = 'Please make sure you change the permissions and re-try';
				var chPerWithCmds = 'Please make sure you change the permissions using these commands:\n\n\t';
				chPerWithCmds += chalk.yellow('sudo chown -R ' + process.env.USER + ' ' + installDir + '\n\tchmod -R 0700 ' + installDir);
				var message = process.platform === 'win32' ? chPer : chPerWithCmds + '\n';
				fail('Ooops! Your install directory (' + installDir + ') is not writable.\n' + message);
			}
			fail(E);
		}
	}
}

/**
 * return the platform specific install binary path
 * @param {object} opts - Options
 * @param {string} theversion - version to lookup the install binary for
 * @returns {string|null}
 */
function getInstallBinary(opts, theversion) {
	opts = opts || {};
	// first check and see if specified on command line as option
	var version = theversion || (opts.version !== true ? opts.version : null) || '',
		installDir = getInstallDir(),
		bin = path.join(installDir, version, 'package', 'bin', 'appc'),
		pkg,
		dirs;

	if (fs.existsSync(bin)) {
		// check the package.json since we will delete it on an interrupted download attempt
		pkg = path.join(installDir, version, 'package', 'package.json');
		return fs.existsSync(pkg) && bin;
	} else if (theversion) {
		// if we specified a version and we didn't find it, return null
		return null;
	}

	// see if we have a version set
	theversion = getActiveVersion();
	if (theversion) {
		bin = getInstallBinary(opts, theversion);
		if (!bin) {
			if (!opts.version) {
				chalk = chalk || require('chalk');
				debug('you have specified a version (%s) that isn\'t found', theversion);
				// only warn if we're not asking for this version
				// invalid version specified in version file. remove it and then re-install from latest
				exports.stdout.write(chalk.red('version ' + theversion + ' specified previously is no longer available.') + '\n');
			}
			removeVersion();
		} else {
			return bin;
		}
	}

	dirs = getInstalledVersions();
	if (dirs) {
		for (var c = 0; c < dirs.length; c++) {
			bin = path.join(installDir, dirs[c], 'package', 'bin', 'appc');
			if (fs.existsSync(bin)) {
				// check the package.json since we will delete it on an interrupted download attempt
				pkg = path.join(installDir, dirs[c], 'package', 'package.json');
				return fs.existsSync(pkg) && bin;
			}
		}
	}
}

/**
 * given a full path, makes sure that the directory exists
 * @param {string} dir - Directory to ensure exists
 * @return {string}
 */
function ensureDir(dir) {
	var last = expandPath(dir),
		parts = [];
	// find the top of the root that exists
	do {
		parts.unshift(path.basename(last));
		last = path.join(last, '..');
	} while (!fs.existsSync(last));

	if (!fs.existsSync(last)) {
		fs.mkdirSync(last);
	}

	// now create the directories in order
	for (var c = 0; c < parts.length; c++) {
		var fp = path.join(last, parts[c]);
		if (!fs.existsSync(fp)) {
			fs.mkdirSync(fp);
		}
		last = fp;
	}

	return dir;
}

/**
 * expand ~ in fn
 * @param {string} fn - Path to expand
 * @returns {string}
 */
function expandPath(fn) {
	var home = getHomeDir(),
		p = fn.replace(/~\/?/g, function (value) {
			if (/\/$/.test(value)) {
				return home + '/';
			}
			return home;
		});
	return p;
}

/**
 * fail and properly exit
 * @param {string} msg - Message to output
 */
function fail(msg) {
	stopSpinner();
	debug('fail %o', msg);
	if (msg.stack && process.env.DEBUG) {
		console.error(msg.stack);
	}
	chalk = chalk || require('chalk');
	console.error('\n' + (chalk.red(msg.message || msg)));
	exports.exit(1);
}

var optionRE = /^-{1,2}([\w-_]+)=?(.*)?$/;

/**
 * very loose parsing of options
 * @returns {object}
 */
function parseOpts() {
	var args = {};
	for (var c = 2; c < process.argv.length; c++) {
		var arg = process.argv[c];
		if (optionRE.test(arg)) {
			var match = optionRE.exec(arg),
				name = match[1],
				value = match.length > 2 && match[2] || (process.argv[c + 1] && !/^-{1,2}/.test(process.argv[c + 1]) ? process.argv[c + 1] : null) || true;
			if (value === 'true' || value === 'false') {
				value = value === 'true';
			}
			if (name.indexOf('no-') === 0) {
				name = name.substring(3);
				value = false;
			}
			args[name] = value;
		}
	}
	return args;
}

/**
 * loose parse none options
 * @param {object} opts - Options
 * @returns {string[]}
 */
function parseArgs(opts) {
	if (!opts) {
		throw new Error('missing opts');
	}
	var args = [];
	for (var c = 2; c < process.argv.length; c++) {
		var arg = process.argv[c];
		var previous = process.argv[c - 1];
		if (optionRE.test(previous)) {
			var previousMatch = optionRE.exec(previous);
			previous = previousMatch[1];
		}
		if (optionRE.test(arg)) {
			var match = optionRE.exec(arg),
				name = match[1],
				value = opts[name];
			// see if a value was provided and if so, remove it too
			if (value && String(process.argv[c + 1] === String(value))) {
				c++;
			}
			continue;
		} else if (opts[previous] === undefined) {
			args.push(arg);
		}
	}
	return args;
}

/**
 * make a registry url
 * @param {object} opts - Options
 * @param {string} urlpath - Path to add to the the baseUrl
 * @returns {string}
 */
function makeURL(opts, urlpath) {
	if (typeof (opts) === 'string') {
		urlpath = opts;
		opts = {};
	} else {
		opts = opts || {};
	}
	var baseurl;
	if (opts.registry) {
		baseurl = opts.registry;
	} else if (process.env.APPC_REGISTRY_SERVER) {
		baseurl = process.env.APPC_REGISTRY_SERVER;
	} else if (process.env.APPC_ENV || process.env.NODE_ENV) {
		var env = process.env.APPC_ENV || process.env.NODE_ENV;
		if (env === 'preproduction') {
			baseurl = DEFAULT_PREPROD_REGISTRY_URL;
		} else if (env === 'preprodonprod') {
			baseurl = DEFAULT_PREPRODONPROD_REGISTRY_URL;
		} else if (env === 'production') {
			baseurl = DEFAULT_PROD_REGISTRY_URL;
		}
	}
	if (!baseurl) {
		var config = readConfig();
		if (config && config.registry) {
			baseurl = config.registry;
		} else if (config && (config.defaultEnvironment === 'preproduction' || config.environmentName === 'preproduction')) {
			baseurl = DEFAULT_PREPROD_REGISTRY_URL;
		} else if (config && (config.defaultEnvironment === 'preprodonprod' || config.environmentName === 'preprodonprod')) {
			baseurl = DEFAULT_PREPRODONPROD_REGISTRY_URL;
		} else {
			baseurl = DEFAULT_PROD_REGISTRY_URL;
		}
	}
	return urllib.resolve(baseurl, urlpath);
}

function makeRequestError(msg, code) {
	var err = new Error(msg);
	err.code = code;
	return err;
}

// TODO: Perhaps we should include and use appc-platform-sdk env vars?
var DEFAULT_PREPROD_REGISTRY_URL = 'https://registry.axwaytest.net';
var DEFAULT_PROD_REGISTRY_URL = 'https://registry.platform.axway.com';
var DEFAULT_PREPRODONPROD_REGISTRY_URL = 'https://software-preprodonprod.appcelerator.com';

/**
 * return the request library
 * @return {object}
 */
function getRequest() {
	return require('request');
}

/**
 * make a request to location url
 * @param {string|object} location - url to request or request object
 * @param {function} callback - function to call when done
 * @returns {request}
 */
function request(location, callback) {
	var options;
	if (typeof (location) === 'object') {
		options = location;
		location = options.url;
	}

	var url = urllib.parse(location),
		config = readConfig(),
		userAgent = 'Appcelerator CLI/' + require('../package').version + ' (' + process.platform + ')',
		opts = {
			url: url,
			headers: {
				'user-agent': userAgent,
				host: url.host,
				'appc-token': config && config.sid
			}
		};

	if (options) {
		opts.timeout = CONN_TIMEOUT * (options.attempts || 1);
	}

	if (process.env.APPC_CONFIG_PAC_FILE) {
		opts.agent = new PacAgent('pac+' + process.env.APPC_CONFIG_PAC_FILE);
	} else if (process.env.APPC_CONFIG_PROXY !== '') {
		opts.proxy = process.env.APPC_CONFIG_PROXY;
	}

	if (process.env.APPC_CONFIG_CAFILE) {
		opts.ca = fs.readFileSync(process.env.APPC_CONFIG_CAFILE, 'utf8');
	}

	if (process.env.APPC_CONFIG_STRICTSSL === 'false') {
		opts.strictSSL = false;
	}

	var req = getRequest().get(opts);

	debug('request %j', opts);

	// start the request
	req.on('response', function (res) {
		debug('request response received');
		if (req.__err) {
			debug('request response callback skipped, request error already executed.');
		} else {
			callback(null, res, req);
		}
	});

	// check the error
	req.on('error', function (err) {
		req.__err = true;
		debug('request error', err);
		if (err.name === 'AppCError') {
			return callback(err);
		}
		if (err.code === 'ECONNREFUSED') {
			return callback(makeRequestError('Error connecting to download server at ' + url.host + '. Make sure you are online.', err.code));
		} else if (err.code === 'ENOTFOUND') {
			return callback(makeRequestError('Error connecting to download server at ' + url.host + ' (not found). Make sure you are online.', err.code));
		} else if (err.code === 'ECONNRESET') {
			return callback(makeRequestError('Error connecting to download server at ' + url.host + ' (reset). Make sure you are online.', err.code));
		}
		return callback(err);
	});

	return req;
}

/**
 * make a request a return JSON
 * @param {string} location - URL to request
 * @param {function} callback - Function to call when done
 * @param {number} attempts - Number or attempts to make
 * @return {request}
 */
function requestJSON(location, callback, attempts) {
	return request(location, function (err, res, req) {
		attempts = attempts || 1;
		if (typeof (location) === 'object') {
			location.attempts = attempts + 1;
		}

		debug('connection attempt %d of %d', attempts, MAX_RETRIES);
		if (err) {
			if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.message.indexOf('hang up') > 0) {
				debug('connection error %s with message %s', err.code, err.message);
				// retry again
				if (attempts >= MAX_RETRIES) {
					return callback(err);
				}
				return setTimeout(function () {
					return requestJSON(location, callback, attempts + 1);
				}, 500 * attempts);
			}
			return callback(err);
		}
		if (res && req.headers && req.headers['content-type'] && req.headers['content-type'].indexOf('/json') < 0) {
			debug('response status code: %d with headers: %j', res.statusCode, res.headers);
			// retry again
			if (attempts >= MAX_RETRIES) {
				return callback(err);
			}
			return setTimeout(function () {
				return requestJSON(location, callback, attempts + 1);
			}, 500 * attempts);
		}
		if (res.statusCode === 200) {
			debug('response status code: %d with headers: %j', res.statusCode, res.headers);
			var buf = '';
			res.on('data', function (chunk) {
				buf += chunk;
			});
			res.on('end', function () {
				debug('attempting to parse JSON => [%s]', buf);
				callback(null, JSON.parse(buf));
			});
			res.on('error', callback);
		} else if (res.statusCode === 301 || res.statusCode === 302) {
			debug('response status code: %d with headers: %j', res.statusCode, res.headers);
			return requestJSON(res.headers.location, callback);
		} else if (res && /^(400|404|408|500|502|503|504)$/.test(String(res.statusCode))) {
			debug('response status code: %d with headers: %j', res.statusCode, res.headers);
			attempts = attempts || 1;
			if (attempts >= MAX_RETRIES) {
				return callback(err);
			}
			return setTimeout(function () {
				return requestJSON(location, callback, attempts + 1);
			}, 500 * attempts);
		} else {
			return callback(new Error('Invalid response code: ' + res.statusCode + ' received from server.'));
		}
	});
}

/**
 * right pad a string to a specific length
 * @param {string} str - string to pad
 * @param {number} len - number of spaces to pad
 * @returns {string}
 */
function pad(str, len) {
	chalk = chalk || require('chalk');
	var slen = chalk.stripColor(str).length;
	var newstr = str;
	for (var c = slen; c < len; c++) {
		newstr += ' ';
	}
	return newstr;
}

/**
 * returns true if directory is writable by user
 * @param {string} dir - Directory to check
 * @returns {boolean}
 */
function canWriteDir(dir) {
	var del = !fs.existsSync(dir),
		fn;
	try {
		if (del) {
			ensureDir(dir);
		}
		if (fs.statSync(dir).isDirectory()) {
			// create a temp file -- seems like the best way to handle cross platform
			fn = path.join(dir, String(+new Date()) + (Math.random() * 3) + '.txt');
			// console.log(fn);
			fs.writeFileSync(fn, 'hi');
			return true;
		} else {
			// not a directory but a file, sorry...
			return false;
		}
	} catch (E) {
		if (E.code === 'EACCES') {
			return false;
		}
		console.log(E.stack, E.code);
	} finally {
		if (fs.existsSync(fn)) {
			try {
				fs.unlinkSync(fn);
			} catch (ig) {
				// ignore
			}
		}
		if (del) {
			try {
				fs.unlinkSync(path);
			} catch (ig) {
				// ignore
			}
		}
	}
}

/**
 * if not writable, returns a message otherwise undefined
 * @param {string} dir - Directory to check
 * @param {string} name - Error name
 * @returns {undefined|AppcError}
 */
function checkDirectory(dir, name) {
	var message;
	var errorlib = require('./error'),
		chalk = chalk || require('chalk');
	if (!canWriteDir(dir)) {
		var chPer = 'Please make sure you change the permissions and re-try';
		var chPerWithCmd = 'Please make sure you change the permissions using these commands:\n\n\t';
		chPerWithCmd += chalk.yellow('sudo chown -R ' + process.env.USER + ' ' + dir + '\n\tchmod -R 0700 ' + dir);
		message = process.platform === 'win32' ? chPer : chPerWithCmd + '\n';
		return errorlib.createError('com.appcelerator.install.preflight.directory.unwritable', name, dir, message);
	} else if (process.platform !== 'win32') {
		// check the ownership of the directory too
		var stat = fs.statSync(dir);
		if (stat.uid !== process.getuid()) {
			message = 'Please make sure you change the permissions using these commands:\n\n\t' + chalk.yellow('sudo chown -R ' + process.env.USER + ' ' + dir + '\n\tchmod -R 0700 ' + dir) + '\n';
			return errorlib.createError('com.appcelerator.install.preflight.directory.ownership', name, dir, process.env.USER, message);
		}
	}
}

function abortMessage(name) {
	// clear line and reset it
	if (exports.stdout.isTTY) {
		stopSpinner();
		exports.stdout.clearLine();
		exports.stdout.cursorTo(0);
	}
	exports.stdout.write(name + ' aborted.\n');
	exports.exit(1);
}

function readConfig() {
	if (cachedConfig) {
		return cachedConfig;
	}
	var cf = getConfigFile();
	if (!fs.existsSync(cf)) {
		return null;
	}
	return (cachedConfig = JSON.parse(fs.readFileSync(cf)));
}

function writeConfig(config) {
	cachedConfig = config;
	var cf = getConfigFile();
	fs.writeFileSync(cf, JSON.stringify(config, null, 2));
}

/**
 * perform an update check to see if we have a new version
 *
 * however, some rules:
 *
 * - don't check each time
 * - if specifying a version, skip
 * - if specifying --quiet, skip
 * - if no config, skip
 * - if any failure in checking, skip
 * - only do it once per day (or what is configured)
 *
 * @param {object} opts - Options
 * @param {function} callback - Function to call when done
 * @returns {undefined}
 */
function updateCheck(opts, callback) {
	// we are specifying a version or we want quiet output, skip
	if (opts.version || opts.quiet || opts.output === 'json') {
		return callback();
	}

	// check to see if we have a config file and if we don't that's OK, return
	// since we are in a setup/install
	var config = readConfig();

	if (!config) {
		return callback();
	}

	chalk = chalk || require('chalk');

	try {
		var check = config.lastUpdateCheck;
		var checkEveryMS = config.updateCheckInterval || 86400000; // once per day in MS
		if (!check || check + checkEveryMS < Date.now()) {
			// do the check below
			debug('update check skipping, %d, %d', check, checkEveryMS);
		} else {
			// don't do the check
			return callback();
		}
	} catch (E) {
		// ignore errors, they will be dealt with otherwise
		return callback();
	}

	var url = makeURL(opts, '/api/appc/list');
	exports.requestJSON(url, function (err, result) {
		// skip failures
		if (!err && result) {
			try {
				var activeVersion = exports.getActiveVersion(),
					resultList = result.key && result[result.key],
					latest = result.latest || (resultList && (resultList.length > 0) && resultList[0].version);

				debug('update check completed, latest is %s', latest);
				// set the update check timestamp
				config.lastUpdateCheck = Date.now();

				// write out our config
				writeConfig(config);

				// see if we have it already
				var found = exports.getInstallBinary(opts, latest);

				// if not, inform the user of the update
				debug('update check found %s', found);
				if (!found && semver.lt(activeVersion, latest)) {
					exports.stdout.write('A new update ' + chalk.yellow('(' + latest + ')') + ' is available... Download with ' + chalk.green('appc use ' + latest) + '\n');
				}
			} catch (E) {
				// ignore
			}
		}
		callback();
	});
}

function isWindows() {
	return process.platform === 'win32';
}

/**
 * if a TTY is connected, clear all text on the line and reset the
 * cursor to the beginning of the line
 */
function resetLine() {
	if (exports.stdout.isTTY) {
		exports.stdout.clearLine();
		exports.stdout.cursorTo(0);
	}
}

/**
 * rmdirSyncRecursive method borrowed from wrench
 *
 * The MIT License
 *
 * Copyright (c) 2010 Ryan McGrath
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * @param {string} _path - filepath
 * @param {boolean} failSilent - Fail silently
 * @returns {undefined}
 */
function rmdirSyncRecursive(_path, failSilent) {
	var files;

	try {
		files = fs.readdirSync(_path);
	} catch (err) {

		if (failSilent) {
			return;
		}
		throw new Error(err.message);
	}

	/*  Loop through and delete everything in the sub-tree after checking it */
	for (var i = 0; i < files.length; i++) {
		var file = path.join(_path, files[i]);
		var currFile = fs.lstatSync(file);

		if (currFile.isDirectory()) {
			// Recursive function back to the beginning
			rmdirSyncRecursive(file);
		} else if (currFile.isSymbolicLink()) {
			// Unlink symlinks
			if (isWindows()) {
				fs.chmodSync(file, 666); // Windows needs this unless joyent/node#3006 is resolved..
			}

			fs.unlinkSync(file);
		} else {
			// Assume it's a file - perhaps a try/catch belongs here?
			if (isWindows) {
				fs.chmodSync(file, 666); // Windows needs this unless joyent/node#3006 is resolved..
			}

			fs.unlinkSync(file);
		}
	}

	/*  Now that we know everything in the sub-tree has been deleted, we can delete the main
	 directory. Huzzah for the shopkeep. */
	return fs.rmdirSync(_path);
}

/**
 * return an array of arguments appending any subsequent process args
 * @param {string} args - arguments
 * @param {object} opts - options
 * @returns {array[]}
 */
function mergeOptsToArgs(args, _opts) {
	var argv = [].concat(process.__argv.slice(3));
	if (argv.length) {
		for (var c = 0; c < argv.length; c++) {
			var arg = argv[c];
			args.push(arg);
		}
	}
	return args;
}

/**
 * returns the proxy to use, checks:
 * 1. proxyServer setting from config
 * 2. environmental variables (HTTP_PROXY, HTTPS_PROXY)
 *
 * to set proxyServer value:
 * appc config set proxyServer '[proxy url]'
 *
 * @param {object} config - config object
 * @returns {string}
 */
function getProxyServer(config) {
	var proxy = null,
		parsed;

	if (config && config.proxyServer) {
		parsed = urllib.parse(config.proxyServer);
		if (/^https?:$/.test(parsed.protocol) && parsed.hostname && parsed.hostname !== 'null') {
			proxy = config.proxyServer;
		}
	}

	return proxy
		|| process.env.HTTP_PROXY
		|| process.env.http_proxy
		|| process.env.HTTPS_PROXY
		|| process.env.https_proxy
		|| '';
}

/**
 * return whether or not to do SSL key validation when making https requests.
 *
 * to set stricSSL value:
 * appc config set strictSSL [false/true]
 *
 * @param {object} config - config object
 * @return {boolean|null}
 */
function getStrictSSL(config) {
	return config ? config.strictSSL : null;
}

/**
 * return the path to a file containing one or multiple Certificate Authority signing certificates.
 *
 * to set cafile value:
 * appc config set cafile '[file path, in PEM format]'
 *
 * @param {object} config - config object
 * @return {string|null}
 */
function getCAfile(config) {
	if (config && config.cafile && fs.existsSync(config.cafile)) {
		return config.cafile;
	}

	return null;
}

/**
 * write out the process.versions info stored when installing package
 *
 * @param {string} pkgDir - package directory
 */
function writeVersions(pkgDir) {
	var versionsFile = path.join(pkgDir, '.nodeversions'),
		versions = process.versions,
		versionsStr = JSON.stringify(versions);

	debug('writing node version: %s to %s', versionsStr, versionsFile);
	if (fs.existsSync(versionsFile)) {
		fs.unlinkSync(versionsFile);
	}
	fs.writeFileSync(versionsFile, versionsStr);

	// remove old file
	var oldVersionFile = path.join(pkgDir, '.nodeversion');
	if (fs.existsSync(oldVersionFile)) {
		fs.unlinkSync(oldVersionFile);
	}
}

/**
 * return the process.versions info when install the package
 *
 * @param {string} installBin - install binary location
 * @returns {object}
 */
function readVersions(installBin) {
	var versionFile = path.join(installBin, '..', '..', '..', '.nodeversions'),
		versions;

	if (fs.existsSync(versionFile)) {
		try {
			versions = JSON.parse(fs.readFileSync(versionFile));
		} catch (e) {
			debug('unable to read versions file.');
		}
		return versions;
	}
}

/**
 * check if the minor/major NodeJS version changed since the package was installed
 *
 * @param {string} installBin - path to install binary
 * @return {boolean}
 */
function isNodeVersionChanged(installBin) {
	var version = getPackageNodeVersion(installBin),
		usedNode = version && version.split('.'),
		currentNode = process.version.split('.'),
		result = false;

	if (usedNode && usedNode.length >= 2 && currentNode.length >= 2) {
		result = !(usedNode[0] === currentNode[0] && usedNode[1] === currentNode[1]);
	}

	debug('node used %s, current version %s, result: %s', usedNode, currentNode, result);
	return result;
}

/**
 * check if the modules version changed since the package was installed
 *
 * @param {string} installBin - path to install binary
 * @return {boolean}
 */
function isModuleVersionChanged(installBin) {
	var versions = readVersions(installBin),
		usedVersion = versions && versions.modules,
		currentModuleVersion = process.versions && process.versions.modules,
		result = false;

	if (usedVersion && currentModuleVersion) {
		result = (usedVersion !== currentModuleVersion);
		debug('modules version used %s, current version %s, result: %s', usedVersion, currentModuleVersion, result);
	} else {
		result = isNodeVersionChanged(installBin);
	}

	return result;
}

/**
 * return the NodeJS version used to install the package
 *
 * @param {string} installBin - path to install binary
 * @return {string}
 */
function getPackageNodeVersion(installBin) {
	var versions = readVersions(installBin),
		usedNodeVersion = versions && versions.node;

	if (usedNodeVersion) {
		return usedNodeVersion;
	}

	var versionFile = path.join(installBin, '..', '..', '..', '.nodeversion');
	if (fs.existsSync(versionFile)) {
		return fs.readFileSync(versionFile).toString().trim();
	}
}

function outputInfo(msg, isJSON) {
	if (isJSON) {
		return;
	}

	exports.stdout.write(msg);
}

function killDaemon(version, installBin) {
	var pkgFile = path.join(getInstallDir(), version, 'package', 'package.json');
	var pkg = fs.existsSync(pkgFile) && require(pkgFile);
	if (isWindows()) {
		installBin = '"' + process.execPath + '" "' + installBin + '"';
	}
	if (pkg && 'appcd' in pkg.dependencies) {
		debug('stop appcd');
		try {
			execSync(installBin + ' appcd restart');
		} catch (error) {
			// ignore
			debug('error killing the daemon');
			debug(error);
		}
	}
}

function checkNodeVersion (supportedNodeRange) {
	if (!semver.satisfies(process.version, supportedNodeRange)) {
		console.log(chalk.cyan('Appcelerator Command-Line Interface'));
		console.log('Copyright (c) 2014-' + (new Date().getFullYear()) + ', Appcelerator, Inc.  All Rights Reserved.');
		console.log('');
		console.log(chalk.red('ERROR: appc requires Node.js ' + semver.validRange(supportedNodeRange)));
		console.log('Visit ' + chalk.cyan('http://nodejs.org/') + ' to download a newer version.');
		console.log('');

		exports.exit(1);
	}
}

exports.checkNodeVersion = checkNodeVersion;
exports.getAppcDir = getAppcDir;
exports.getHomeDir = getHomeDir;
exports.getCacheDir = getCacheDir;
exports.getConfigFile = getConfigFile;
exports.getNpmCacheDirectory = getNpmCacheDirectory;
exports.ensureDir = ensureDir;
exports.expandPath = expandPath;
exports.getInstallDir = getInstallDir;
exports.listVersions = listVersions;
exports.getVersionJson = getVersionJson;
exports.getInstalledVersions = getInstalledVersions;
exports.getInstallBinary = getInstallBinary;
exports.fail = fail;
exports.parseOpts = parseOpts;
exports.parseArgs = parseArgs;
exports.writeVersion = writeVersion;
exports.getActiveVersion = getActiveVersion;
exports.makeURL = makeURL;
exports.request = request;
exports.requestJSON = requestJSON;
exports.pad = pad;
exports.waitMessage = waitMessage;
exports.okMessage = okMessage;
exports.infoMessage = infoMessage;
exports.stopSpinner = stopSpinner;
exports.startSpinner = startSpinner;
exports.canWriteDir = canWriteDir;
exports.checkDirectory = checkDirectory;
exports.abortMessage = abortMessage;
exports.updateCheck = updateCheck;
exports.isWindows = isWindows;
exports.resetLine = resetLine;
exports.rmdirSyncRecursive = rmdirSyncRecursive;
exports.getRequest = getRequest;
exports.mergeOptsToArgs = mergeOptsToArgs;
exports.getInstallTag = getInstallTag;
exports.getProxyServer = getProxyServer;
exports.getStrictSSL = getStrictSSL;
exports.getCAfile = getCAfile;
exports.readConfig = readConfig;
exports.writeVersions = writeVersions;
exports.isModuleVersionChanged = isModuleVersionChanged;
exports.getPackageNodeVersion = getPackageNodeVersion;
exports.outputInfo = outputInfo;
exports.killDaemon = killDaemon;
