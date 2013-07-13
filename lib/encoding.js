/// <reference path="../ref/types.d.ts"/>
exports.encoding = {
    ascii: "ascii",
    utf8: "utf8",
    utf16le: "utf16le",
    utf16be: "utf16be",
    utf8bom: "utf8bom",
    utf16lebom: "utf16lebom",
    utf16bebom: "utf16bebom",
    cp1252: "cp1252"
};

exports.lineEnding = {
    none: "none",
    crlf: "crlf",
    lf: "lf",
    cr: "cr",
    mixed: "mixed"
};

(function (codePoint) {
    codePoint[codePoint["tab"] = 0x09] = "tab";
    codePoint[codePoint["lf"] = 0x0A] = "lf";
    codePoint[codePoint["cr"] = 0x0D] = "cr";

    codePoint[codePoint["bom"] = 0xFEFF] = "bom";
})(exports.codePoint || (exports.codePoint = {}));
var codePoint = exports.codePoint;

exports.readUtf8Char = function (buffer, offset) {
    var byte1 = buffer.getUint8(offset);
    ;
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
        if ((byte1 & bitvalue) === 0)
            break;
        totalBytes++;
        bitvalue >>= 1;
    }

    if (totalBytes < 2 || totalBytes > 4) {
        throw Error("Invalid UTF8 byte sequence at index: " + offset);
    }

    // Get the value bits for the first byte.  Number of bits = (7 - total bytes in sequence)
    var codePoint = byte1 & (Math.pow(2, (7 - totalBytes)) - 1);

    for (var i = 1; i < totalBytes; i++) {
        var nextByte = buffer.getUint8(offset + i);
        if ((nextByte & 0xC0 ^ 0x80) !== 0) {
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
};

exports.writeUtf8Char = function (buffer, offset, codePoint) {
    if (codePoint < 0 || codePoint > 0x10FFFF) {
        throw Error("Invalid codepoint value of: " + codePoint);
    }
    if (codePoint < 0x80) {
        if (buffer)
            buffer.setUint8(offset, codePoint);
        return offset + 1;
    }

    // 11 bits fit into 2 bytes, and you need another byte for every 5 bits
    var maxValue = 0x800;
    var bytesNeeded = 2;
    while (codePoint >= maxValue) {
        maxValue <<= 5;
        bytesNeeded++;
    }

    for (var i = bytesNeeded - 1; i > 0; i--) {
        if (buffer)
            buffer.setUint8(offset + i, (codePoint & 0x3F) | 0x80);
        codePoint >>>= 6;
    }

    // Set the lead bytes to the right bit pattern
    var highBits = (Math.pow(2, bytesNeeded) - 1) << (8 - bytesNeeded);
    if (buffer)
        buffer.setUint8(offset, (highBits | codePoint));
    return offset + bytesNeeded;
};

function readUtf16Char(littleEndian, buffer, offset) {
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
function writeUtf16Char(littleEndian, buffer, offset, codePoint) {
    if (codePoint > 0x10FFFF || codePoint < 0) {
        throw Error("CodePoint out of range: " + codePoint);
    }

    if (codePoint <= 0xFFFF) {
        if (buffer) {
            buffer.setUint16(offset, codePoint, littleEndian);
        }
        return offset + 2;
    } else {
        var leadSurrogate = (((codePoint - 0x10000) & 0xFFC00) >>> 10) + 0xD800;
        var trailSurrogate = ((codePoint - 0x10000) & 0x3FF) + 0xDC00;
        if (buffer) {
            buffer.setUint16(offset, leadSurrogate, littleEndian);
            buffer.setUint16(offset + 2, trailSurrogate, littleEndian);
        }
        return offset + 4;
    }
}

exports.readUtf16leChar = readUtf16Char.bind(undefined, true);
exports.writeUtf16leChar = writeUtf16Char.bind(undefined, true);

exports.readUtf16beChar = readUtf16Char.bind(undefined, false);
exports.writeUtf16beChar = writeUtf16Char.bind(undefined, false);

function CP1252toUnicode(codepoint, reverseLookup) {
    if (codepoint >= 0x00 && codepoint <= 0x7F || codepoint >= 0xA0 && codepoint <= 0xFF) {
        // ASCII range 0x00 - 0x7F, and 0xA0 - 0xFF, map directly to Unicode
        return codepoint;
    }

    // Pairs of CP1252 -> Unicode mappings
    // Note: Codepoints 0x81, 0x8D, 0x8F, 0x90, 0x9D do not exist in Windows-1252
    var mapping = [
        0x80,
        0x20AC,
        0x82,
        0x201A,
        0x83,
        0x0192,
        0x84,
        0x201E,
        0x85,
        0x2026,
        0x86,
        0x2020,
        0x87,
        0x2021,
        0x88,
        0x02C6,
        0x89,
        0x2030,
        0x8A,
        0x0160,
        0x8B,
        0x2039,
        0x8C,
        0x0152,
        0x8E,
        0x017D,
        0x91,
        0x2018,
        0x92,
        0x2019,
        0x93,
        0x201C,
        0x94,
        0x201D,
        0x95,
        0x2022,
        0x96,
        0x2013,
        0x97,
        0x2014,
        0x98,
        0x02DC,
        0x99,
        0x2122,
        0x9A,
        0x0161,
        0x9B,
        0x203A,
        0x9C,
        0x0153,
        0x9E,
        0x017E,
        0x9F,
        0x0178
    ];

    for (var i = 0; i < mapping.length; i += 2) {
        if (!reverseLookup) {
            if (mapping[i] === codepoint) {
                return mapping[i + 1];
            }
        } else {
            if (mapping[i + 1] === codepoint) {
                return mapping[i];
            }
        }
    }

    // Only got here if there was no mapping.
    return undefined;
}
exports.CP1252toUnicode = CP1252toUnicode;

exports.readCP1252Char = function (buffer, offset) {
    var codeunit = buffer.getUint8(offset);
    return {
        codePoint: exports.CP1252toUnicode(codeunit),
        nextOffset: offset + 1
    };
};

exports.writeCP1252Char = function (buffer, offset, codePoint) {
    var codeunit = exports.CP1252toUnicode(codePoint, true);
    if (!codeunit || codeunit < 0x00 || codeunit >= 0xFF) {
        throw Error("Codepoint out of range for CP1252: " + codePoint);
    }
    buffer.setUint8(offset, codeunit);
    return offset + 1;
};

function getEncodingHandler(encodingName) {
    var charReader;
    var charWriter;

    switch (encodingName) {
        case "ascii":
        case "utf8":
        case "utf8bom":
            charReader = exports.readUtf8Char;
            charWriter = exports.writeUtf8Char;
            break;
        case "utf16le":
        case "utf16lebom":
            charReader = exports.readUtf16leChar;
            charWriter = exports.writeUtf16leChar;
            break;
        case "utf16be":
        case "utf16bebom":
            charReader = exports.readUtf16beChar;
            charWriter = exports.writeUtf16beChar;
            break;
        case "cp1252":
            charReader = exports.readCP1252Char;
            charWriter = exports.writeCP1252Char;
            break;
        default:
            throw Error("Unknown encoding:" + encodingName);
    }
    return {
        reader: charReader,
        writer: charWriter
    };
}
exports.getEncodingHandler = getEncodingHandler;

var FileStats = (function () {
    function FileStats() {
        this.encoding = "";
        this.leadingBom = false;
        this.extraBoms = 0;
        this.crlfEndings = 0;
        this.crEndings = 0;
        this.lfEndings = 0;
        this.wasInvalid = false;
        this.isFixed = false;
        // Below are useful for detecting ASCII only, need for surrogate pairs, and how many bytes an encoding conversion will take
        this.utf8_1ByteCount = 0;
        this.utf8_2ByteCount = 0;
        this.utf8_3ByteCount = 0;
        this.utf8_4ByteCount = 0;
    }
    Object.defineProperty(FileStats.prototype, "lineEndings", {
        get: function () {
            if (this.crlfEndings + this.crEndings + this.lfEndings === 0)
                return exports.lineEnding.none;
            if (this.crEndings + this.lfEndings === 0)
                return exports.lineEnding.crlf;
            if (this.crlfEndings + this.crEndings === 0)
                return exports.lineEnding.lf;
            if (this.crlfEndings + this.lfEndings === 0)
                return exports.lineEnding.cr;
            return exports.lineEnding.mixed;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(FileStats.prototype, "isAsciiOnly", {
        get: function () {
            // Ignore BOMs, as assume these would get stripped in any conversion to ASCII encoding.
            var expectedBOMs = this.leadingBom ? 1 : 0;
            expectedBOMs += this.extraBoms;
            return (this.utf8_2ByteCount + this.utf8_4ByteCount === 0) && (this.utf8_3ByteCount === expectedBOMs);
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(FileStats.prototype, "isBmpOnly", {
        get: function () {
            return this.utf8_4ByteCount === 0;
        },
        enumerable: true,
        configurable: true
    });
    return FileStats;
})();
exports.FileStats = FileStats;

/**
Don't allow control codes (except line-feeds and tabs), backspaces, reserved ranges, etc...
*/
function isValidCharacter(codepoint) {
    if (codepoint >= 0x20 && codepoint < 0x7F)
        return true;
    if (codepoint < 0x20) {
        if (codepoint === codePoint.tab || codepoint === codePoint.cr || codepoint === codePoint.lf) {
            return true;
        } else {
            return false;
        }
    }
    if (codepoint >= 0x7F && codepoint < 0xA0)
        return false;
    if ((codepoint >= 0xD800) && (codepoint <= 0xDFFF))
        return false;
    if ((codepoint >= 0xFDD0 && codepoint <= 0xFDEF) || ((codepoint & 0xFFFE) === 0xFFFE)) {
        return false;
    }
    if (codepoint > 0x10FFFF) {
        return false;
    } else {
        return true;
    }
}
exports.isValidCharacter = isValidCharacter;

// If the char at the offset given is a LF, returns the offset for the char after it, else returns the original offset passed in
function consumeTrailingLF(data, offset, encodingName) {
    if (offset > data.byteLength)
        return offset;

    var currentOffset = offset;
    var result = exports.getEncodingHandler(encodingName).reader(data, offset);
    if (result.codePoint !== codePoint.lf) {
        // Wasn't a LF
        return offset;
    } else {
        return result.nextOffset;
    }
}

function parseFile(data, encodingName, onError) {
    var stats = new FileStats();
    var reader = exports.getEncodingHandler(encodingName).reader;
    var readResult = { codePoint: 0, nextOffset: 0 };
    var lastOffset = 0;
    try  {
        while (readResult.nextOffset < data.byteLength) {
            lastOffset = readResult.nextOffset;
            readResult = reader(data, readResult.nextOffset);
            if (!exports.isValidCharacter(readResult.codePoint)) {
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
                    if (skipLf !== readResult.nextOffset) {
                        stats.crlfEndings++;
                        stats.utf8_1ByteCount++;
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
        if (onError)
            onError(e.message);
        return null;
    }
    return stats;
}
exports.parseFile = parseFile;

function getStats(data) {
    if (data.byteLength === 0)
        return new FileStats();
    var parseErrors = [];

    for (var encodingName in exports.encoding) {
        if (/ascii|.*bom$/.test(encodingName))
            continue;
        var stats = exports.parseFile(data, encodingName, function (errmsg) {
            return parseErrors.push(errmsg);
        });
        if (stats) {
            if (encodingName === exports.encoding.utf8 && stats.isAsciiOnly && !stats.leadingBom && !stats.extraBoms) {
                stats.encoding = exports.encoding.ascii;
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
exports.getStats = getStats;

var TextFile = (function () {
    function TextFile(data) {
        this.data = data;
        this.stats = exports.getStats(data);
    }
    // Returns a buffer of converted data (in outBuffer) and its file size, of just the file size needed if outBuffer is undefined
    TextFile.prototype.convert = function (toEncoding, leadingBom, removeExtraBoms, lineEndings, outBuffer) {
        var reader = exports.getEncodingHandler(this.stats.encoding).reader;
        var writer = exports.getEncodingHandler(toEncoding).writer;

        var readOffset = 0;
        var writeOffset = 0;

        if (this.stats.leadingBom) {
            readOffset = reader(this.data, 0).nextOffset;
        }

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
                if (inputChar === codePoint.cr) {
                    readOffset = consumeTrailingLF(this.data, readOffset, this.stats.encoding);
                }
                switch (lineEndings) {
                    case exports.lineEnding.cr:
                        writeOffset = writer(outBuffer, writeOffset, codePoint.cr);
                        break;
                    case exports.lineEnding.lf:
                        writeOffset = writer(outBuffer, writeOffset, codePoint.lf);
                        break;
                    case exports.lineEnding.crlf:
                    default:
                        writeOffset = writer(outBuffer, writeOffset, codePoint.cr);
                        writeOffset = writer(outBuffer, writeOffset, codePoint.lf);
                        break;
                }
            }
        }
        return writeOffset;
    };
    return TextFile;
})();
exports.TextFile = TextFile;

