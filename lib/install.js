// jscs:disable jsDoc
/**
 * This code is closed source and Confidential and Proprietary to
 * Appcelerator, Inc. All Rights Reserved.  This code MUST not be
 * modified, copied or otherwise redistributed without express
 * written permission of Appcelerator. This file is licensed as
 * part of the Appcelerator Platform and governed under the terms
 * of the Appcelerator license agreement.
 */
/**
 * download and install the appcelerator package
 */
var fs = require('fs'),
	path = require('path'),
	urllib = require('url'),
	download = require('./download'),
	util = require('./util'),
	errorlib = require('./error'),
	zlib = require('zlib'),
	tar = require('tar'),
	chalk = require('chalk'),
	debug = require('debug')('appc:install'),
	exec = require('child_process').exec;

/**
 * tar gunzip
 */
function targz(sourceFile, destination, callback) {
	debug('targz source=%s, dest=%s', sourceFile, destination);
	fs.createReadStream(sourceFile)
		.pipe(zlib.createGunzip())
		.pipe(tar.Extract({path: destination}))
		.on('error', function (err) { callback(err); })
		.on('end', function () { callback(null); });
}

/**
 * run the pre-flight check to check env for specific things we need
 */
function preflight(opts, callback) {

	var isWindows = util.isWindows();
	debug('preflight checks, is this windows? %d', isWindows);

	// don't allow running this as root (defeats the purpose of writing to the user-writable directory)
	if (!isWindows && (process.env.USER === 'root' || process.getuid() === 0)) {
		if (process.env.SUDO_USER) {
			debug('sudo user detected %s', process.env.SUDO_USER);
			return callback(errorlib.createError('com.appcelerator.install.installer.sudo', process.env.SUDO_USER));
		}
		debug('root user detected');
		return callback(errorlib.createError('com.appcelerator.install.installer.user.root'));
	} else if (!isWindows && (process.env.USERNAME === 'root' && process.env.SUDO_USER)) {
		// don't allow running as sudo from another user account.
		debug('root user detected %s', process.env.SUDO_USER);
		return callback(errorlib.createError('com.appcelerator.install.installer.user.sudo.user', process.env.SUDO_USER));
	}

	// check and make sure we actually have a home directory
	var homedir = util.getHomeDir();
	debug('home directory located at %s', homedir);
	if (!fs.existsSync(homedir)) {
		var envname = process.env.HOME ? 'HOME' : 'USERPROFILE';
		debug('cannot find the home directory');
		return callback(errorlib.createError('com.appcelerator.install.installer.missing.homedir', homedir, chalk.yellow('$' + envname)));
	}

	// make sure the user home directory its writable
	var error = util.checkDirectory(homedir, 'home');
	if (error) {
		debug('home directory isn\'t writable');
		return callback(error);
	}

	// make sure the install directory its writable
	var installDir = util.getInstallDir();
	error = util.checkDirectory(installDir, 'install');
	if (error) {
		debug('install directory isn\'t writable %s', installDir);
		return callback(error);
	}

	// check parent directory to make sure owned by the user
	error = util.checkDirectory(path.dirname(installDir), 'appcelerator');
	if (error) {
		debug('install directory isn\'t writable %s', path.dirname(installDir));
		return callback(error);
	}

	switch (process.platform) {
		case 'darwin':
			// must have Xcode tools to compile so let's check that
			return exec('xcode-select -p', function (err, stdout) {
				var exitCode = err && err.code;
				if (exitCode === 2) {
					debug('xcode-select says CLI tools not installed');
					// this means we don't have Xcode CLI tools, prompt to install it
					// you do this by trying to invoke gcc which will automatically install
					exec('gcc', function (err, stdout) {
						return callback(errorlib.createError('com.appcelerator.install.preflight.missing.xcode.clitools'));
					});
				} else {
					callback();
				}
			});
	}

	callback();
}

/**
 * tar gunzip our package into dir
 */
function extract(quiet, filename, dir, callback, attempts) {
	debug('calling extract on %s, dir=%s', filename, dir);
	attempts = attempts || 0;
	if (!quiet) { util.waitMessage('Installing '); }
	util.ensureDir(dir);
	var error = util.checkDirectory(dir, 'install');
	if (error) {
		debug('extract error %s', error);
		return callback(new Error(error));
	}
	targz(filename, dir, function (err) {
		// let errors fail through and attempt to do it again. we seem to have
		// failures ocassionally on extraction
		var pkg = path.join(dir, 'package', 'package.json');
		if (fs.existsSync(pkg)) {
			util.okMessage();
			return callback(null, filename, dir);
		} else {
			debug('after extraction, package.json not found at %s', pkg);
			if (attempts < 3) {
				// reset the line since it will be in the Installing... spinner state
				util.resetLine();
				// delete the directory since stale directories cause issues
				util.rmdirSyncRecursive(dir);
				//console.log('extraction failed, attempting again',attempts+1);
				extract(quiet, filename, dir, callback, attempts + 1);
			} else {
				debug('extract failed after %d attempts', attempts);
				callback(errorlib.createError('com.appcelerator.install.installer.extraction.failed'));
			}
		}
	});
}

