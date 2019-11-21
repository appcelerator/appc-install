/**
 * This code is closed source and Confidential and Proprietary to
 * Appcelerator, Inc. All Rights Reserved.  This code MUST not be
 * modified, copied or otherwise redistributed without express
 * written permission of Appcelerator. This file is licensed as
 * part of the Appcelerator Platform and governed under the terms
 * of the Appcelerator license agreement.
 */
var debug = require('debug')('appc:run');
/**
 * run the real appc binary by setting up the correct environment location
 * and then delegate directly (via a spawn) to the real appc binary in our package
 * @param {string} installBin - Installation binary to run
 * @param {string[]} additionalArgs - Array of additional args to pass along
 * @param {function} cb - Function to call when complete
 * @param {boolean} dontexit - Do not exit after process has finished
 */
function run(installBin, additionalArgs, cb, dontexit) {
	var async = require('async'),
		chalk = require('chalk'),
		spawn = require('child_process').spawn, // eslint-disable-line security/detect-child-process
		path = require('path'),
		fs = require('fs'),
		util = require('./util'),
		isWin = /^win/.test(process.platform);

	// append any incoming program args
	var args = [ installBin ].concat(process.argv.splice(2));

	// add any additional args
	if (additionalArgs) {
		args = args.concat(additionalArgs);
	}

	// get the environment
	var env = process.env;

	// setup our node environment by first appending our appc node_modules
	env.NODE_PATH = path.resolve(path.join(path.dirname(installBin), '..', 'node_modules')) + path.delimiter
	// and then our global cache directory
		+ path.join(util.getCacheDir(), 'node_modules') + path.delimiter
	// then pickup any paths already setup in our env
		+ (env.NODE_PATH || '');

	debug('run with env=%j, args=%o', env, args);

	async.series([
		function (next) {
			var packageDir = path.join(installBin, '..', '..'),
				isJSON = args.indexOf('json') !== -1,
				rebuildOpts = { stdio: 'ignore', cwd: packageDir },
				child;

			debug('run check package modules version');
			if (installBin && util.isModuleVersionChanged(installBin)) {
				util.outputInfo(chalk.yellow('\nYou are attempting to run appc '
					+ util.getActiveVersion()
					+ ' which was compiled for node '
					+ util.getPackageNodeVersion(installBin)
					+ ' but you are now running node ' + process.version + '\n'), isJSON);
				util.outputInfo(chalk.yellow('Rebuilding package modules ...\n'), isJSON);

				debug('exec: npm rebuild in dir %s', packageDir);
				if (/^win/.test(process.platform)) {
					child = spawn(process.env.comspec, [ '/c', 'npm' ].concat([ 'rebuild' ]), rebuildOpts);
				} else {
					child = spawn('npm', [ 'rebuild' ], rebuildOpts);
				}

				child.on('exit', function (exit) {
					if (exit === 0) {
						// update node version
						util.writeVersions(path.join(packageDir, '..'));
						util.outputInfo(chalk.yellow('Package modules rebuilt!\n'), isJSON);
					} else {
						util.outputInfo(chalk.yellow('The rebuild was unsuccessful, please run the following command to re-build for the newer version:\n'), isJSON);
						util.outputInfo(chalk.green('appc use ' + util.getActiveVersion() + ' --force\n'), isJSON);
					}
					next();
				});
			} else {
				next();
			}
		},
		function (next) {
			// check that this version of the cli supports the currently selected node version

			const packageJsonLocation = path.join(installBin, '..', '..', 'package.json');
			if (!fs.existsSync(packageJsonLocation)) {
				next();
			}
			try {
				const packageJson = require(packageJsonLocation);
				if (!packageJson.engines || !packageJson.engines.node) {
					return next();
				}

				util.checkNodeVersion(packageJson.engines.node);
			} catch (e) { /* squash */ }

			next();

		},
		function (next) {
			// create our child process which simply inherits this process stdio
			var child = spawn(process.execPath, args, { env: env, stdio: 'inherit' });

			// on exit of child, exit ourselves with same exit code
			child.on('close', function (code) {
				next(null, code);
			});

			// propagate signals to child process
			[ 'SIGTERM', 'SIGUSR1', 'SIGUSR2', 'SIGINT', 'SIGHUP', 'SIGQUIT', 'SIGABRT', 'exit' ].forEach(function (name) {
				process.on(name, function (code) {
					// Windows does not support sending signals
					if (!isWin) {
						// Wait until the child could safely handle it's own cleanup and prevent the main
						// process to remain alive, mainly because the child wasn't able to leave on time
						debug('signal received', name, 'code:', code, ', sending to', child);
						if (name === 'exit') {
							child.kill();
							process.exit(Array.isArray(code) ? code[code.length - 1] : code);
						} else {
							child.kill(name);
						}
					}
				});
			});
		}
	], function (error, results) {
		if (cb) {
			cb(results);
		}
		if (!dontexit) {
			process.exit(Array.isArray(results) ? results[results.length - 1] : results);
		}
	});
}

module.exports = run;
