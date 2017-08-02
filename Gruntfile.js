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
	_ = require('lodash');

module.exports = function (grunt) {

	var source = ['bin/appc', 'index.js', 'lib/**/*.js', 'test/**/*.js'];
	var tests = ['test/**/*_test.js'];
	// var tests = ['test/**/use_test.js'];

	// Project configuration.
	grunt.initConfig({
		appcJs: {
			check: {
				src: source
			}
		},
		bump: {
			options: {
				files: ['package.json'],
				commitFiles: ['package.json'],
				pushTo: 'appcelerator'
			}
		},
		clean: {
			test: ['tmp', 'test/fixtures/.appc-registry', 'problem.log'],
			cover: ['coverage']
		},
		env: {
			dev: {
				APPC_TEST: '1'
			}
		},
		mocha_istanbul: {
			coverage: {
				src: tests,
				options: {
					timeout: 3000,
					ignoreLeaks: false,
					globals: [
						'requestSSLHooks',
						'requestSSLFingerprints'
					],
					mochaOptions: ['--bail'],
					reporter: 'mocha-jenkins-reporter',
					check: {
						statements: 50,
						branches: 25,
						functions: 50,
						lines: 50
					}
				}
			}
		}
	});

	// Load grunt plugins for modules
	grunt.loadNpmTasks('grunt-appc-js');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-env');
	grunt.loadNpmTasks('grunt-mocha-istanbul');

	grunt.registerTask('default', ['clean:test', 'appcJs:check', 'env:dev', 'mocha_istanbul:coverage']);
};