/**
 * find all native compiled modules. the publish command detected any npm modules that had a native
 * compiled library and marked it by creating an empty file .nativecompiled during tar.gz.  we are going
 * to find all those specific modules and then re-install using npm so that they can be properly compiled
 * on the target platform during install.
 */
function findAllNativeModules(dir, check) {
	var dirs = [];
	fs.readdirSync(dir).forEach(function (name) {
		if (name === '.nativecompiled' && dirs.indexOf(dir) === -1 && (!check || check.indexOf(dir) < 0)) {
			dirs.push(dir);
		}
		var fn = path.join(dir, name);
		if (fs.existsSync(fn)) {
			try {
				var isDir = fs.statSync(fn).isDirectory();
				if (isDir) {
					dirs = dirs.concat(findAllNativeModules(fn, dirs));
				}
			}
			catch (e) {
				// ignore this. just means we're trying to follow a
				// bad symlink
				debug('findAllNativeModules encountered a likely symlink issue at %s, error was %o', fn, e);
			}
		}
	});
	return dirs;
}

/**
 * run npm install on all compiled native modules so that they will be
 * correctly compiled for the installed platform (vs. the platform we used to upload)
 */
function compileNativeModules(dir, callback) {
	debug('compileNativeModules %s', dir);
	process.nextTick(function () {
		var dirs = findAllNativeModules(dir),
			finished = 0;
		if (dirs.length) {
			util.waitMessage('Compiling platform native modules\n');
			// run them serially so we don't run into npm lock issues
			var doNext = function doNext() {
				var dir = dirs[finished++];
				if (dir) {
					var name = path.basename(dir),
						todir = path.dirname(dir),
						todirname = path.basename(path.dirname(todir)),
						installdir = path.join(dir, '..', '..'),
						version;
					/*jshint -W083 */
					if (fs.existsSync(dir)) {
						var pkg = path.join(dir, 'package.json');
						if (fs.existsSync(pkg)) {
							// make sure we install the exact version
							version = JSON.parse(fs.readFileSync(pkg)).version;
							debug('found version %s', version);
							version = '@' + version;
						}
						debug('rmdir %s', dir);
						util.rmdirSyncRecursive(dir);
					}
					var cmd = 'npm install ' + name + version + ' --production';
					debug('exec: %s in dir %s', cmd, installdir);
					util.waitMessage('└ ' + chalk.cyan(todirname + '/' + name) + ' ');
					exec(cmd, {cwd: installdir}, function (err, stdout, stderr) {
						if (err) {
							util.infoMessage('Failed to install ' + name + version + '; it may not support your current OS.');
							debug('error during %s, was: %o', cmd, err);
							debug('stdout: %s', stdout);
							debug('stderr: %s', stderr);
							doNext();
						} else {
							util.okMessage();
							doNext();
						}
					});
				} else {
					callback();
				}
			};
			doNext();
		} else {
			debug('none found');
			callback();
		}
	});
}

/**
 * start the install process
 */
function start(opts, callback) {

	// do our pre-flight checks
	preflight(opts, function (err) {

		// if we have pre-flight check failure, handle special
		if (err) {
			console.error(chalk.red('\n' + (err && err.message || String(err))));
			process.exit(1);
		}

		if (!opts.setup && !opts.quiet && (opts.banner === undefined || opts.banner)) {
			util.infoMessage(chalk.blue.underline.bold('Before you can continue, the latest Appcelerator software update needs to be downloaded.'));
			console.log();
		}

		callback(null, true);
	});
}

/**
 * run setup
 */
function runSetup(installBin, opts, cb) {
	var run = require('./index').run,
		found = util.parseArgs(opts);

	debug('runSetup called, found is %o', found);

	// if we didn't pass in anything or we explicitly called setup
	// then run it
	if (found.length === 0 || (found[0] === 'setup')) {
		var saved = process.argv.splice(2);
		process.argv[2] = 'setup';
		process.argv.length = 3;
		debug('calling run with %s', installBin);
		run(installBin, util.mergeOptsToArgs(['--no-banner'], opts));
	} else {
		// otherwise, we've called a different command and we should just run
		// it instead and skip the setup
		run(installBin, util.mergeOptsToArgs(['--no-banner'], opts));
	}
}

/**
 * run the install
 */
