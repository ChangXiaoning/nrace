var cp = require('child_process');
var path = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');
var argparse = require('argparse');
var rimraf = require('rimraf');
var logger = require('./logger.js').logger;
var MultiLayerMap = require('./MultiLayerMap').MultiLayerMap;

var default_detect_timeLimit = 3600; // 1 hour

function runNodeProg(whichNode, args, progName, cb, stdout, stderr) {
    // always run in harmony mode
    //logger.info("node " + args.join(' '));
    logger.info('run command:', whichNode, args.join(' '), ', desc:', progName);
    var instProc = cp.spawn(whichNode, args, {
        cwd: process.cwd()
    });
    instProc.stdout.on('data', function(data) {
        if(!stdout)
            process.stdout.write(String(data));
        else
            stdout(String(data));
    });
    instProc.stderr.on('data', function(data) {
        if(!stderr)
            process.stderr.write(String(data));
        else
            stderr(String(data));
    });
    if (!cb) {
        cb = function(code) {
            if (code !== 0) {
                logger.info('run command "node ', args.join(' ') + '" failed');
            } else {
                logger.info(progName + " complete");
            }
        };
    }
    instProc.on('close', cb);
}

function runPythonProg(whichPython, args, progName, cb, stdout, stderr){
    /**
        @param whichPython <string>: the python to run
        @param args <array>: the array of arguments for the python command.Note: args[0] is the python script
        @param progName <string>: the description for this program
        @param cb <function>: the function to be run when the python script completes
        @param stdout <function>: the function processes printing out
        @param stderr <function>: the function processes error
    */
    logger.info('run command: ', whichPython,  args.join(' '),', desc: ',progName);
    //args=args.unshift(script);
    var pythonProg=cp.spawn(whichPython, args, {
        cwd:process.cwd()
    });
    pythonProg.stdout.on('data', function(data) {
        if (!stdout){
            process.stdout.write(String(data));
        } else {
            stdout(String(data));
        }
    });
    pythonProg.stderr.on('data', function(data) {
        if (!stderr) {
            process.stderr.write(String(data));
        } else {
            stderr(String(data));
        }
    });
    if (!cb) {
        cb=function(code) {
            if (code!==0) {
                logger.info('run command python', args.join(' ')+' failed');
            } else {
                logger.info(args[0]+' completes');
            }
        };
    }
    pythonProg.on('close',cb);
};

function instrumentApp(args) {
    var parser = new argparse.ArgumentParser({
        prog: "avdetector instrument",
        addHelp: true,
        description: "instrument a local application"
    });
    parser.addArgument(['--outputDir'], {
        help: "directory in which to place instrumented files and traces.  " + "We create a new sub-directory for our output.",
        defaultValue: "/tmp"
    });
    parser.addArgument(['--only_include'], {
        help: "list of path prefixes specifying which sub-directories should be instrumented, separated by path.delimiter"
    });
    parser.addArgument(['--debug'], {
        help: 'indicating if it is in debug mode'
    });
    parser.addArgument(['path'], {
        help: "directory of app to instrument"
    });
    var parsed = parser.parseArgs(args);
    var appPath = parsed.path;
    var outputDir = parsed.outputDir;
    logger.info("instrumenting application: " + appPath);
    if (!fs.existsSync(appPath)) {
        logger.error("path " + appPath + " does not exist. Process is exiting...");
        process.exit(1);
    }
    var cliArgs = [];
    if (parsed.debug) {
        cliArgs.push('--inspect');
    }
    cliArgs.push(
        path.join(__dirname, './instApp.js'),
        '--justGenerate',
        '--verbose',
        //'--exclude',
        //'node_modules|test|Gruntfile',
        '--outputDir',
        outputDir
    );
    if (parsed.only_include) {
        cliArgs.push('--only_include', parsed.only_include);
    }
    cliArgs.push(appPath);
    runNodeProg('node', cliArgs, "instrumentation");
}
var directDriver = path.join(__dirname, './jalangi2/src/js/commands/direct.js');
var loggingAnalysis = path.join(__dirname, 'TraceCollector.js');

