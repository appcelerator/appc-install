/**
 * This code is closed source and Confidential and Proprietary to
 * Appcelerator, Inc. All Rights Reserved.  This code MUST not be
 * modified, copied or otherwise redistributed without express
 * written permission of Appcelerator. This file is licensed as
 * part of the Appcelerator Platform and governed under the terms
 * of the Appcelerator license agreement.
 */
var u = require('../lib/util'),
	appcRemove = require('../lib/remove'),
	should = require('should'),
	path = require('path'),
	tmpdir = require('os').tmpdir();

var INSTALLVERSIONS = [
	'5.0.1-5',
	'5.0.1',
	'5.0.0-12',
	'5.0.0-55',
	'5.0.0-23',
	'4.2.0',
	'4.2.0-44',
	'4.2.0-6',
	'4.1.2',
	'4.1.0'
];
var ACTIVEVERSION = INSTALLVERSIONS[0];
var TMPINSTALL = path.join(tmpdir, 'appc-remove-test-' + Date.now());

u.getInstallDir = function getInstallDir() { return TMPINSTALL; };
u.getInstalledVersions = function getInstalledVersions () { return INSTALLVERSIONS; };
u.writeVersion = function writeVersion() {};
u.getActiveVersion = function getActiveVersion () { return ACTIVEVERSION; };

describe('appc remove', function() {

	it('exists', function () {
		should.exist(appcRemove);
		appcRemove.should.be.a.Function;
	});

	it('empty args', function (done) {
		appcRemove([], function (err, result) {
			should.not.exist(err);
			return done();
		});
	});

	it('remove all non-active', function (done) {
		appcRemove(['--all', '--force'], function (err, result) {
			should.not.exist(err);
			result.should.be.an.Array;
			result.should.with.lengthOf(INSTALLVERSIONS.length - 1);
			result.should.not.containEql(ACTIVEVERSION);
			return done();
		});
	});

	it('remove *-wildcard matched all non-active', function (done) {
		appcRemove(['--force', '*'], function (err, result) {
			should.not.exist(err);
			result.should.be.an.Array;
			result.should.with.lengthOf(INSTALLVERSIONS.length - 1);
			result.should.not.containEql(ACTIVEVERSION);
			return done();
		});
	});

	it('remove *-wildcard matched 5.*', function (done) {
		appcRemove(['--force', '5.*'], function (err, result) {
			should.not.exist(err);
			result.should.be.an.Array;
			result.should.with.lengthOf(4);
			result.should.not.containEql(ACTIVEVERSION);
			return done();
		});
	});

	it('remove *-wildcard matched 4.2.*', function (done) {
		appcRemove(['--force', '4.2.*'], function (err, result) {
			should.not.exist(err);
			result.should.be.an.Array;
			result.should.with.lengthOf(3);
			result.should.not.containEql(ACTIVEVERSION);
			return done();
		});
	});

	it('remove *-wildcard non-exist 3*', function (done) {
		appcRemove(['--force', '3*'], function (err, result) {
			should.not.exist(err);
			result.should.be.an.Array;
			result.should.with.lengthOf(0);
			return done();
		});
	});


	it('remove specific version ' + INSTALLVERSIONS[1], function (done) {
		appcRemove(['--force', INSTALLVERSIONS[1]], function (err, result) {
			should.not.exist(err);
			result.should.with.lengthOf(1);
			result.should.containEql(INSTALLVERSIONS[1]);
			return done();
		});
	});

	it('remove specific non-exist version: 0.1.1', function (done) {
		appcRemove(['--force', '0.1.1'], function (err, result) {
			should.not.exist(err);
			result.should.with.lengthOf(0);
			return done();
		});
	});

});
