/// <reference path="../ref/types.d.ts"/>

import fs = require('fs');
import assert = require('assert');
import path = require('path');

import Encoding = require('../lib/encoding');
import fileManager = require('../lib/filemanager');

var TestFileDir = "./test/testSrcFiles";

var tests: TestContainer = {};


function getDataViewForFile(filepath: string): DataView {
    var nodeBuff = fs.readFileSync(filepath);
    if (nodeBuff.length === 0) {
        return null;
    }
    var typedArray = new Uint8Array(<any>nodeBuff);
    return new DataView(typedArray.buffer);
}

tests['Check UTF8 decoding'] = function () {
    var srcDv = getDataViewForFile(TestFileDir + "\\UTF8BOM.txt");
    var offset = 0;
    var codePoints: Array<number> = [];
    while (offset < srcDv.byteLength) {
        var result = Encoding.readUtf8Char(srcDv, offset);
        codePoints.push(result.codePoint);
        offset = result.nextOffset;
    }
    assert.equal(codePoints.pop(), 0x41, "Last character as expected");
    assert.deepEqual(codePoints.slice(0, 7), [0xFEFF, 0x0054, 0x00E8, 0x1D23, 0x2020, 0x000D, 0x000A], "Read UTF8 bytes as expected");
};

tests['Check UTF8 encoding'] = function () {
    var ab = new ArrayBuffer(14);
    var dv = new DataView(ab);
    var offset = 0;

    offset = Encoding.writeUtf8Char(dv, offset, Encoding.codePoint.bom);

    var chars = [0x0054, 0x00E8, 0x1D23, 0x2020, 0x000D, 0x000A];
    for (var i in chars) {
        offset = Encoding.writeUtf8Char(dv, offset, chars[i]);
    }

    var result = [];
    for (var i = 0; i < dv.byteLength; i++) result.push(dv.getUint8(i));

    var expected = [0xEF, 0xBB, 0xBF, 0x54, 0xC3, 0xA8, 0xE1, 0xB4, 0xA3, 0xE2, 0x80, 0xA0, 0x0D, 0x0A];
    assert.deepEqual(result, expected, "Written UTF8 bytes as expected");
};

tests['Count ASCII CRs and LFs occurrences'] = function () {
    var fp = new fileManager.FileProcessor([], "", false, false);
    var stats = fp.processFile(TestFileDir + "\\charCountASCII.txt");
    assert.equal(stats.crEndings, 5, "CR count");
    assert.equal(stats.lfEndings, 4, "LF count");
    assert.equal(stats.crlfEndings, 5, "CRLF count");
};

tests['Count UTF16LE CRs and LFs occurrences'] = function () {
    var fp = new fileManager.FileProcessor([], "", false, false);
    var stats = fp.processFile(TestFileDir + "\\sampleCodeUtf16lecr.txt");
    assert.equal(stats.encoding, Encoding.encoding.utf16lebom, "Encoding is correct");
    assert.equal(stats.crEndings, 13, "CR count");
    assert.ok(stats.isAsciiOnly, "Is ASCII only");
    assert.equal(stats.lfEndings, 0, "LF count");
    assert.equal(stats.crlfEndings, 0, "CRLF count");
};

tests['Check UTF16le conversion'] = function () {
    var srcDv = getDataViewForFile(TestFileDir + "\\sampleCodeUtf16lecr.txt");

    var encoder = new Encoding.TextFile(srcDv);
    var fileSize = encoder.convert('utf8', true, true, 'crlf');
    var outBuff = new ArrayBuffer(fileSize);
    var outDv = new DataView(outBuff);
    encoder.convert('utf8', true, true, 'crlf', outDv);

    var expectedDv = getDataViewForFile(TestFileDir + "\\sampleCodeUtf8Crlf.txt");

    assert.equal(outDv.byteLength, expectedDv.byteLength, "Converted size matches");
    var match = true;
    for (var i = 0; i < outDv.byteLength; i++) {
        if (outDv.getUint8(i) !== expectedDv.getUint8(i)) {
            match = false;
        }
    }
    assert.ok(match, "Content matches");
};

tests['Read non-BMP utf16 chars'] = function () {
    var srcDv = getDataViewForFile(TestFileDir + "\\utf16leNonBmp.txt");
    var encoder = new Encoding.TextFile(srcDv);

    assert.equal(encoder.stats.encoding, Encoding.encoding.utf16lebom, "Detected encoding");

    var offset = 0;
    var expectedCodePoints = [0xFEFF, 0x10480, 0x10481, 0x10482, 0x54, 0x68, 0x69];
    expectedCodePoints.forEach((expectedCodePoint) => {
        var result = Encoding.readUtf16leChar(encoder.data, offset);
        assert.equal(result.codePoint, expectedCodePoint, "CodePoint is correct");
        offset = result.nextOffset;
    });
};

