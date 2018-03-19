// jscs:disable jsDoc
/**
 * This code is closed source and Confidential and Proprietary to
 * Appcelerator, Inc. All Rights Reserved.  This code MUST not be
 * modified, copied or otherwise redistributed without express
 * written permission of Appcelerator. This file is licensed as
 * part of the Appcelerator Platform and governed under the terms
 * of the Appcelerator license agreement.
 */
var ProgressBar = require('progress'),
	chalk = require('chalk'),
	util = require('./util'),
	errorlib = require('./error'),
	urllib = require('url'),
	fs = require('fs'),
	os = require('os'),
	path = require('path'),
	debug = require('debug')('appc:download'),
	tmpdir = os.tmpdir(),
	MAX_RETRIES = util.MAX_RETRIES,
	pendingRequest;

function download(quiet, force, wantVersion, tmpfile, stream, location, callback, nobanner, retryAttempts) {
	debug('download called with arguments: %o', arguments);
	if (!nobanner && !wantVersion) { util.waitMessage('Finding latest version '); }
	if (!nobanner && wantVersion) { util.waitMessage('Finding version ' + wantVersion + ' '); }

	retryAttempts = retryAttempts || 1;
	debug('connection attempt %d of %d', retryAttempts, MAX_RETRIES);

	var bar;
	pendingRequest = util.request(location, function (err, res, req) {
		if (err) {
			debug('error from download was: %o', err);
			if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
				pendingRequest = null;
				util.resetLine();
				if (retryAttempts >= MAX_RETRIES) {
					return callback(errorlib.createError('com.appcelerator.install.download.server.unavailable'));
				}
				// retry again
				debug('retrying request again, count=%d, delay=%d', retryAttempts, 500 * retryAttempts);
				return setTimeout(function () {
					download(quiet, force, wantVersion, tmpfile, stream, location, callback, true, retryAttempts + 1);
				}, 500 * retryAttempts);
			} else if (err.name === 'AppCError') {
				return callback(err);
			}
			return callback(errorlib.createError('com.appcelerator.install.download.server.response.error', err.message));
		}
		debug('response status code was: %d', res.statusCode);
		// console.log(res);
		if (res.statusCode === 301 || res.statusCode === 302) {
			debug('response status code: %d with headers: %j', res.statusCode, res.headers);

			// handle redirect
			location = res.headers.location;
			pendingRequest = null;
			util.resetLine();
			return download(quiet, force, wantVersion, tmpfile, stream, location, callback, nobanner, retryAttempts);
		} else if (res.statusCode === 404) {
			debug('response status code: %d with headers: %j', res.statusCode, res.headers);

			pendingRequest = null;
			return callback(errorlib.createError('com.appcelerator.install.download.version.specified.incorrect', wantVersion));
		} else if (res.statusCode === 200) {
			debug('response status code: %d with headers: %j', res.statusCode, res.headers);

			var version = res.headers['x-appc-version'] || res.headers['x-amz-meta-version'],
				shasum = res.headers['x-appc-shasum'] || res.headers['x-amz-meta-shasum'],
				hash = require('crypto').createHash('sha1');

			hash.setEncoding('hex');

			debug('download version: %s, shasum: %s', version, shasum);

			if (!nobanner && !wantVersion) { util.okMessage(chalk.green(version)); }
			if (!nobanner && wantVersion) { util.okMessage(); }

			// check to see if we have it already installed and if we do, just continue
			if (!force && version) {
				var bin = util.getInstallBinary(null, version);
				if (bin) {
					return callback(null, null, version, bin);
				}
			}

			var total = parseInt(res.headers['content-length'], 10);
			debug('download content-length: %d', total);

			if (!total) {
				return callback(errorlib.createError('com.appcelerator.install.download.invalid.content.length'));
			}

			bar = (!nobanner && process.stdout.isTTY && !process.env.TRAVIS) &&
				new ProgressBar('Downloading [:bar] :percent :etas', {
					complete: util.isWindows() ? '█' : chalk.green('▤'),
					incomplete: ' ',
					width: Math.max(40, Math.round(process.stdout.columns / 2)),
					total: total,
					clear: true,
					stream: process.stdout
				});
			var count = 0,
				tickCount = 0,
				tickDiff = total * 0.01;

			util.stopSpinner();

			if (!bar) {
				util.waitMessage('Downloading ');
			}

			res.on('data', function (chunk) {
				if (chunk.length) {
					if (bar) {
						tickCount += chunk.length;
						if (tickCount > tickDiff) {
							bar.tick(tickCount);
							tickCount = 0;
						}
					}
					stream.write(chunk);
					hash.update(chunk);
					count += chunk.length;
				}
			});

			res.on('error', function (err) {
				debug('download error %o', err);
				try {
					stream.end();
				}
				catch (E) {
				}
				pendingRequest = null;
				callback(errorlib.createError('com.appcelerator.install.download.server.stream.error', err.message));
			});

			res.on('end', function () {
				debug('download end');
				if (bar) { bar.tick(tickCount); }
				stream.end();
				pendingRequest = null;
				// check to make sure we downloaded all the bytes we needed too
				// if not, this means the download failed and we should attempt to re-start it
				if (count !== total) {
					debug('download max retry');
					if (bar) {
						bar.terminate();
						util.resetLine();
					}
					stream.end();
					if (retryAttempts >= MAX_RETRIES) {
						return callback(errorlib.createError('com.appcelerator.install.download.failed.retries.max', retryAttempts));
					}
					// re-open stream
					stream = fs.createWriteStream(tmpfile);
					var delay = retryAttempts * 2000;
					// download failed, we should re-start
					return setTimeout(function () {
						download(force, wantVersion, tmpfile, stream, location, callback, true, retryAttempts + 1);
					}, delay);
				}
				hash.end();
				var checkshasum = hash.read();
				debug('download checkshasum: %s', checkshasum);
				// our downloaded file checksum should match what we uploaded, if not, this is a security violation
				if (checkshasum !== shasum) {
					return callback(errorlib.createError('com.appcelerator.install.download.failed.checksum', shasum, checkshasum));
				} else {
					if (!quiet) {
						util.infoMessage('Validating security checksum ' + chalk.green(util.isWindows() ? 'OK' : '✓'));
					}
				}
				process.nextTick(function () {
					callback(null, tmpfile, version);
				});
			});
		} else if (/^(408|500|503)$/.test(String(res.statusCode))) {
			// some sort of error on the server, let's re-try again ...
			// 408 is a server timeout
			// 500 is a server error
			// 503 is a server unavailable. this could be a deployment in progress
			debug('download server error ... will retry');
			stream.end();
			if (bar) { util.resetLine(); }
			pendingRequest = null;
			if (retryAttempts >= MAX_RETRIES) {
				debug('download server error ... maxed out after %d attempts', retryAttempts);
				return callback(errorlib.createError('com.appcelerator.install.download.server.unavailable'));
			}
			var delay = retryAttempts * 500;
			debug('download server error ... retry delay %d ms', delay);
			stream = fs.createWriteStream(tmpfile);
			return setTimeout(function () {
				download(quiet, force, wantVersion, tmpfile, stream, location, callback, true, retryAttempts + 1);
			}, delay);
		} else {
			debug('download server unexpected error %d', res.statusCode);
			stream.end();
			if (bar) { util.resetLine(); }
			pendingRequest = null;
			return callback(errorlib.createError('com.appcelerator.install.download.server.response.unexpected', res.statusCode));
		}
	});
}

