/// <reference path="../ref/types.d.ts"/>

import encoding = require('./encoding');
import filemanager = require('./filemanager');

function getDefaultOptions(): appOptions {
    var options: appOptions = {
        help: false,
        dir: process.cwd(),
        recurse: true,
        lineEndings: encoding.lineEnding.crlf,
        encodings: [encoding.encoding.utf8],
        allowExtraBoms: false,
        includeFiles: /\.txt$|\.js$|\.css$|\.html$|\.ts$|jakefile$|\.json$|\.cmd$|\.bat$|\.map$/i,
        excludeFiles: /(.*\/)(\..*)\//,
        fixup: false,
        fixedSuffix: undefined,
        v: false
    }
    return options;
}

function processParams(params: string[], options: appOptions) {
    var paramPattern = /^-([^=]+)(?:=(.*))?$/;
    for (var i in params) {
        var match = params[i].match(paramPattern);
        if (match) {
            var value: string = (match[2] === undefined) ? "true" : match[2]; // for switches
            switch ((match[1].toLowerCase())) {
                case "help":
                    options.help = true;
                    break;
                case "dir":
                    options.dir = value;
                    break;
                case "recurse":
                    options.recurse = value.toLowerCase() === "true";
                    break;
                case "lineendings":
                    options.lineEndings = value.toLowerCase();
                    break;
                case "encodings":
                    options.encodings = value.toLowerCase().split(",");
                    break;
                case "allowextraboms":
                    options.allowExtraBoms = value.toLowerCase() === "true";
                    break;
                case "includefiles":
                    options.includeFiles = new RegExp(value, "i");
                    break;
                case "excludefiles":
                    options.excludeFiles = new RegExp(value, "i");
                    break;
                case "fixup":
                    options.fixup = value.toLowerCase() === "true";
                    break;
                case "fixedsuffix":
                    options.fixedSuffix = value;
                    break;
                case "v":
                    options.v = true;
                    break;
                default:
                    options.help = true; // Unknown option
            }
        }
        else { // Invalid option format
            options.help = true;
        }
    }
}

function defaultReport(results: Array<{ filepath: string; stats: fileStats; }>) {
    var failures = results.filter((val) => (!val.stats || val.stats.wasInvalid));
    console.log(JSON.stringify(failures, null, "    "));
}

class App {
    options: appOptions;

    constructor(options?: string[]);
    constructor(options?: appOptions);
    constructor(options?: any) {
        if (Array.isArray(options)) {
            this.options = getDefaultOptions();
            processParams(options, this.options);
        } else if (typeof options === 'undefined') {
            this.options = getDefaultOptions();
        } else {
            this.options = options;
        }
    }

    public run(log?: appLog) {
        if (this.options.help) {
            console.log();
            console.log("chelf [-dir=<path>] [-recurse[=true|false]] [-lineendings=crlf|cr|lf] -encodings=<ascii|utf8|utf8bom|utf16lebom|utf16bebom|utf16le|utf16be|cp1252>[,..] [-allowExtraBoms[=true|false]] [-includeFiles=<regex>] [-excludeFiles=<regex>]  [-fixup[=true|false]] [-fixedSuffix=<suffix>] [-v]");
            return;
        }
        if (!log) {
            log = {
                onFileComplete: function (filepath: string, result: fileStats) {
                    log.runResults.push({ filepath: filepath, stats: result });
                },
                onRunComplete: function () {
                    defaultReport(log.runResults);
                },
                runResults: []
            };
        }


        // If we allow UTF8 (without a BOM) then ASCII is allowed also (as it's a subset)
        if ((this.options.encodings.indexOf(encoding.encoding.utf8) !== -1) && (this.options.encodings.indexOf(encoding.encoding.ascii) === -1)) {
            this.options.encodings.push(encoding.encoding.ascii);
        }

        var crawler = new filemanager.DirectoryCrawler(this.options.dir, this.options.recurse, this.options.includeFiles, this.options.excludeFiles);
        var processor = new filemanager.FileProcessor(this.options.encodings, this.options.lineEndings, this.options.allowExtraBoms, this.options.fixup, this.options.fixedSuffix);

        crawler.addListener('fileFound', (path: string) => {
            if(this.options.v) console.log("Processing file: " + path);
            var result = processor.processFile(path);
            log.onFileComplete(path, result);
        });
        crawler.addListener('fileSkipped', (path: string) => {
            if (this.options.v) console.log("Skipping file: " + path);
        });

        crawler.crawl();
        log.onRunComplete();
    }
}

export = App;