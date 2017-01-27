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
	util = require('../lib/util'),
	uselib = require('../lib/use');

var requestJSONBackup = util.requestJSON;
var processArgvBackup = process.argv;
var processExitBackup = process.exit;

var latestResult = {
	success: true,
	'request-id': '9ff',
	key: 'result',
	result: [{id: '55',
		name: 'appc-cli/appcelerator',
		version: '5.1.0'}]
};

var listResult = {
	success: true,
	'request-id': '9ff',
	key: 'result',
	result: [{id: '55',
		name: 'appc-cli/appcelerator',
		version: '5.0.0'}]
};

util.requestJSON = function (location, callback) {
	var result = {};

	if (typeof(location) === 'object') {
		location = location.url;
	}

	if (/latest/.test(location)) {
		result = latestResult;
	} else if (/list/.test(location)) {
		result = listResult;
	}
	return callback(null, result);
};

describe('use', function () {
	after(function () {
		// reset all
		process.argv = processArgvBackup;
		process.exit = processExitBackup;
		util.requestJSON = requestJSONBackup;
	});

	it('use - list returns none empty array', function (done) {
		process.exit = done;
		process.argv = ['node', 'appc', 'use'];
		uselib({});
	});

	it('use - list returns empty array', function (done) {
		listResult = {
			success: true,
			'request-id': '9ff',
			key: 'result',
			result: []
		};
		process.exit = done;
		process.argv = ['node', 'appc', 'use'];
		uselib({});
	});
});