function runNodeScript(args) {
    var parser = new argparse.ArgumentParser({
        prog: "meminsight noderun",
        addHelp: true,
        description: "run an instrumented node.js script and collect profiling results"
    });
    parser.addArgument(['appPath'], {
        help: "path of the instrumented application root dir"
    });
    parser.addArgument(['instScript'], {
        help: "path of instrumented script to run, relative to appPath"
    });
    parser.addArgument(['instScriptArgs'], {
        help: "command-line arguments to pass to instrumented script",
        nargs: argparse.Const.REMAINDER
    });
    var parsed = parser.parseArgs(args);
    var appPath = parsed.appPath;
    var instScript = parsed.instScript;
    var instScriptArgs = parsed.instScriptArgs;
    // dump traces in same directory as the instrumented script
    // TODO make this configurable
    //var appPath = path.dirname(instScript);
    var curDir = process.cwd();
    process.chdir(appPath);
    logger.info("run Node script: " + instScript);
    var loggingAnalysisArgs = [
        directDriver,
        '--analysis',
        loggingAnalysis,
        '--initParam',
        'syncFS:true',
        '--initParam',
        'asciiFS:true',
        instScript
    ].concat(instScriptArgs);
    runNodeProg('node', loggingAnalysisArgs, "run of script ", function(code) {
        if (code !== 0) {
            logger.info("run of script failed");
            return;
        }
        logger.info("run of script complete");
        // run the lifetime analysis
    });
}
var onTheFlyDriver = path.join(__dirname, './jalangi2/src/js/commands/jalangi.js');
/**
 * run memory analysis on node script using on-the-fly instrumentation
 * @param args
 */
function instAndRunNodeScript(args, cb) {
    var parser = new argparse.ArgumentParser({
        prog: "meminsight nodeinstrun",
        addHelp: true,
        description: "instrument a node.js script as it runs and collect profiling results"
    });
    parser.addArgument(['script'], {
        help: "path of script to run, relative to appPath"
    });
    parser.addArgument(['scriptArgs'], {
        help: "command-line arguments to pass to script",
        nargs: argparse.Const.REMAINDER
    });
    var parsed = parser.parseArgs(args);
    var script = path.resolve(parsed.script);
    var scriptArgs = parsed.scriptArgs;
    // dump traces in same directory as the instrumented script
    // TODO make this configurable
    //var appPath = path.dirname(script);
    //script = path.basename(script);
    //var curDir = process.cwd();
    //process.chdir(appPath);
    
    logger.info("instrument and run Node script: " + script);
    var loggingAnalysisArgs = [
        onTheFlyDriver,
        '--inlineIID',
        '--analysis',
        loggingAnalysis,
        '--initParam',
        'syncFS:true',
        '--initParam',
        'asciiFS:true',
        '--astHandlerModule',
        path.join(__dirname, 'freeVarsAstHandler.js'),
        script
    ].concat(scriptArgs);
    runNodeProg('node', loggingAnalysisArgs, "run of script ", function(code) {
        if (code !== 0) {
            logger.info("run of script failed");
            return;
        }
        if (cb && typeof cb == 'function') {
            var logFile = path.resolve('ascii-trace.log');
            cb(fs.readFileSync(logFile).toString());
        }
        logger.info("run of script complete");
        // run the lifetime analysis
    });
}

function findbug(args) {
    var parser = new argparse.ArgumentParser({
        prog: "",
    });

    parser.addArgument(['filepath'], {
        help: "path of trace file to analyze"
    });
    parser.addArgument(['-t'], {
        help: 'time limit'
    });
    var parsed = parser.parseArgs(args);
    var traceFile = parsed.filepath;
    var timeLimit = parsed.timeLimit || default_detect_timeLimit; //default time limit for detecting bugs is 1 hour

    //var traceFile = file[0];
    if (fs.statSync(traceFile).isDirectory()) {
        traceFile = path.resolve(traceFile, './ascii-trace.log');
    }
    var AVDetector = require('./Detector.js').AVDetector;
    var detector = new AVDetector();
    detector.detect(traceFile, timeLimit,  function() {
        logger.info('Done detecting av bugs, find ', detector.reports.length, 'bugs.');
    });
}

