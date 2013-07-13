/// <reference path="../ref/types.d.ts"/>

import fs = require('fs');
import assert = require('assert');
import path = require('path');

import fileManager = require('../lib/filemanager');
import App = require('../lib/main');
import Encoding = require('../lib/encoding');

var TestFileDir = "./test/testSrcFiles";

var tests: TestContainer = {};

tests["Check file exists"] = function () {
    return fs.existsSync(path.join(TestFileDir, "Test.txt"));
};

tests['File matcher'] = function () {
    var fm = new fileManager.DirectoryCrawler(TestFileDir, false, /sample/, /Utf16/);
    assert.ok(fm.isTargetFile('./sampleCodeAsciiCrlf.txt'));
    assert.ok(!fm.isTargetFile('.//sampleCodeUtf16leCr.txt'));
}

tests['File crawler'] = function () {
    var fm = new fileManager.DirectoryCrawler(TestFileDir, false, /txt$/, /\/[\d]/);
    var foundCount = 0;
    fm.addListener('fileFound', function (name) { foundCount++; });
    fm.crawl();
    assert.equal(foundCount, 20);
}

tests['File crawler recursive'] = function () {
    var fm = new fileManager.DirectoryCrawler(TestFileDir, true, /txt$/, /\/[\d]/);
    var foundCount = 0;
    var skippedCount = 0;
    fm.addListener('fileFound', function (name) { foundCount++; });
    fm.addListener('fileSkipped', function (name) { skippedCount++; });
    fm.crawl();
    assert.equal(foundCount, 33);
    assert.equal(skippedCount, 6);
}

tests['Check encoding detection UTF8 with BOM'] = function () {
    var fp = new fileManager.FileProcessor([], "", false, false);
    var stats = fp.processFile(TestFileDir + "\\UTF8BOM.txt");
    assert.equal(stats.encoding, Encoding.encoding.utf8bom, "File type is UTF8");
    assert.equal(stats.leadingBom, true, "File has leading BOM");
};

tests['Check encoding detection UTF8 no BOM (ASCII)'] = function () {
    var fp = new fileManager.FileProcessor([], "", false, false);
    var stats = fp.processFile(TestFileDir + "\\noBOM.txt");
    assert.equal(stats.encoding, Encoding.encoding.ascii, "File type is UTF8");
    assert.equal(stats.leadingBom, false, "File has no leading BOM");
    assert.equal(stats.isAsciiOnly, true, "File is ASCII only");
};

tests['Check detection on 1 byte file'] = function () {
    var fp = new fileManager.FileProcessor([], "", false, false);
    var stats = fp.processFile(TestFileDir + "\\1bytefile.txt");
    assert.equal(stats.encoding, Encoding.encoding.ascii, "File type is UTF8");
    assert.equal(stats.leadingBom, false, "File has no leading BOM");
    assert.equal(stats.isAsciiOnly, true, "File is ASCII only");
};

tests['Check detection on 0 byte file'] = function () {
    var fp = new fileManager.FileProcessor([], "", false, false);
    var stats = fp.processFile(TestFileDir + "\\0bytefile.txt");
    assert.equal(stats, null, "Empty file has no stats");
};

tests['Check encoding detection UTF16be BOM'] = function () {
    var fp = new fileManager.FileProcessor([], "", false, false);
    var stats = fp.processFile(TestFileDir + "\\UTF16BE.txt");
    assert.equal(stats.encoding, Encoding.encoding.utf16bebom, "File type is UTF16BE");
};

tests['Check encoding detection UTF16le BOM'] = function () {
    var fp = new fileManager.FileProcessor([], "", false, false);
    var stats = fp.processFile(TestFileDir + "\\UTF16LE.txt");
    assert.equal(stats.encoding, Encoding.encoding.utf16lebom, "File type is UTF16LE");
};

tests['Test CP1252 is detected'] = function () {
    debugger;
    var fp = new fileManager.FileProcessor(["ascii","cp1252"], "", false, false);
    var stats = fp.processFile(path.join(TestFileDir, "ansi.txt"));
    assert.equal(stats.encoding, "cp1252", "Can get encoding for ANSI file");
    assert.equal(stats.wasInvalid, false, "CP1252 file is marked valid");
}

tests['Convert file'] = function () {
    var fp = new fileManager.FileProcessor([Encoding.encoding.utf8], Encoding.lineEnding.crlf, false, true, ".fixed");
    var stats = fp.processFile(TestFileDir + "\\charCountASCII.txt");

    assert.equal(stats.crEndings, 5, "CR endings");
    assert.equal(stats.lfEndings, 4, "LF endings");
    assert.equal(stats.crEndings, 5, "CRLF endings");

    var fp2 = new fileManager.FileProcessor([Encoding.encoding.utf8], Encoding.lineEnding.crlf, false, false);
    var stats2 = fp.processFile(TestFileDir + "\\charCountASCII.txt.fixed");

    assert.equal(stats2.crEndings, 0, "CR endings");
    assert.equal(stats2.lfEndings, 0, "LF endings");
    assert.equal(stats2.crlfEndings, 14, "CRLF endings");
};

export = tests;
