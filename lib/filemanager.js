var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
/// <reference path="../ref/types.d.ts"/>
var fs = require('fs');
var path = require('path');
var event = require('events');

var encoding = require('./encoding');

var DirectoryCrawler = (function (_super) {
    __extends(DirectoryCrawler, _super);
    function DirectoryCrawler(dir, recurse, includeFiles, excludeFiles) {
        _super.call(this);
        this.dir = dir;
        this.recurse = recurse;
        this.includeFiles = includeFiles;
        this.excludeFiles = excludeFiles;
        if (!fs.existsSync(dir)) {
            throw new Error("Invalid file path: " + dir);
        }
    }
    DirectoryCrawler.prototype.crawl = function (dir) {
        if (typeof dir === "undefined") { dir = this.dir; }
        var contents = fs.readdirSync(dir);
        for (var i in contents) {
            // Each array element is just the final part of the path
            var fullpath = path.normalize(path.join(dir, contents[i]));
            var stats = fs.statSync(fullpath);
            if (stats.isFile()) {
                if (!this.isTargetFile(fullpath)) {
                    this.emit("fileSkipped", fullpath);
                } else {
                    this.emit("fileFound", fullpath);
                }
            } else if (stats.isDirectory()) {
                if (this.recurse) {
                    this.crawl(fullpath);
                }
            }
        }
    };

    DirectoryCrawler.prototype.isTargetFile = function (fullPath) {
        // Ensure we use paths with forward slashes
        fullPath = fullPath.replace(/\\/g, "/");
        return (fullPath.match(this.includeFiles) && !fullPath.match(this.excludeFiles));
    };
    return DirectoryCrawler;
})(event.EventEmitter);
exports.DirectoryCrawler = DirectoryCrawler;

var FileProcessor = (function () {
    function FileProcessor(validEncodings, validLineEndings, allowExtraBoms, fixFiles, fixedFileSuffix) {
        this.validEncodings = validEncodings;
        this.validLineEndings = validLineEndings;
        this.allowExtraBoms = allowExtraBoms;
        this.fixFiles = fixFiles;
        this.fixedFileSuffix = fixedFileSuffix;
    }
    FileProcessor.prototype.processFile = function (filepath) {
        // Scan the file and get its statistics
        var nodeBuff = fs.readFileSync(filepath);
        if (nodeBuff.length === 0) {
            return null;
        }

        // We can create a DataView by created a Uint8Array over a Node buffer,
        // then using it buffer property (which is the cloned ArrayBuffer) in the DataView constructor.
        var typedArray = new Uint8Array(nodeBuff);
        var fileData = new DataView(typedArray.buffer);

        var fileParser = new encoding.TextFile(fileData);
        if (!fileParser || !fileParser.stats)
            return null;
        fileParser.stats.wasInvalid = !this.isValid(fileParser.stats);

        if (fileParser.stats.wasInvalid && this.fixFiles) {
            var targetEncoding = (this.validEncodings.indexOf(fileParser.stats.encoding) === -1) ? this.validEncodings[0] : fileParser.stats.encoding;

            if (targetEncoding === encoding.encoding.ascii && (fileParser.stats.isAsciiOnly === false || (fileParser.stats.extraBoms && this.allowExtraBoms))) {
                fileParser.stats.isFixed = false;
            } else {
                var bomNeeded = /bom$/.test(targetEncoding);
                var fileSize = fileParser.convert(targetEncoding, bomNeeded, !this.allowExtraBoms, this.validLineEndings, undefined);
                var buf = new ArrayBuffer(fileSize);
                var view = new DataView(buf);
                fileParser.convert(targetEncoding, bomNeeded, !this.allowExtraBoms, this.validLineEndings, view);

                if (this.fixedFileSuffix) {
                    filepath += this.fixedFileSuffix;
                }

                // Convert to a regular array and write to target file
                var typedArray = new Uint8Array(buf);
                var outputBuffer = new Buffer(typedArray);
                fs.writeFileSync(filepath, outputBuffer);
                fileParser.stats.isFixed = true;
            }
        }

        return fileParser.stats;
    };

    FileProcessor.prototype.isValid = function (stats) {
        if (this.validEncodings.indexOf(stats.encoding) === -1)
            return false;
        if ([this.validLineEndings, encoding.lineEnding.none].indexOf(stats.lineEndings) === -1)
            return false;
        if ((this.allowExtraBoms === false) && stats.extraBoms)
            return false;
        return true;
    };
    return FileProcessor;
})();
exports.FileProcessor = FileProcessor;

