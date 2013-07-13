Chelf
======
"Chelf" (pronounced _shelf_ ) stands for **CH**eck **E**ncodings and **L**ine **F**eeds.

This utility is used to scan text files for certain conditions, and make corrections where 
possible.  Currently it supports verifying the files are either ASCII, UTF8, or UTF16 (big 
endian or little endian) - with or without a byte-order mark, or Windows CodePage 1252.

The utility can update line endings to be CRLF (\r\n), CR, or LF, and can also remove extra 
BOM marks from files (which can occur if files are concatenated). It can also convert between 
encodings that it understands.


Usage
-----

        chelf [-dir=<path>] [-recurse[=true|false]] [-lineendings=crlf|cr|lf] -encodings=<ascii|utf8|utf8bom|utf16lebom|utf16bebom|utf16le|utf16be|cp1252>[,..] [-allowExtraBoms[=true|false]] [-includeFiles=<regex>] [-excludeFiles=<regex>]  [-fixup[=true|false]] [-fixedSuffix=<suffix>] [-v]

- *dir* indicates the directory to scan (default is current directory)
- *recurse* indicates whether to recurse through subdirectories (default is true)
- *linendings* indicates the type of line-endings to allow (default is 'crlf')
- *encodings* is the comma separated list of encodings to support.  If not specified, default is "utf8".  When fixup is specified, any encoding conversion needed uses the first encoding listed.
- *allowExtraBoms* will ignore additional byte order marks in files (common if files are concatenated) if set to true (default is false)
- *includeFiles* contains a regular expression to identify files to include.  If not specified, the default is `\.txt$|\.js$|\.css$|\.html$|\.ts$|jakefile$|\.json$|\.cmd$|\.bat$|\.map$`.
- *excludeFiles* contains a regular expression to exclude files.  If not specified, the default is `(.*\/)(\..*)\/` (i.e. any folder begining with a ".", such as ".git"). Note paths should use forward slashes as separators
- *fixup* indicates whether to automatically fix the line-endings, encoding, and BOMs in files (default is false)
- *fixedSuffix* indicates to write the fixed file as a new file with a suffix on the original filename, rather than overwriting the original file
- *v* indicates to log verbose information to the console during execution


Examples
--------

Note: Below assumes the 'chelf' command-line has been registered (via 'npm install' or 'npm link'), else run '`node ./bin/cli.js <args>`' from the Chelf directory.

 - Scan the current directory and all subdirectories to check for only CRLF endings, encodings of UTF-8 with no BOM, and no midfile BOM marks.

        chelf

 - Scan the C:\Temp folder only, and for only .js files, change all line-endings to CRLF, remove any extra BOM marks, and ensure all files are UTF8 with no BOM

        chelf -dir=C:\Temp -recurse=false -fixup=true "-includeFiles=\.js$"


Building
--------
To compile the utility, the 'jake' build system must be installed ("npm install -g jake").  
Then, with the TypeScript compiler (tsc) in your path, and from the root folder of the source run:

        jake

To execute the tests run

        jake test


Structure
---------
All source code is written in TypeScript and stored in subdirectories under the ./src directory.  The compiler places the compiled versions of these subdirectories (lib & test) at the top level for execution.

The cli.js file is the exception.  This is the command-line wrapper, and requires the she-bang ("#!") on the first line for NPM to run correctly, which TypeScript doesn't recognize.  Thus this simple wrapper is written directly in JavaScript in the ./bin directory.

 - bin/cli.js         Thin NPM wrapper when invoked via the command-line.  Runs the main module
 - src/lib
   - main.ts          Main module to be loaded for require('chelf')
   - encoding.ts      Module to encode/decode various file encodings
   - filemanager.ts   Module to crawl directories and read/write files
 - src/ref
   - types.d.ts       Declarations for the types used across the utility
   - node.d.ts        Declarations for the Node API surface area
 - src/test
   - encodingTests.ts Tests for file encoding/decoding
   - fileTests.ts     Tests for the directory and file operations
   - mainTests.ts     Tests for the overall utility