function inspect(args, cb) {
    logger.info('inspecting what happens inside avdetector...');
    cb = cb || function() { /*do nothing*/ }
    var parser = new argparse.ArgumentParser({
        prog: "",
    });

    parser.addArgument(['filepath'], {
        help: "path of trace file to analyze"
    });
    parser.addArgument(['-e', '--eid'], {});
    parser.addArgument(['-i', '--iid'], {});
    parser.addArgument(['-n', '--name'], {});
    parser.addArgument(['-l', '--location'], {
        help: 'format: filename#startLine#endLine'
    });
    parser.addArgument(['-at', '--accessType'], {})
    parser.addArgument(['-et', '--logEntryType'], {})
    parser.addArgument(['-a', '--aid'], {action: 'storeTrue'});

    parser.addArgument(['-r', '--reports'], {
        action: 'storeTrue'
    });

    parser.addArgument(['-t', '--timeLimit'], {
        help: 'time limit for detecting bugs'
    });

    var parsed = parser.parseArgs(args);
    var traceFile = parsed.filepath;
    if (!traceFile.endsWith('.log') && traceFile.length < 128 && fs.statSync(traceFile).isDirectory()) {
        traceFile = path.resolve(traceFile, './ascii-trace.log');
    }
    var TraceParser = require('./TraceParser.js').TraceParser;
    var AVDetector = require('./Detector.js').AVDetector;
    var traceParser = new TraceParser();
    var detector = new AVDetector(traceParser);
    traceParser.parse(traceFile, function(result) {
        logger.info('result.numberOfEvents is: '+result.numberOfEvents);
	var all = result.all;
        var graph = result.graph;
        var manager = result.manager;

        var eid = parsed.eid;
        var aid = parsed.aid;
        var iid = parsed.iid;
        var name = parsed.name;
        var location = parsed.location;
        var accessType = parsed.accessType;
        var logEntryType = parsed.logEntryType;

        var reports = parsed.reports;
        var timeLimit = parsed.timeLimit || default_detect_timeLimit; //default: 1 hour
        var exeContextMap = {};
        var datares = [];
        if (eid || iid || name || location || accessType || logEntryType || aid) {
            var info = 'Involved data access satisfying condition "' + args.slice(1).join(' ') + '"';
            for (var lno in all) {
                var rcd = all[lno];
                if (eid && (!rcd.eid || rcd.eid != eid))
                    continue;
                if (iid && (!rcd.iid || rcd.iid != iid))
                    continue;
                if (name && (!rcd.name || rcd.name != name))
                    continue;
                if (location) { //file:startline:endline
                    if (!rcd.location)
                        continue;
                    var locArr = location.split('#');
                    var rcdLocArr = rcd.location.split('#');
                    if (locArr[0] != rcdLocArr[0] || locArr[1] > rcdLocArr[1] || locArr[2] < rcdLocArr[3])
                        continue;
                }
                if (accessType && (!rcd.accessType || rcd.accessType != accessType))
                    continue;
                if (logEntryType && (!rcd.logEntryType || rcd.logEntryType.indexOf(logEntryType)<0))
                    continue;
                if (aid && !rcd.asyncId)
                    continue;
                datares.push(rcd);
                //info += rcd.toString()+'\n';
            }
            logger.info(info + '\n', datares.join('\n'));
            //logger.info('\nsubgraph of involved execution context:\n', graph.subgraph(datares).join('\n'));
            return datares;
        }

        if (reports) {
            detector.detect(result, timeLimit, function(reps) {
                //logger.info('Done detecting av bugs, find ', reps.length, 'bugs.\n', reps.join('\n\n'));

                logger.info('Done detecting AV bugs');
                return cb(reps);
            });
            return;
        }
        //print all records
        logger.info('All records in the trace file ', traceFile.endsWith('.log') ? traceFile : 'traceFile:', '\n', new MultiLayerMap(all).valueArray(1).join('\n'));
        return cb(new MultiLayerMap(all).valueArray(1));

    });

}

