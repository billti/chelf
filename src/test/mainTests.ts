/// <reference path="../ref/types.d.ts"/>

import fs = require('fs');
import assert = require('assert');
import path = require('path');

import fileManager = require('../lib/filemanager');
import App = require('../lib/main');
import Encoding = require('../lib/encoding');

var TestFileDir = "./test/testSrcFiles";

var tests: TestContainer = {};

tests['Check default options'] = function () {
    var options = new App().options;
    assert.equal(path.normalize(options.dir), path.normalize(process.cwd()), "Current directory is correct");
    assert.equal(options.allowExtraBoms, false, "Extra BOMs disallowed by default");
    assert.deepEqual(options.encodings, ["utf8"], "Default encodings are correct");
    assert.equal(options.excludeFiles.source, "(.*\\/)(\\..*)\\/", "Default excluded files");
    assert.equal(options.includeFiles.source, "\\.txt$|\\.js$|\\.css$|\\.html$|\\.ts$|jakefile$|\\.json$|\\.cmd$|\\.bat$|\\.map$", "Default included files");
    assert.equal(options.fixedSuffix, undefined, "Default fixed file suffix");
    assert.equal(options.fixup, false, "Default fixup setting");
    assert.equal(options.help, false, "Default help option");
    assert.equal(options.lineEndings, "crlf", "Default line endings");
    assert.equal(options.recurse, true, "Default recurse setting");
};

tests['Help for unknown option'] = function () {
    var app = new App(["asfasdf"]);
    assert.equal(app.options.help, true);
}

tests['Check param parsing'] = function () {
    var params = ["-dir=C:\\test dir", "-lineEndings=LF", "-encodings=utf16be,ascii", "-recurse=false", "-fixup",
        "-includeFiles=\\.ts$", "-excludefiles=md$", "-allowExtraBoms"];
    var app = new App(params);
    var options = app.options;
    assert.equal(path.normalize(options.dir), path.normalize("C:\\test dir"), "Current directory is correct");
    assert.equal(options.allowExtraBoms, true, "Extra BOMs disallowed by default");
    assert.deepEqual(options.encodings, ["utf16be", "ascii"], "Default encodings are correct");
    assert.equal(options.excludeFiles.source, "md$", "Default excluded files");
    assert.equal(options.includeFiles.source, "\\.ts$", "Default included files");
    assert.equal(options.fixedSuffix, undefined, "Default fixed file suffix");
    assert.equal(options.fixup, true, "Default fixup setting");
    assert.equal(options.help, false, "Default help option");
    assert.equal(options.lineEndings, "lf", "Default line endings");
    assert.equal(options.recurse, false, "Default recurse setting");
};

export = tests;
