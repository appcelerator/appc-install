# Appcelerator Installer [![Build Status](https://travis-ci.org/appcelerator/appc-install.svg?branch=master)](https://travis-ci.org/appcelerator/appc-install) [![npm version](https://badge.fury.io/js/appcelerator.svg)](http://badge.fury.io/js/appcelerator)

This is the installer for the Appcelerator Platform software stack.

## Installation

Install globally using npm such as (if using Windows, don't use sudo prefix):

```bash
$ [sudo] npm install appcelerator -g
```

This adds two binary executable commands: `appcelerator` or the shortcut `appc`.

Once installed, you should run setup such as:

```bash
$ appc setup
```

This will install the latest version of the Appcelerator Platform tooling.  Once installed, you can then run the various commands.  To get a valid list of commands, run help:

```bash
$ appc help
```

## Switching Versions

By default, the latest downloaded version will be used.  You can switch to a newer or older version with the use command:

```bash
$ appc use 1.2.0
```

This will switch the active version to 1.2.0.  If you don't have this version installed locally, it will fetch this version and download it.

To get a list of all the available versions for download:

```bash
$ appc use

The following versions are available:

0.0.97     Installed (Latest) (Active)              Sat Dec 27 2014 22:37:03 GMT-0800 (PST)
0.0.96     Installed                                Sat Dec 27 2014 17:32:16 GMT-0800 (PST)
```

## Licensing

This code is Confidential and Proprietary to Appcelerator, Inc. All Rights Reserved. This code MUST not be modified, copied or otherwise redistributed without express written permission of Appcelerator. This file is licensed as part of the Appcelerator Platform and governed under the terms of the Appcelerator license agreement.  Your right to use this software terminates when you terminate your Appcelerator subscription.