function install(installDir, opts, cb) {

	start(opts, function (err, result) {
		if (!result) {
			util.stopSpinner();
			if (!opts.quiet) { console.log('Cancelled!'); }
			process.exit(1);
		}

		// determine our registry url
		var wantVersion = opts.version || '',
			url = util.makeURL(opts, '/api/appc/install/' + wantVersion),
			bin = wantVersion && util.getInstallBinary(opts, wantVersion);

		debug('install, wantVersion: %s, url: %s, bin: %s', wantVersion, url, bin);

		// if already installed the version we're looking for, then we just need to continue
		if (bin && !opts.force) {
			debug('bin is setup and not force');
			if (!opts.quiet) { util.infoMessage('Version ' + chalk.green(wantVersion) + ' already installed.'); }
			return cb && cb(null, installDir, wantVersion, bin);
		}

		// check if setup command help is requested and bail out before the
		// download if we already have a version installed
		if (opts.setup && (opts.h || opts.help)) {
			var installBin = util.getInstallBinary();
			if (installBin) {
				return runSetup(installBin, opts, cb);
			}
		}

		// download the package
		download.start(opts.quiet, opts.banner, !!opts.force, url, wantVersion, function (err, filename, version, installBin) {
			if (err) { util.fail(err); }

			// we mark it as failed in case it gets interuppted before finishing
			var failed = true;

			// use this since below we are going to overwrite which might be null
			var installationDir = path.join(installDir, version);

			var sigIntFn, exitFn, pendingAbort;

			debug('after download, installationDir %s', installationDir);

			function createCleanup(name) {
				return function (exit) {
					if (failed) {
						var pkg = path.join(installationDir, 'package', 'package.json');
						if (fs.existsSync(pkg)) { fs.unlinkSync(pkg); }
					}
					// if exit, go ahead and exit with exitcode
					if (name === 'exit') {
						try {
							process.removeListener('exit', exitFn);
						}
						catch (e) {
							// this is OK
						}
						if (pendingAbort) {
							process.exit(exit);
						}
					} else if (failed) {
						// if failed and a SIGINT, force an exit
						pendingAbort = true;
						util.abortMessage('Install');
					}
					try {
						process.removeListener('SIGINT', sigIntFn);
					}
					catch (e) {
						// this is OK
					}
				};
			}

			// we need to hook and listen for an interruption and remove our package
			// in case the install is interrupted, we don't want a package that is partly installed
			process.on('SIGINT', (sigIntFn = createCleanup('SIGINT')));
			process.on('exit', (exitFn = createCleanup('exit')));

			util.stopSpinner();

			// ensure that we have our installation path
			installDir = util.ensureDir(path.join(installDir, version));

			// we already have it installed, just return
			if (installBin) {
				debug('installBin already found, returning %s', installBin);
				failed = false;
				createCleanup()();
				if (!opts.quiet) { util.infoMessage('Version ' + chalk.green(version) + ' already installed.'); }
				if (opts.setup) {
					util.writeVersion(version);
					return runSetup(installBin, opts, cb);
				}
				return cb && cb(null, installDir, version, installBin);
			}

			// add an install flag to indicate we're doing an install
			var installTag = util.getInstallTag();
			fs.writeFileSync(installTag, version);

			function cleanupInstall() {
				if (fs.existsSync(installTag)) {
					fs.unlinkSync(installTag);
				}
			}

			// extract it
			extract(opts.quiet, filename, installDir, function (err, filename, dir) {
				if (err) {
					cleanupInstall();
					util.fail(err);
				}

				// compile any native modules found
				compileNativeModules(dir, function (err) {

					if (err) {
						cleanupInstall();
						util.fail(err);
					}

					// point at the right version that we just downloaded
					installBin = util.getInstallBinary(opts, version);

					debug('after compileNativeModules, installBin is %s', installBin);

					// mark it as completed so we know we completed OK
					failed = false;

					// make the new version active
					if (opts.setup || opts.use) {
						util.writeVersion(version);
					}

					// remove up install tag file
					cleanupInstall();

					// if this is a setup, then run the setup after the install
					if (opts.setup) {
						debug('after compileNativeModules, setup is set');
						return runSetup(installBin, opts, cb);
					}

					var launchMessage = ' Launching... ' + (util.isWindows() ? '' : '🚀');

					if (!opts.quiet) { util.infoMessage(chalk.green.bold('Installed!!' + (!opts.use && !opts.setup ? launchMessage : ''))); }

					// write current process versions to package dir
					util.writeVersions(installDir);

					// if this is a use or setup, we don't run, we just return
					if (opts.use) { return cb && cb(null, installDir, version, installBin); }

					debug('running %s', installBin);

					// run it
					require('./index').run(installBin, ['--no-banner']);
				});
			});
		});

	});

}

module.exports = install;
