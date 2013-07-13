/// <reference path="../ref/types.d.ts"/>

export var encoding = {
    ascii: "ascii",
    utf8: "utf8",
    utf16le: "utf16le",
    utf16be: "utf16be",
    utf8bom: "utf8bom",
    utf16lebom: "utf16lebom",
    utf16bebom: "utf16bebom",
    cp1252: "cp1252"
};

export var lineEnding = {
    none: "none",
    crlf: "crlf",
    lf: "lf",
    cr: "cr",
    mixed: "mixed"
}

export enum codePoint {
    tab = 0x09,
    lf=  0x0A,
    cr = 0x0D,
    bom = 0xFEFF
}

export interface readResult {
    codePoint: number;
    nextOffset: number;
}

export interface charReader {
    (buffer: DataView, offset: number): readResult;
}

export interface charWriter {
    (buffer: DataView, offset: number, codePoint: number): number;
}

export var readUtf8Char: charReader = function (buffer: DataView, offset: number) {
    var byte1 = buffer.getUint8(offset);;
    if (byte1 < 0x80) {
        // One byte sequence (ASCII range)
        return {
            codePoint: byte1,
            nextOffset: offset + 1
        };
    }

    // Number of trail bytes indicated by number of significant bits set in first byte
    var totalBytes = 1;
    var bitvalue = 0x40;
    while (bitvalue > 0) {
        if ((byte1 & bitvalue) === 0) break;
        totalBytes++;
        bitvalue >>= 1;
    }
    // 10xxxxxx is an invalid first byte, and Unicode characters all fit into 4 byte encodings
    if (totalBytes < 2 || totalBytes > 4) {
        throw Error("Invalid UTF8 byte sequence at index: " + offset);
    }

    // Get the value bits for the first byte.  Number of bits = (7 - total bytes in sequence)
    var codePoint = byte1 & (Math.pow(2, (7 - totalBytes)) - 1);

    // Add in 6 bits from every trailing byte
    for (var i = 1; i < totalBytes; i++) {
        var nextByte = buffer.getUint8(offset + i);
        if ((nextByte & 0xC0 ^ 0x80) !== 0) { // Needs to be of pattern 10xxxxxx
            throw Error("Trailing byte invalid at index: " + (offset + i));
        }
        codePoint = (codePoint << 6) | (nextByte & 0x3F);
    }

    if (codePoint > 0x10FFFF) {
        throw Error("Unicode codepoint out of range at index: " + offset);
    }

    return {
        codePoint: codePoint,
        nextOffset: offset += totalBytes
    };
}

export var writeUtf8Char: charWriter = function (buffer: DataView, offset: number, codePoint: number) {
    if (codePoint < 0 || codePoint > 0x10FFFF) {
        throw Error("Invalid codepoint value of: " + codePoint);
    }
    if (codePoint < 0x80) {  // One byte sequence for ASCII range
        if (buffer) buffer.setUint8(offset, codePoint);
        return offset + 1;
    }

    // 11 bits fit into 2 bytes, and you need another byte for every 5 bits
    var maxValue = 0x800;
    var bytesNeeded = 2;
    while (codePoint >= maxValue) {
        maxValue <<= 5;
        bytesNeeded++;
    }

    // Write into the buffer in reverse order
    for (var i = bytesNeeded - 1; i > 0; i--) {
        if (buffer) buffer.setUint8(offset + i, (codePoint & 0x3F) | 0x80);  // 6 bytes plus the most significant bit
        codePoint >>>= 6;
    }

    // Set the lead bytes to the right bit pattern
    var highBits = (Math.pow(2, bytesNeeded) - 1) << (8 - bytesNeeded);
    if (buffer) buffer.setUint8(offset, (highBits | codePoint));  // Value should only have remaining bits left at right location
    return offset + bytesNeeded;
}