exports.start = function (quiet, banner, force, location, wantVersion, callback) {
	var tmpfile = path.join(tmpdir, 'appc-' + (+new Date()) + '.tar.gz'),
		stream = fs.createWriteStream(tmpfile),
		exitFn,
		sigintFn,
		pendingAbort,
		createCleanup = function createCleanup(name) {
			return function (exit) {
				if (pendingRequest) {
					try {
						// abort the pending HTTP request so it will
						// close the server socket
						pendingRequest.abort();
					}
					catch (E) {
					}
					pendingRequest = null;
				}
				try {
					if (fs.existSync(tmpfile)) {
						fs.unlinkSync(tmpfile);
					}
				}
				catch (E) {
				}
				if (name === 'SIGINT') {
					pendingAbort = true;
					process.removeListener('SIGINT', sigintFn);
					util.abortMessage('Download');
				} else if (name === 'exit') {
					process.removeListener('exit', exitFn);
					if (!pendingAbort) {
						process.exit(exit);
					}
				} else {
					process.removeListener('exit', exitFn);
					process.removeListener('SIGINT', sigintFn);
				}
			};
		};

	// make sure we remove the file on shutdown
	process.on('exit', (exitFn = createCleanup('exit')));
	process.on('SIGINT', (sigintFn = createCleanup('SIGINT')));

	// default banner is on for process downloads unless quiet or no banner
	quiet = quiet === undefined ? false : quiet;
	banner = (banner === undefined ? true : banner) && !(quiet);

	debug('download start, quiet %d, banner %d', quiet, banner);

	// run the download
	download(quiet, force, wantVersion, tmpfile, stream, location, function () {
		// remove clean listeners
		createCleanup('done')();
		// carry on... 🙏
		return callback.apply(null, arguments);
	}, !banner);
};