tests['Read non-BMP utf8 chars'] = function () {
    var srcDv = getDataViewForFile(TestFileDir + "\\utf8NonBmp.txt");
    var encoder = new Encoding.TextFile(srcDv);
    assert.equal(encoder.stats.encoding, Encoding.encoding.utf8bom, "Detected encoding");

    var expectedCodePoints = [0xFEFF, 0x10480, 0x10481, 0x10482, 0x54, 0x68, 0x69];
    var offset = 0;

    expectedCodePoints.forEach((expectedCodePoint) => {
        var result = Encoding.readUtf8Char(encoder.data, offset);
        assert.equal(result.codePoint, expectedCodePoint, "CodePoint is correct");
        offset = result.nextOffset;
    });
};

tests['Write non-BMP utf8 chars'] = function () {
    var buf = new ArrayBuffer(15);
    var outDv = new DataView(buf);
    var offset = 0;
    var chars = [0x10480, 0x10481, 0x10482, 0x54, 0x68, 0x69];

    chars.forEach((cp) => offset = Encoding.writeUtf8Char(outDv, offset, cp));
    assert.equal(offset, 15, "Bytes written");
    var expectedBytes = [0xF0, 0x90, 0x92, 0x80, 0xF0, 0x90, 0x92, 0x81, 0xF0, 0x90, 0x92, 0x82, 0x54, 0x68, 0x69];

    expectedBytes.forEach((val, idx) => {
        assert.equal(outDv.getUint8(idx), val, "Byte value is correct");
    });
};


tests['Writing UTF16le bytes'] = function () {
    var outbuf = new ArrayBuffer(14);
    var outview = new DataView(outbuf);
    var offset = 0;
    [0xFEFF, 0x0054, 0x00E8, 0x1D23, 0x2020, 0x000D, 0x000A].forEach((val) => {
        offset = Encoding.writeUtf16leChar(outview, offset, val);
    });

    var expectedBytes = [0xFF, 0xFE, 0x54, 0x00, 0xE8, 0x00, 0x23, 0x1D, 0x20, 0x20, 0x0D, 0x00, 0x0A, 0x00];
    expectedBytes.forEach((val, index) => assert.equal(outview.getUint8(index), val, "Incorrect byte"));
}

tests['Test invalid lead UTF8 byte'] = function () {
    var nodeBuff = fs.readFileSync(path.join(TestFileDir, "utf8BadLeadByte.txt"));
    var typedArray = new Uint8Array(<any>nodeBuff);
    var fileData = new DataView(typedArray.buffer);
    var error;
    Encoding.parseFile(fileData, "utf8", (msg) => error = msg);
    assert.equal(error, "Invalid UTF8 byte sequence at index: 4", "Error detected");
}

tests['Test invalid tail UTF8 byte'] = function () {
    var nodeBuff = fs.readFileSync(path.join(TestFileDir, "utf8InvalidTail.txt"));
    var typedArray = new Uint8Array(<any>nodeBuff);
    var fileData = new DataView(typedArray.buffer);
    var error;
    Encoding.parseFile(fileData, "utf8", (msg) => error = msg);
    assert.equal(error, "Trailing byte invalid at index: 8", "Error detected");
}

tests['Test UTF-16LE with invalid surrogate trail fails'] = function () {
    var nodeBuff = fs.readFileSync(path.join(TestFileDir, "utf16leInvalidSurrogate.txt"));
    var typedArray = new Uint8Array(<any>nodeBuff);
    var fileData = new DataView(typedArray.buffer);
    var error;
    Encoding.parseFile(fileData, "utf16le", (msg) => error = msg);
    assert.equal(error, "Trail surrogate has an invalid value at offset: 2", "Error detected");
}

tests['Test UTF-16BE with invalid surrogate head fails'] = function () {
    var nodeBuff = fs.readFileSync(path.join(TestFileDir, "UTF16BEInvalidSurrogate.txt"));
    var typedArray = new Uint8Array(<any>nodeBuff);
    var fileData = new DataView(typedArray.buffer);
    var error;
    Encoding.parseFile(fileData, "utf16be", (msg) => error = msg);
    assert.equal(error, "Byte sequence starts with a trail surrogate at offset: 12", "Error detected");
}

tests['Test UTF-16LE with missing trail surrogate fails'] = function () {
    var nodeBuff = fs.readFileSync(path.join(TestFileDir, "utf16leMissingTrailSurrogate.txt"));
    var typedArray = new Uint8Array(<any>nodeBuff);
    var fileData = new DataView(typedArray.buffer);
    var error;
    Encoding.parseFile(fileData, "utf16le", (msg) => error = msg);
    assert.equal(error, "Trail surrogate has an invalid value at offset: 6", "Error detected");
}

export = tests;