function readUtf16Char(littleEndian: bool, buffer: DataView, offset: number) {
    var codePoint = buffer.getUint16(offset, littleEndian);

    if (codePoint < 0xD800 || codePoint > 0xDFFF) {
        return {
            codePoint: codePoint,
            nextOffset: offset + 2
        };
    }

    if (codePoint >= 0xDC00 && codePoint <= 0xDFFF) {
        throw Error("Byte sequence starts with a trail surrogate at offset: " + offset);
    }

    // Surrogate pair
    var leadSurrogate = codePoint;
    var tailSurrogate = buffer.getUint16(offset + 2, littleEndian);
    if (tailSurrogate < 0xDC00 || tailSurrogate > 0xDFFF) {
        throw Error("Trail surrogate has an invalid value at offset: " + offset);
    }
    var lead10 = ((leadSurrogate - 0xD800) << 10);
    var tail10 = tailSurrogate - 0xDC00;

    return {
        codePoint: ((lead10 | tail10) + 0x10000),
        nextOffset: offset + 4
    };
}
function writeUtf16Char(littleEndian: bool, buffer: DataView, offset: number, codePoint: number) {
    if (codePoint > 0x10FFFF || codePoint < 0) {
        throw Error("CodePoint out of range: " + codePoint);
    }

    if (codePoint <= 0xFFFF) {
        if (buffer) {
            buffer.setUint16(offset, codePoint, littleEndian);
        }
        return offset + 2;
    } else {
        var leadSurrogate = (((codePoint - 0x10000) & 0xFFC00) >>> 10) + 0xD800; // Minus 0x10000, then top 10 bits added to 0xD800
        var trailSurrogate = ((codePoint - 0x10000) & 0x3FF) + 0xDC00; // Minus 0x10000, then low 10 bits added to 0xDC00
        if (buffer) {
            buffer.setUint16(offset, leadSurrogate, littleEndian);
            buffer.setUint16(offset + 2, trailSurrogate, littleEndian);
        }
        return offset + 4;
    } 
}

export var readUtf16leChar: charReader = readUtf16Char.bind(undefined, true);
export var writeUtf16leChar: charWriter = writeUtf16Char.bind(undefined, true);

export var readUtf16beChar: charReader = readUtf16Char.bind(undefined, false);
export var writeUtf16beChar: charWriter = writeUtf16Char.bind(undefined, false);

export function CP1252toUnicode(codepoint: number, reverseLookup?: boolean) {
    if (codepoint >= 0x00 && codepoint <= 0x7F || codepoint >= 0xA0 && codepoint <= 0xFF) {
        // ASCII range 0x00 - 0x7F, and 0xA0 - 0xFF, map directly to Unicode
        return codepoint;
    }

    // Pairs of CP1252 -> Unicode mappings
    // Note: Codepoints 0x81, 0x8D, 0x8F, 0x90, 0x9D do not exist in Windows-1252
    var mapping = [
        0x80, 0x20AC, // euro sign
        0x82, 0x201A, // single low-9 quotation mark
        0x83, 0x0192, // Latin small letter f with hook
        0x84, 0x201E, // double low-9 quotation mark
        0x85, 0x2026, // horizontal ellipsis
        0x86, 0x2020, // dagger
        0x87, 0x2021, // double dagger
        0x88, 0x02C6, // modifier letter circumflex accent
        0x89, 0x2030, // per mille sign
        0x8A, 0x0160, // Latin capital letter S with caron
        0x8B, 0x2039, // single left-pointing angle quotation mark
        0x8C, 0x0152, // Latin capital ligature OE
        0x8E, 0x017D, // Z with caron
        0x91, 0x2018, // left single quotation mark
        0x92, 0x2019, // right single quotation mark
        0x93, 0x201C, // left double quotation mark
        0x94, 0x201D, // right double quotation mark
        0x95, 0x2022, // bullet
        0x96, 0x2013, // en dash
        0x97, 0x2014, // em dash
        0x98, 0x02DC, // small tilde
        0x99, 0x2122, // trade mark sign
        0x9A, 0x0161, // Latin small letter s with caron
        0x9B, 0x203A, // single right-pointing angle quotation mark
        0x9C, 0x0153, // Latin small ligature oe
        0x9E, 0x017E, // z with caron
        0x9F, 0x0178, // Latin capital letter Y with diaeresis
    ];

    for (var i = 0; i < mapping.length; i += 2) {
        if (!reverseLookup) {
            if (mapping[i] === codepoint) {
                return mapping[i + 1];
            }
        } else {
            if (mapping[i+1] === codepoint) {
                return mapping[i];
            }
        }
    }

    // Only got here if there was no mapping.
    return undefined;
}

export var readCP1252Char: charReader = function (buffer: DataView, offset: number) {
    var codeunit = buffer.getUint8(offset);
    return {
        codePoint: CP1252toUnicode(codeunit),
        nextOffset: offset + 1
    };
}

export var writeCP1252Char: charWriter = function (buffer: DataView, offset: number, codePoint: number) {
    var codeunit = CP1252toUnicode(codePoint, true);
    if (!codeunit || codeunit < 0x00 || codeunit >= 0xFF) {
        throw Error("Codepoint out of range for CP1252: " + codePoint);
    }
    buffer.setUint8(offset, codeunit);
    return offset + 1;
}

