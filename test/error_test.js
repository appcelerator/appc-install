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
	_ = require('lodash'),
	u = require('../lib/util'),
	util = require('util'),
	chalk = require('chalk'),
	errorlib = require('../lib/error');

describe('error', function () {

	var failure = '',
		exit;

	beforeEach(function () {
		process._exit = process.exit;
		process.exit = function (code) {
			// console.log('exit',code);
			exit = code;
		};
		console._error = console.error;
		console.error = function (msg) {
			// console.log('error',msg);
			failure += msg + '\n';
		};
	});

	afterEach(function () {
		if (process._exit) {
			process.exit = process._exit;
			process._exit = null;
		}
		if (console._error) {
			console.error = console._error;
			console._error = null;
		}
		failure = '';
		exit = null;
	});

	describe('failures', function () {

		it('internal failure on bad error code for createError', function () {
			var error = errorlib.createError('invalid');
			should(exit).be.equal(1);
			should(failure).match(/Internal failure. Unexpected usage of internal command. Please report error code: invalid/);
		});

		it('internal failure on bad error code for failWithError', function () {
			var error = errorlib.failWithError('invalid');
			should(exit).be.equal(1);
			should(failure).match(/Internal failure. Unexpected usage of internal command. Please report error code: invalid/);
		});

		it('missing parameters', function () {
			var error = errorlib.createError('com.appcelerator.install.binary.missing');
			should(exit).be.equal(1);
			should(failure).match(/Internal failure. Unexpected usage of internal command. Please report error code: com.appcelerator.install.binary.missing\(invalid args\)/);
		});

	});

	describe('errorcodes', function () {

		// replace args with these placeholders
		var alpha = [ 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z' ];

		function makeArgs(count) {
			return _.clone(alpha).slice(0, count);
		}

		Object.keys(errorlib.ERRORS).forEach(function (errorcode) {
			var error = errorlib.ERRORS[errorcode];
			it(errorcode + ' using Error', function () {
				var argcount = error.argcount || 0;
				var args = makeArgs(argcount);
				var err = errorlib.createError.apply(errorlib, [ errorcode ].concat(args));
				should(err).be.an.object;
				var message = util.format.apply(null, [ error.message ].concat(args));
				should(message).be.equal(err.message);
				should(err.id).equal(errorcode);
				should(err.name).equal('AppCError');
				should(err instanceof Error).be.true;
			});
			it(errorcode + ' using fail', function () {
				var argcount = error.argcount || 0;
				var args = makeArgs(argcount);
				var err = errorlib.createError.apply(errorlib, [ errorcode ].concat(args));
				should(err).be.an.object;
				var message = util.format.apply(null, [ error.message ].concat(args));
				u.fail(err);
				should(exit).be.equal(1);
				should(chalk.stripColor(failure.trim())).equal(message);
			});
			it(errorcode + ' using failWithError', function () {
				var argcount = error.argcount || 0;
				var args = makeArgs(argcount);
				var err = errorlib.failWithError.apply(errorlib, [ errorcode ].concat(args));
				should(err).be.an.object;
				var message = util.format.apply(null, [ error.message ].concat(args));
				should(exit).be.equal(1);
				should(chalk.stripColor(failure.trim())).equal(message + ' [' + errorcode + ']');
			});
		});

	});

});
