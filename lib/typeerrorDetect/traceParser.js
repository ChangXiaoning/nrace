var logger = require('../../driver/logger.js').logger,
    LogEntryType = require('../analysis/LogEntryType.js'),
    lineReader = require('line-reader');

function TraceParser () {};
TraceParser.prototype.parse = function (traceFile, cb){
    //in case cb is undefined
    cb = cb || function () {};
    logger.info('Begin parsing trace', (typeof traceFile == 'string' && traceFile.endsWith('.log')) ? traceFile : '');

    var lineno = 0;

    try{
        if (typeof(traceFile) == 'string') {
            if (!traceFile.endsWith('.log')) {
                //trace is the content string
                var lines = traceFile.split('\n');
                for (var i = 0; i < lines.length; i++) {
                    processLine(lines[i], i == lines.length - 1);
                }
            } else {
                //trace is the file
                lineReader.eachLine(traceFile, processLine);
            }
        } else if (typeof(traceFile) == 'object') {
            //trace has already been parsed
            logger.info('The trace has already been parsed.');
            cb();
        }
    }catch (e) {
        logger.error(e);
        throw e;
    }

    function processLine (line, last) {
        lineno++;
        if (line) {
            metadata = line.split(',');
            entryType = metadata[0];
            if(typeof(entryType) != 'number') {
                entryType = Number.parseInt(entryType);
            }
            if (!LogEntryType.hasOwnProperty(entryType)) {
                return;
            } else {
                entryType = LogEntryType[entryType];
            }
        }
    };
};

exports.TraceParser = TraceParser;