export function getEncodingHandler(encodingName: string){ 
    var charReader: charReader;
    var charWriter: charWriter;

    switch(encodingName){
        case "ascii":
        case "utf8":
        case "utf8bom":
            charReader = readUtf8Char;
            charWriter = writeUtf8Char;
            break;
        case "utf16le":
        case "utf16lebom":
            charReader = readUtf16leChar;
            charWriter = writeUtf16leChar;
            break;
        case "utf16be":
        case "utf16bebom":
            charReader = readUtf16beChar;
            charWriter = writeUtf16beChar;
            break;
        case "cp1252":
            charReader = readCP1252Char;
            charWriter = writeCP1252Char;
            break;
        default:
            throw Error("Unknown encoding:" + encodingName);
    }
    return {
        reader: charReader,
        writer: charWriter
    }
}

export class FileStats implements fileStats {
    encoding: string = "";
    leadingBom: bool = false;
    extraBoms = 0;
    crlfEndings = 0;
    crEndings = 0;
    lfEndings = 0;
    wasInvalid = false;
    isFixed = false;
    parseErrors: string[];

    // Below are useful for detecting ASCII only, need for surrogate pairs, and how many bytes an encoding conversion will take
    utf8_1ByteCount = 0; // 0x0000 - 0x007F: ASCII
    utf8_2ByteCount = 0; // 0x0080 - 0x07FF:
    utf8_3ByteCount = 0; // 0x0800 - 0xFFFF: Final range of BMP
    utf8_4ByteCount = 0; // 0x010000 - 10FFFF: Above the BMP

    get lineEndings(): string {
        if (this.crlfEndings + this.crEndings + this.lfEndings === 0) return lineEnding.none;
        if (this.crEndings + this.lfEndings === 0) return lineEnding.crlf;
        if (this.crlfEndings + this.crEndings === 0) return lineEnding.lf;
        if (this.crlfEndings + this.lfEndings === 0) return lineEnding.cr;
        return lineEnding.mixed;
    }

    get isAsciiOnly(): boolean {
        // Ignore BOMs, as assume these would get stripped in any conversion to ASCII encoding.
        var expectedBOMs = this.leadingBom ? 1 : 0;
        expectedBOMs += this.extraBoms;
        return (this.utf8_2ByteCount + this.utf8_4ByteCount === 0) && (this.utf8_3ByteCount === expectedBOMs);
    }

    get isBmpOnly(): bool { // Any Unicode char in the BMP plane can be encoding in 3 UTF8 bytes, anything above needs 4.
        return this.utf8_4ByteCount === 0;
    }
}

/** 
  Don't allow control codes (except line-feeds and tabs), backspaces, reserved ranges, etc...
*/
export function isValidCharacter(codepoint: number): bool {
    if (codepoint >= 0x20 && codepoint < 0x7F) return true; // ASCII printable
    if (codepoint < 0x20) {  // Control codes (see http://en.wikipedia.org/wiki/Control_character )
        if (codepoint === codePoint.tab || codepoint === codePoint.cr || codepoint === codePoint.lf) {
            return true;  // Only tab, linefeed & carriage return allowed
        } else {
            return false;
        }
    }
    if (codepoint >= 0x7F && codepoint < 0xA0) return false; // Backspace & C1 control codes (see http://en.wikipedia.org/wiki/C0_and_C1_control_codes )
    if ((codepoint >= 0xD800) && (codepoint <= 0xDFFF)) return false; // Reserved for UTF-16 surrogate pairs
    if ((codepoint >= 0xFDD0 && codepoint <= 0xFDEF) || ((codepoint & 0xFFFE) === 0xFFFE)) {
        return false; // Reserved Unicode codepoints
    }
    if (codepoint > 0x10FFFF) {
        return false; // Outside unicode range
    } else {
        return true; // Allow anything else.  Possibly over permissive, but good enough.
    }
}

// If the char at the offset given is a LF, returns the offset for the char after it, else returns the original offset passed in
function consumeTrailingLF(data: DataView, offset: number, encodingName: string): number {
    // If we're at EOF, there is no trailing LF
    if (offset > data.byteLength) return offset;

    var currentOffset = offset;   // Need to reset if there isn't one
    var result = getEncodingHandler(encodingName).reader(data, offset);
    if (result.codePoint !== codePoint.lf) {
        // Wasn't a LF
        return offset;
    } else {
        return result.nextOffset;
    }
}

