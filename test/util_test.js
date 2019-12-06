// jscs:disable jsDoc
/**
 * This code is closed source and Confidential and Proprietary to
 * Appcelerator, Inc. All Rights Reserved.  This code MUST not be
 * modified, copied or otherwise redistributed without express
 * written permission of Appcelerator. This file is licensed as
 * part of the Appcelerator Platform and governed under the terms
 * of the Appcelerator license agreement.
 */
var should = require('should'),
	fs = require('fs'),
	path = require('path'),
	chalk = require('chalk'),
	util = require('../lib/util');

describe('util', function () {

	afterEach(function () {
		delete process.env.APPC_REGISTRY_SERVER;
	});

	describe('should parseArgs', function () {

		it('as single arg', function () {
			process.argv = process.argv.slice(0, 2).concat([ 'foo' ]);
			var args = util.parseArgs({});
			should(args).containEql('foo');
			should(args).have.length(1);
		});

		it('as multiple args', function () {
			process.argv = process.argv.slice(0, 2).concat([ 'foo', 'bar' ]);
			var args = util.parseArgs({});
			should(args).containEql('foo');
			should(args).containEql('bar');
			should(args).have.length(2);
		});

		it('skip options after', function () {
			process.argv = process.argv.slice(0, 2).concat([ 'foo', '--bar' ]);
			var args = util.parseArgs({});
			should(args).containEql('foo');
			should(args).not.containEql('bar');
			should(args).have.length(1);
		});

		it('skip options before', function () {
			process.argv = process.argv.slice(0, 2).concat([ '--foo', 'bar' ]);
			var args = util.parseArgs({});
			should(args).not.containEql('foo');
			should(args).containEql('bar');
			should(args).have.length(1);
		});

	});

	describe('should parseOpts', function () {

		it('as boolean true', function () {
			process.argv = process.argv.slice(0, 2).concat([ '--foo' ]);
			var opts = util.parseOpts();
			should(opts).have.property('foo', true);
		});

		it('as string', function () {
			process.argv = process.argv.slice(0, 2).concat([ '--foo', 'true' ]);
			var opts = util.parseOpts();
			should(opts).have.property('foo', true);
		});

		it('as boolean false', function () {
			process.argv = process.argv.slice(0, 2).concat([ '--no-foo', false ]);
			var opts = util.parseOpts();
			should(opts).have.property('foo', false);
		});

		it('as multiple booleans true', function () {
			process.argv = process.argv.slice(0, 2).concat([ '--foo', '--bar' ]);
			var opts = util.parseOpts();
			should(opts).have.property('foo', true);
			should(opts).have.property('bar', true);
		});

		it('as boolean true using equal', function () {
			process.argv = process.argv.slice(0, 2).concat([ '--foo=true' ]);
			var opts = util.parseOpts();
			should(opts).have.property('foo', true);
		});

		it('as booleans using equal', function () {
			process.argv = process.argv.slice(0, 2).concat([ '--foo=true', '--bar=false' ]);
			var opts = util.parseOpts();
			should(opts).have.property('foo', true);
			should(opts).have.property('bar', false);
		});

		it('skip non-options', function () {
			process.argv = process.argv.slice(0, 2).concat([ 'foo' ]);
			var opts = util.parseOpts();
			should(opts).not.have.property('foo');
			should(Object.keys(opts)).have.length(0);
		});

		it('remove arg from version (with equal)', function () {
			process.argv = process.argv.slice(0, 2).concat([ '--version=0.0.117' ]);
			var opts = util.parseOpts();
			var args = util.parseArgs(opts);
			should(opts).have.property('version', '0.0.117');
			should(Object.keys(args)).have.length(0);
		});

		it('remove arg from version (without equal)', function () {
			process.argv = process.argv.slice(0, 2).concat([ '--version', '0.0.117' ]);
			var opts = util.parseOpts();
			var args = util.parseArgs(opts);
			should(opts).have.property('version', '0.0.117');
			should(Object.keys(args)).have.length(0);
		});

		it('support single dash (without equal)', function () {
			process.argv = process.argv.slice(0, 2).concat([ '-o', 'json' ]);
			var opts = util.parseOpts();
			var args = util.parseArgs(opts);
			should(opts).have.property('o', 'json');
			should(Object.keys(args)).have.length(0);
		});

		it('support single dash (with equal)', function () {
			process.argv = process.argv.slice(0, 2).concat([ '-o=json' ]);
			var opts = util.parseOpts();
			var args = util.parseArgs(opts);
			should(opts).have.property('o', 'json');
			should(Object.keys(args)).have.length(0);
		});

		it('support a flag followed by an arg', function () {
			process.argv = process.argv.slice(0, 2).concat([ '--no-prompt', 'latest' ]);
			var opts = util.parseOpts();
			var args = util.parseArgs(opts);
			should(opts).have.property('prompt', false);
			should(args).eql([ 'latest' ]);
		});

		it('not parse an option as an arg (short)', function () {
			process.argv = process.argv.slice(0, 2).concat([ '--prerelease', '-o', 'json' ]);
			var opts = util.parseOpts();
			var args = util.parseArgs(opts);
			should(opts).have.property('prerelease', true);
			should(opts).have.property('o', 'json');
			should(args).have.length(0);
		});

		it('not parse an option as an arg (long)', function () {
			process.argv = process.argv.slice(0, 2).concat([ '--prerelease', '--output', 'json' ]);
			var opts = util.parseOpts();
			var args = util.parseArgs(opts);
			should(opts).have.property('prerelease', true);
			should(opts).have.property('output', 'json');
			should(args).have.length(0);
		});
	});

	describe('should makeURL', function () {

		afterEach(function () {
			delete process.env.APPC_REGISTRY_SERVER;
			delete process.env.APPC_ENV;
			delete process.env.NODE_ENV;
		});

		it('parse using opts', function () {
			should(util.makeURL({ registry: 'http://foo' }, 'bar')).be.equal('http://foo/bar');
		});

		it('parse using env', function () {
			process.env.APPC_REGISTRY_SERVER = 'http://bar';
			should(util.makeURL(null, 'foo')).be.equal('http://bar/foo');
		});

		it('parse using default', function () {
			const originalReadConfig = util.readConfig;
			util.readConfig = function readConfig () {
				return null;
			};
			should(util.makeURL({}, 'foo')).be.equal('https://registry.platform.axway.com/foo');
			util.readConfig = originalReadConfig;
		});

	});

	describe('should expandPath', function () {

		it('to home', function () {
			var home = util.getHomeDir();
			var hp = util.expandPath('~');
			should(home).be.ok;
			should(hp).be.ok;
			should(home).equal(hp);
		});

		it('to home with leading slash', function () {
			var home = util.getHomeDir();
			var hp = util.expandPath('~/');
			should(home).be.ok;
			should(hp).be.ok;
			should(hp).equal(home + '/');
		});

	});

	describe('should pad', function () {

		it('if required', function () {
			var result = util.pad('a', 2);
			should(result).be.equal('a ');
		});

		it('if not required', function () {
			var result = util.pad('a', 1);
			should(result).be.equal('a');
		});

	});

	describe('should ensureDir', function () {

		var TMPDIR = './foo/bar/ok';

		function cleanup() {
			try {
				util.rmdirSyncRecursive(TMPDIR);
			} catch (E) {
			}
		}

		before(cleanup);
		after(cleanup);

		it('as needed', function () {
			util.ensureDir(TMPDIR);
			should(fs.existsSync(TMPDIR)).be.true;
		});

	});

	describe('should fail', function () {

		var exit = process.exit,
			error = console.error,
			tty = process.stdout.isTTY,
			enabled = chalk.enabled,
			code,
			message = '';

		function cleanup() {
			process.stdout.isTTY = tty;
			process.exit = exit;
			console.error = error;
			chalk.enabled = enabled;
			code = undefined;
			message = '';
		}

		function hook() {
			process.stdout.isTTY = false;
			process.exit = function (_code) {
				code = _code;
			};
			console.error = function () {
				message += Array.prototype.slice.call(arguments).join(' ') + '\n';
			};
		}

		beforeEach(hook);
		afterEach(cleanup);

		it('with exit code 1 (with color)', function () {
			util.fail('a');
			should(code).be.equal(1);
			should(message).be.equal('\n' + chalk.red('a') + '\n');
		});

		it('with exit code 1 (without color)', function () {
			chalk.enabled = false;
			util.fail('a');
			should(code).be.equal(1);
			should(message).be.equal('\na\n');
		});

	});

	describe('should canWriteDir', function () {

		if (process.platform === 'win32' || process.env.TRAVIS || process.env.JENKINS) {
			return;
		}
		this.timeout(30000);

		var exec = require('child_process').exec;

		var USERWRITABLE = {
				dir: './tmp-uw',
				perm: '0755',
				user: process.env.USER,
				result: true,
				message: 'user should be writable',
				skip: false
			},
			USERNOTWRITABLE = {
				dir: './tmp-unw',
				perm: '0755',
				user: 'root',
				result: false,
				message: 'user should not be writable',
				skip: false
			},
			GROUPWRITABLE = {
				dir: './tmp-gw',
				perm: '0770',
				user: 'root',
				result: true,
				message: 'group should be writable',
				skip: false
			},
			GROUPNOTWRITABLE = {
				dir: './tmp-gnw',
				perm: '0700',
				user: 'root',
				result: false,
				message: 'group should not be writable',
				skip: false
			},
			WORLDWRITABLE = {
				dir: './tmp-ww',
				perm: '0777',
				user: 'root',
				result: true,
				message: 'all should be writable',
				skip: false
			},
			WORLDNOTWRITABLE = {
				dir: './tmp-wnw',
				perm: '0700',
				user: 'root',
				result: false,
				message: 'all should not be writable',
				skip: false
			},
			DIRS = [ USERWRITABLE, USERNOTWRITABLE, GROUPWRITABLE, GROUPNOTWRITABLE, WORLDWRITABLE, WORLDNOTWRITABLE ];

		function makedirs(cb) {
			var index = 0;

			function makeNextDir() {
				var entry = DIRS[index++];
				if (entry) {
					try {
						if (!entry.skip) {
							var dirpath = path.join(__dirname, entry.dir),
								prefix = entry.user === 'root' ? 'sudo' : '',
								cmd = prefix + ' mkdir ' + dirpath + '; ' + prefix + ' chmod ' + entry.perm + ' ' + dirpath;
							// console.log(entry.message, '->', cmd);
							exec(cmd, makeNextDir);
						} else {
							makeNextDir();
						}
					} catch (e) {
						makeNextDir();
					}
				} else {
					cb();
				}
			}

			makeNextDir();
		}

		function cleanup(cb) {
			var index = 0;

			function deleteNextDir(err) {
				if (err) {
					console.error(err);
				}
				var entry = DIRS[index++];
				if (entry) {
					try {
						var dirpath = path.join(__dirname, entry.dir),
							cmd = 'sudo rm -rf ' + dirpath;
						// console.log(cmd);
						exec(cmd, deleteNextDir);
					} catch (e) {
						deleteNextDir();
					}
				} else {
					cb();
				}
			}

			deleteNextDir();
		}

		before(function (cb) {
			console.log(chalk.blue('this test requires sudo ... you may need to enter your root password below'));
			makedirs(cb);
		});

		after(cleanup);

		DIRS.forEach(function (entry) {
			(entry.skip ? it.skip : it)(entry.message, function () {
				var dirpath = path.join(__dirname, entry.dir);
				should(util.canWriteDir(dirpath)).be.equal(entry.result);
			});
		});

	});

	describe('registry', function () {
		this.timeout(30000);
		// This test is skipped because the functionality was removed in https://github.com/appcelerator/appc-install/commit/0180881f023fd30a44fbfd6f63eddc7cf5e05881
		// eslint-disable-next-line mocha/no-skipped-tests
		it.skip('should validate fingerprint', function (done) {
			util.getRequest().get(util.makeURL('/'), function (err, resp, body) {
				should(err).be.null;
				should(body).be.a.string;
				should(util.getRequest().getLastURL()).be.a.string;
				should(util.getRequest().getLastURL() + '/').be.eql(util.makeURL(''));
				done();
			});
		});

	});

	describe('utilities', function () {

		var stdOut,
			exit,
			state;

		before(function () {
			stdOut = util.stdout;
			exit = util.exit;
			util.stdout = {
				isTTY: true,
				write: function (contents) {
					state.written.push(contents);
				},
				clearLine: function () {
					state.cleared = true;
				},
				cursorTo: function (index) {
					state.cursorTo = index;
				}
			};
			util.exit = function (code) {
				state.exited = code;
			};
		});

		beforeEach(function () {
			state = {
				written: []
			};
		});

		afterEach(function () {
			util.stopSpinner();
		});

		after(function () {
			util.stdout = stdOut;
			util.exit = exit;
		});

		it('should waitMessage', function (next) {
			var msg = 'my wait message';
			util.waitMessage(msg);
			should(state.written[0]).eql(msg);
			should(state.written).have.property('length', 1);
			setTimeout(function () {
				if (!process.env.TRAVIS && !process.env.JENKINS) {
					should(state.written).have.property('length', 4);
				}
				next();
			}, 120);
		});

		it('should okMessage', function () {
			var msg = 'my ok message';
			util.okMessage(msg);
			should(state.written[0]).containEql(msg);
			util.okMessage();
			should(state.written[1]).be.ok;
			util.okMessage(false);
			should(state.written[2]).be.ok;
			should(state.written).have.property('length', 3);
		});

		it('should infoMessage', function () {
			var msg = 'my info message';
			util.infoMessage(msg);
			should(state.written[0]).containEql(msg);
			should(state.written).have.property('length', 1);
		});

		it('should abortMessage', function () {
			var msg = 'my abort message';
			util.abortMessage(msg);
			should(state.written[0]).containEql(msg);
			should(state.written).have.property('length', 1);
			should(state.cleared).eql(true);
			should(state.cursorTo).eql(0);
			should(state.exited).eql(1);
		});

		it('should resetLine', function () {
			util.resetLine();
			should(state.written).have.property('length', 0);
			should(state.cleared).eql(true);
			should(state.cursorTo).eql(0);
		});

		[
			'getAppcDir', 'getInstallTag', 'getCacheDir', 'getInstallDir', 'getActiveVersion',
			'getConfigFile', 'getNpmCacheDirectory', 'getRequest'
		].forEach(function (key) {
			it('should ' + key, function () {
				var val = util[key]();
				should(val).be.ok;
			});
		});

		it('should request', function (next) {
			this.timeout(10000);
			util.request('http://www.appcelerator.com/', function (err, res, req) {
				if (err) {
					throw err;
				}
				should(res).be.ok;
				next();
			});
		});

		(!process.env.TRAVIS ? it : it.skip)('should updateCheck show msg', function (next) {
			var config = util.readConfig() || {};
			config.lastUpdateCheck = 0;
			util.setCachedConfig(config);

			var requestJSONBackup = util.requestJSON,
				getActiveVersionBackup = util.getActiveVersion,
				getInstallBinaryBackup = util.getInstallBinary;

			util.requestJSON = function (location, callback) {
				var result = {
					success: true,
					'request-id': '11111',
					key: 'result',
					result: [
						{ id: '571963934b62fb090c4e1839',
							filesize: 57642403,
							shasum: 'd6967f57b3c6ac75250b18f3e75a987bd46b79b5',
							version: '5.3.0-34' },
						{ id: '56c4a74351f034ed6cf53ba4',
							filesize: 46058894,
							shasum: 'cb5be98a2eb288eb5c9245b273a0a544205a365e',
							version: '5.2.0-265' },
						{ id: '5702ee064b62fb09142bc8f2',
							filesize: 53189069,
							shasum: 'c1cb6043807158678ed2d677b6bcd33f1cea9ff3',
							version: '5.2.2' }
					]
				};
				return callback(null, result);
			};

			util.getActiveVersion = function () {
				return '5.2.2';
			};

			util.getInstallBinary = function () {
				return null;
			};

			util.updateCheck({}, function (err, res, req) {
				should(state.written[0]).containEql('A new update');
				util.requestJSON = requestJSONBackup;
				util.getActiveVersion = getActiveVersionBackup;
				util.getInstallBinary = getInstallBinaryBackup;
				next();
			});
		});

		(!process.env.TRAVIS ? it : it.skip)('should updateCheck do not show msg', function (next) {
			var config = util.readConfig() || {};
			config.lastUpdateCheck = 0;
			util.setCachedConfig(config);

			var requestJSONBackup = util.requestJSON,
				getActiveVersionBackup = util.getActiveVersion,
				getInstallBinaryBackup = util.getInstallBinary;

			util.requestJSON = function (location, callback) {
				var result = {
					success: true,
					'request-id': '11111',
					key: 'result',
					result: [
						{ id: '571963934b62fb090c4e1839',
							filesize: 57642403,
							shasum: 'd6967f57b3c6ac75250b18f3e75a987bd46b79b5',
							version: '5.3.0-34' },
						{ id: '56c4a74351f034ed6cf53ba4',
							filesize: 46058894,
							shasum: 'cb5be98a2eb288eb5c9245b273a0a544205a365e',
							version: '5.2.0-265' },
						{ id: '5702ee064b62fb09142bc8f2',
							filesize: 53189069,
							shasum: 'c1cb6043807158678ed2d677b6bcd33f1cea9ff3',
							version: '5.2.2' }
					]
				};
				return callback(null, result);
			};

			util.getActiveVersion = function () {
				return '5.3.0-36';
			};

			util.getInstallBinary = function () {
				return null;
			};

			util.updateCheck({}, function (err, res, req) {
				should(state.written[0]).eql(undefined);
				util.requestJSON = requestJSONBackup;
				util.getActiveVersion = getActiveVersionBackup;
				util.getInstallBinary = getInstallBinaryBackup;
				next();
			});
		});

		it('should mergeOptsToArgs', function () {
			var args = [];
			process.__argv = [ 0, 1, 2, 3, 4, 5, 6 ];
			util.mergeOptsToArgs(args);
			should(args).be.ok;
			should(args).eql([ 3, 4, 5, 6 ]);

			args = [];
			process.__argv = [ 0, 1, 2 ];
			util.mergeOptsToArgs(args);
			should(args).be.ok;
			should(args).eql([]);
		});

	});

	describe('should getProxyServer', function () {
		var proxy;

		it('no config proxyServer', function () {
			proxy = util.getProxyServer({});
			should(proxy).not.be.ok;
		});

		it('config proxyServer empty value', function () {
			proxy = util.getProxyServer({ proxyServer: '' });
			should(proxy).not.be.ok;
		});

		it('config proxyServer null domain', function () {
			proxy = util.getProxyServer({ proxyServer: 'https://null' });
			should(proxy).not.be.ok;
		});

		it('config proxyServer no protocol', function () {
			proxy = util.getProxyServer({ proxyServer: 'random.proxy' });
			should(proxy).not.be.ok;
		});

		it('exist config proxyServer', function () {
			var addr = 'http://localhost';
			proxy = util.getProxyServer({ proxyServer: addr });
			should(proxy).be.exactly(addr);
		});
	});

	describe('should getStrictSSL', function () {
		var strictssl;

		it('no config strictSSL', function () {
			strictssl = util.getStrictSSL({});
			should(strictssl).not.be.ok;
		});

		it('config strictSSL empty value', function () {
			strictssl = util.getStrictSSL({ strictSSL: '' });
			should(strictssl).not.be.ok;
		});

		it('config strictSSL null value', function () {
			strictssl = util.getStrictSSL({ strictSSL: null });
			should(strictssl).not.be.ok;
		});

		it('config strictSSL undefined value', function () {
			strictssl = util.getStrictSSL({ strictSSL: undefined });
			should(strictssl).not.be.ok;
		});

		it('config strictSSL TRUE value', function () {
			strictssl = util.getStrictSSL({ strictSSL: true });
			should(strictssl).be.exactly(true);
		});

		it('config strictSSL FALSE value', function () {
			strictssl = util.getStrictSSL({ strictSSL: false });
			should(strictssl).be.exactly(false);
		});
	});

	describe('should getCAfile', function () {
		var caFile;

		it('no config getCAfile', function () {
			caFile = util.getCAfile({});
			should(caFile).not.be.ok;
		});

		it('config getCAfile empty value', function () {
			caFile = util.getCAfile({ cafile: '' });
			should(caFile).not.be.ok;
		});

		it('config getCAfile null value', function () {
			caFile = util.getCAfile({ cafile: null });
			should(caFile).not.be.ok;
		});

		it('config getCAfile undefined value', function () {
			caFile = util.getCAfile({ cafile: undefined });
			should(caFile).not.be.ok;
		});

		it('config getCAfile value exists', function () {
			var mock = path.resolve('./test/mocks/mockca.pem');
			caFile = util.getCAfile({ cafile: mock });
			should(caFile).be.exactly(mock);
		});
	});

});
