/// <reference path="node.d.ts"/>

interface appOptions {
    help: bool;
    dir: string;
    recurse: bool;
    lineEndings: string;
    encodings: string[];
    allowExtraBoms: bool;
    includeFiles: RegExp;
    excludeFiles: RegExp;
    fixup: bool;
    fixedSuffix: string;
    v: boolean;
}

interface fileStats {
    encoding: string;
    leadingBom: boolean;
    lineEndings: string;
    extraBoms: number;
    crlfEndings: number;
    crEndings: number;
    lfEndings: number;
    isAsciiOnly: boolean;
    isBmpOnly: boolean;
    wasInvalid: boolean;
    isFixed: boolean;
    parseErrors?: string[];
}

interface appLog {
	onFileComplete(filepath: string, stats: fileStats);
	onRunComplete();
    runResults: { filepath: string; stats: fileStats; }[];
}

interface TestContainer {
    [testname: string]: (next?: Function) => void;
}