/**
    parse the collected trace (ascii-trace.log) and save the parsed information into JSON files
    note: the argument is the directory where trace file is located
*/
function detect(args,cb) {
cb=cb||function () {/*do nothing*/};
    var parser=new argparse.ArgumentParser({
        version:'0.0.1',
        addHelp:true,
        description:'parser the collected trace'
    });
    parser.addArgument(['filepath'], {
        help: 'the path of trace file'
    });
    parser.addArgument(['-race'], {
        help: 'detect atomicity violations or races, default to false',
        action: 'storeTrue'
    });
    /*parser.addArgument(
        ['filepath'],
        {
            help: 'the path of trace file to parse'
        }
    );*/
	parser.addArgument(['-chain'], {
		help: 'present callback chain information about participators of a race',
		action: 'storeTrue'
	});
    var parserd = parser.parseArgs(args),
		traceFile = parserd.filepath,
		race = parserd.race,
		chain = parserd.chain;
	
    if (!traceFile.endsWith('.log') && traceFile.length<128 && fs.statSync(traceFile).isDirectory()) {
        traceFile=path.resolve(traceFile,'./ascii-trace.log');
    }

    pythonScript=__dirname+'/Detector.py';
    //cliArgs=[pythonScript, traceFile];
    var cliArgs=[]
    cliArgs.push(pythonScript, traceFile)
    if (race) {
        cliArgs.push('t');
    } else {
        cliArgs.push('f');
    }
	if (chain) {
		cliArgs.push('t');
	} else {
		cliArgs.push('f');
	}
    runPythonProg('python',cliArgs, 'parse and detect');
};

/**
 * 
 * @param {*} args 
 * @param {*} cb 
 */
function testDriver (args, cb) {
    cb = cb || function () {/*do nothing*/};
    console.log('Hi, successfully arrive drive.js!');
};

function typeerrorDetect (args, cb) {
    logger.info('detect possible TypeError ...');
    cb = cb || function () {/*do nothing */};
    
    var parser = new argparse.ArgumentParser({
        prog: 'typeerror inspect',
        addHelp: true,
        description: 'detect possible racy typeerror in the given trace'
    });
    parser.addArgument(['tracefile'], {help: 'the path of analyzed trace'});
    var parsed = parser.parseArgs(args),
        traceFile = parsed.tracefile;
    if (!traceFile.endsWith('.log') && traceFile.length<128 && fs.statSync(traceFile).isDirectory()) {
        traceFile=path.resolve(traceFile,'./ascii-trace.log');
    }
    logger.info('inspecting previous run ' + traceFile);
    if(!fs.existsSync(traceFile)){
        logger.error('path ' + traceFile + " does not exist");
        process.exit(1);
    }
    //Ok, we have the trace file. parse it and detect.
    var TraceParser = require('../lib/typeerrorDetect/traceParser.js').TraceParser,
        traceParser = new TraceParser();
    traceParser.parse(traceFile, cb);
    var cb = function () {/*TODO: code cb after completion of parsing */};
}

/**
 * start the relevant servers to proxy and instrument a live web site
 * @param args
 */
function exec(args, cb) {
    switch (args[0]) {
        case 'instrument':
            instrumentApp(args.slice(1));
            break;
        case 'noderun':
            runNodeScript(args.slice(1));
            break;
        case 'nodeinstrun':
            instAndRunNodeScript(args.slice(1), cb);
            break;
        case 'findbug':
            findbug(args.slice(1));
            break;
        case 'inspect':
            inspect(args.slice(1), cb);
            break;
        case 'detect':
            detect(args.slice(1),cb);
            break;
        case 'testdriver':
            testDriver(args.slice(1), cb);
            break;
        case 'typeerror':
            typeerrorDetect(args.slice(1), cb);
            break;
        default:
            var msg = 'Surppoted commands:\n' +
                '   instrument path/to/app  --instrument node.js applications in local filesystems.\n' +
                '   noderun path/to/app  args   --excercise an node.js application\n' +
                '   nodeinstrun path/to/app/main.js args    --online instrumentation for node.js applications\n' +
                '   findbug path/to/tracefile   --analyze the trace file to find atomicity violation bugs\n' +
                '   inspect path/to/tracefile    --inspect result\n'+
                '   detect path/to/traceFile    --parse the trace file and detect possible atomicity violations or races\n' +
                '   typeerror path/to/traceFile --parse the trace file and detect possible typeError\n';

            throw new Error(msg);
    }

}
exports.instrumentApp = instrumentApp;
exports.runNodeScript = runNodeScript;
exports.instAndRunNodeScript = instAndRunNodeScript;
exports.exec = exec;
exports.runNodeProg = runNodeProg;
