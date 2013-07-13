#!/usr/bin/env node

var App = require('../lib/main');
var instance = new App(process.argv.slice(2));
instance.run();