export function parseFile(data: DataView, encodingName: string, onError?: (msg: string) => void): FileStats {
    var stats = new FileStats();
    var reader = getEncodingHandler(encodingName).reader;
    var readResult: readResult = { codePoint: 0, nextOffset: 0 };
    var lastOffset = 0;
    try {
        while (readResult.nextOffset < data.byteLength) {
            lastOffset = readResult.nextOffset;
            readResult = reader(data, readResult.nextOffset);
            if (!isValidCharacter(readResult.codePoint)) {
                throw Error("Invalid character in encoding " + encodingName + " at offset: " + lastOffset);
            }
            switch (readResult.codePoint) {
                case codePoint.bom:
                    if (lastOffset === 0) {
                        stats.leadingBom = true;
                    } else {
                        stats.extraBoms++;
                    }
                    break;
                case codePoint.cr:
                    var skipLf = consumeTrailingLF(data, readResult.nextOffset, encodingName);
                    if (skipLf !== readResult.nextOffset) { // Offset advanced, so was a LF next
                        stats.crlfEndings++;
                        stats.utf8_1ByteCount++; // Increment for the skipped LF
                        readResult.nextOffset = skipLf;
                    } else {
                        stats.crEndings++;
                    }
                    break;
                case codePoint.lf:
                    stats.lfEndings++;
                    break;
            }
            if (readResult.codePoint < 0x80) {
                stats.utf8_1ByteCount++;
            } else if (readResult.codePoint < 0x800) {
                stats.utf8_2ByteCount++;
            } else if (readResult.codePoint < 0x10000) {
                stats.utf8_3ByteCount++;
            } else {
                stats.utf8_4ByteCount++;
            }
        }
    } catch (e) {
        if (onError) onError(e.message);
        return null;
    }
    return stats;
}

export function getStats(data: DataView): FileStats {
    if (data.byteLength === 0) return new FileStats();
    var parseErrors:string[] = [];

    // Loop through the encodings until one succeeds
    for (var encodingName in encoding) {
        // Skip over ASCII (it's just UTF8) or BOM specific encodings
        if (/ascii|.*bom$/.test(encodingName)) continue;
        var stats = parseFile(data, encodingName, (errmsg) => parseErrors.push(errmsg));
        if (stats) {
            // Convert to the more specific type if possible
            if (encodingName === encoding.utf8 && stats.isAsciiOnly && !stats.leadingBom && !stats.extraBoms) {
                stats.encoding = encoding.ascii;
            } else {
                stats.encoding = encodingName;
            }
            if (stats.leadingBom) {
                stats.encoding += "bom";
            }
            return stats;
        }
    }
    // Only get here if we didn't succeed above.
    var failResult = new FileStats();
    failResult.encoding = "unknown";
    failResult.wasInvalid = true;
    failResult.parseErrors = parseErrors;
    return failResult;
}

export class TextFile {
    stats: FileStats;

    constructor(public data: DataView) {
        this.stats = getStats(data);
    }

    // Returns a buffer of converted data (in outBuffer) and its file size, of just the file size needed if outBuffer is undefined
    convert(toEncoding: string, leadingBom: bool, removeExtraBoms: bool, lineEndings: string, outBuffer?: DataView): number {
        var reader = getEncodingHandler(this.stats.encoding).reader;
        var writer = getEncodingHandler(toEncoding).writer;

        var readOffset = 0;
        var writeOffset = 0;

        // Skip past any BOM on input
        if (this.stats.leadingBom) {
            readOffset = reader(this.data, 0).nextOffset;
        }
        // If output requires BOM, write one.
        if (leadingBom) {
            writeOffset = writer(outBuffer, writeOffset, codePoint.bom);
        }

        while (readOffset < this.data.byteLength) {
            var readResult = reader(this.data, readOffset);
            var inputChar = readResult.codePoint;
            readOffset = readResult.nextOffset;
            if (inputChar !== codePoint.bom && inputChar !== codePoint.cr && inputChar !== codePoint.lf) {
                writeOffset = writer(outBuffer, writeOffset, inputChar);
            } else if (inputChar === codePoint.bom) {
                if (!removeExtraBoms) {
                    writeOffset = writer(outBuffer, writeOffset, inputChar);
                }
            } else {
                // Only get into this branch on CR or LF
                if (inputChar === codePoint.cr) {
                    readOffset = consumeTrailingLF(this.data, readOffset, this.stats.encoding);
                }
                switch (lineEndings) {
                    case lineEnding.cr:
                        writeOffset = writer(outBuffer, writeOffset, codePoint.cr);
                        break;
                    case lineEnding.lf:
                        writeOffset = writer(outBuffer, writeOffset, codePoint.lf);
                        break;
                    case lineEnding.crlf:
                    default:
                        writeOffset = writer(outBuffer, writeOffset, codePoint.cr);
                        writeOffset = writer(outBuffer, writeOffset, codePoint.lf);
                        break;
                }
            }
        }
        return writeOffset;
    }
}