/**
 * This code is closed source and Confidential and Proprietary to
 * Appcelerator, Inc. All Rights Reserved.  This code MUST not be
 * modified, copied or otherwise redistributed without express
 * written permission of Appcelerator. This file is licensed as
 * part of the Appcelerator Platform and governed under the terms
 * of the Appcelerator license agreement.
 */
/* jshint esnext: true */
var util = require('util'),
	u = require('./util'),
	chalk = require('chalk'),
	debug = require('debug')('appc:error');

/**
 * create a custom error so we can get proper error code
 * @param {string} message - The error message.
 * @param {string} id - The ID for the error.
 */
function AppCError(message, id) {
	Error.call(this);
	Error.captureStackTrace(this, AppCError);
	this.id = id;
	this.name = 'AppCError';
	this.message = message;
	debug('creating AppCError %s, %s', message, id);
}
util.inherits(AppCError, Error);

/**
 * print stack trace and exit with failure
 */
AppCError.prototype.failWithStackTrace = function () {
	u.fail(this.message + chalk.grey(' [' + this.id + ']'));
};

const ERRORS = {
	'com.appcelerator.install.binary.missing': {
		message: 'Cannot find expected binary at %s. '
		+ 'This likely means the install package at %s is invalid for version %s',
		argcount: 3
	},
	'com.appcelerator.install.binary.error': {
		message: 'Unexpected error running %s. %s',
		argcount: 2
	},
	'com.appcelerator.install.download.server.response.error': {
		message: 'Server responded with unexpected error: %s. Please re-try your install again. '
		+ 'If you continue to have this problem, please contact Appcelerator Support at support@appcelerator.com.',
		argcount: 1
	},
	'com.appcelerator.install.download.server.stream.error': {
		message: 'Unexpected error received during download. %s. Please re-try your install again. '
		+ 'If you continue to have this problem, please contact Appcelerator Support at support@appcelerator.com.',
		argcount: 1
	},
	'com.appcelerator.install.download.version.specified.incorrect': {
		message: 'The version specified %s was not found',
		argcount: 1
	},
	'com.appcelerator.install.download.invalid.content.length': {
		message: 'Received invalid response from download server (content-length was not set). '
		+ 'Please re-try your install again.'
	},
	'com.appcelerator.install.download.failed.retries.max': {
		message: 'Download failed after %d failed re-attempts. '
		+ 'Please re-try your install again in a few moments. If you continue to have this problem, please contact Appcelerator Support at support@appcelerator.com.',
		argcount: 1
	},
	'com.appcelerator.install.download.failed.checksum': {
		message: 'Invalid file download checksum. '
		+ 'This could be a result of the file being modified in transit or it could be because the download was interrupted or had an error. Expected: %s, was: %s. Please re-try this install again.',
		argcount: 2
	},
	'com.appcelerator.install.download.server.unavailable': {
		message: 'Download server is not currently available. '
		+ 'Please re-try your install again in a few moments. '
		+ 'If you continue to have this problem, please contact Appcelerator Support at support@appcelerator.com.'
	},
	'com.appcelerator.install.download.server.response.unexpected': {
		message: 'Unexpected response returned from server (%d). '
		+ 'Please re-try your install again.',
		argcount: 1
	},
	'com.appcelerator.install.installer.sudo': {
		message: 'Ooops! You cannot run using sudo. Please re-run using the %d account.',
		argcount: 1
	},
	'com.appcelerator.install.installer.user.root': {
		message: 'Ooops! You cannot run as root. Please re-run using a user account.'
	},
	'com.appcelerator.install.installer.user.sudo.user': {
		message: 'Ooops! You cannot run using sudo as another user. '
		+ 'Please re-run using the %s account.',
		argcount: 1
	},
	'com.appcelerator.install.installer.missing.homedir': {
		message: 'Ooops! Your home directory (%s) cannot be found. '
		+ 'Please make sure that the environment variable %s is set correctly to the correct directory and that it is writable.',
		argcount: 2
	},
	'com.appcelerator.install.installer.extraction.failed': {
		message: 'Download file extraction failed. Please re-run again.'
	},
	'com.appcelerator.install.preflight.directory.unwritable': {
		message: 'Ooops! Your %s directory (%s) is not writable.\n%s',
		argcount: 3
	},
	'com.appcelerator.install.preflight.directory.ownership': {
		message: 'Ooops! Your %s directory (%s) is not owned by %s.\n%s',
		argcount: 4
	},
	'com.appcelerator.install.preflight.missing.xcode.clitools': {
		message: 'Xcode command line developers tools are required. '
		+ 'Choose an option in the dialog to download the command line developer tools. '
		+ 'Once you have completed the installation, please re-run this command.'
	},
	'com.appcelerator.install.use.download.error': {
		message: 'Unexpected error received fetching latest version details. %s Please re-try your request again. '
		+ 'If you continue to have this problem, please contact Appcelerator Support at support@appcelerator.com.',
		argcount: 1
	}
};

/**
 * construct the proper error message
 * @param {string} errorcode - The errorcode for the error.
 * @returns {string}
 */
function createErrorMessage(errorcode) {
	if (errorcode in ERRORS) {
		var args = Array.prototype.slice.call(arguments, 1);
		var entry = ERRORS[errorcode];
		if (entry.argcount && entry.argcount !== args.length) {
			u.fail('Internal failure. Unexpected usage of internal command. Please report error code: ' + errorcode + '(invalid args) '
				+ 'to Appcelerator Support with the following stack trace:' + new Error().stack);
		}
		return args.length ? util.format.apply(util.format, [ entry.message ].concat(args)) : entry.message;
	} else {
		u.fail('Internal failure. Unexpected usage of internal command. Please report error code: ' + errorcode + '(invalid error code) '
			+ 'to Appcelerator Support with the following stack trace:' + new Error().stack);
	}
}

/**
 * fail with an error (console.error + exitcode 1)
 * @param {string} errorcode - The errorcode for the error.
 */
exports.failWithError = function (errorcode) {
	var message = createErrorMessage.apply(null, arguments);
	if (message) {
		u.fail(message + chalk.grey(' [' + errorcode + ']'));
	}
};

/**
 * create an AppCError error class and return an instance
 * @param {string} errorcode - The errorcode for the error.
 * @returns {AppCError}
 */
exports.createError = function (errorcode) {
	var message = createErrorMessage.apply(null, arguments);
	if (message) {
		return new AppCError(message, errorcode);
	}
};

exports.ERRORS = ERRORS;
