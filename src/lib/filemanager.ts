/// <reference path="../ref/types.d.ts"/>

import fs = require ('fs');
import path = require('path');
import event = require('events');

import encoding = require('./encoding');

export class DirectoryCrawler extends event.EventEmitter {
    constructor(public dir: string, public recurse: bool, public includeFiles: RegExp, public excludeFiles: RegExp) {
        super();
        if (!fs.existsSync(dir)) {
            throw new Error("Invalid file path: " + dir);
        }
    }

    crawl(dir:string = this.dir) {
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
                // Recurse through child directories
                if (this.recurse) {
                    this.crawl(fullpath);
                }
            }

        }
    }

    isTargetFile(fullPath: string): bool {
        // Ensure we use paths with forward slashes
        fullPath = fullPath.replace(/\\/g, "/");
        return (fullPath.match(this.includeFiles) && !fullPath.match(this.excludeFiles));
    }
}

export class FileProcessor {
    constructor (private validEncodings: string[], private validLineEndings: string, private allowExtraBoms: bool, private fixFiles: bool, private fixedFileSuffix?: string) {}

    processFile(filepath) {
        // Scan the file and get its statistics

        var nodeBuff = fs.readFileSync(filepath);
        if (nodeBuff.length === 0) {
            return null;
        }

        // We can create a DataView by created a Uint8Array over a Node buffer, 
        // then using it buffer property (which is the cloned ArrayBuffer) in the DataView constructor.
        var typedArray = new Uint8Array(<any>nodeBuff);
        var fileData = new DataView(typedArray.buffer);

        var fileParser = new encoding.TextFile(fileData);
        if (!fileParser || !fileParser.stats) return null;
        fileParser.stats.wasInvalid = !this.isValid(fileParser.stats);

        if (fileParser.stats.wasInvalid && this.fixFiles) {
            var targetEncoding = (this.validEncodings.indexOf(fileParser.stats.encoding) === -1) ?
                this.validEncodings[0] : fileParser.stats.encoding;
            // Can't convert to ASCII if it contains non-ASCII chars, or contains extra BOMs we're not removing
            if (targetEncoding === encoding.encoding.ascii &&
                   (fileParser.stats.isAsciiOnly === false ||
                       (fileParser.stats.extraBoms && this.allowExtraBoms))) {
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
                var outputBuffer = new Buffer(<any>typedArray);
                fs.writeFileSync(filepath, outputBuffer);
                fileParser.stats.isFixed = true;
            }
        }

        return fileParser.stats;
    }

    isValid(stats: encoding.FileStats): boolean {
        if (this.validEncodings.indexOf(stats.encoding) === -1) return false;
        if ([this.validLineEndings, encoding.lineEnding.none].indexOf(stats.lineEndings) === -1) return false;
        if ((this.allowExtraBoms === false) && stats.extraBoms) return false;
        return true;
    }
}
