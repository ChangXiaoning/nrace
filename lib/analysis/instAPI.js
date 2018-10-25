var jalangi = require('./jalangi2/src/js/utils/api.js');
var path = require('path');
var Q = require('q');
var child_process = require('child_process');
var fs = require('fs');
var rimraf = require('rimraf');
var loggingAnalysis = require("path").join(__dirname, 'TraceCollector.js');
require('./jalangi2/src/js/instrument/astUtil.js');
require('./configUtil.js');
var getFreeVars = require('./freeVarsAstHandler.js');
exports.browserAnalysisFiles = [
    path.join(__dirname, '../../node_modules/estraverse/estraverse.js'),
    path.join(__dirname, '../../node_modules/escope/escope.js'),
    path.join(__dirname, './configUtil.js'),
    path.join(__dirname, './logger.js'),
    loggingAnalysis
];
function instScriptAndGetMetadata(script, instOptions) {
    instOptions.instHandler = J$.configUtil.instHandler;
    instOptions.astHandler = getFreeVars;
    var instResult = jalangi.instrumentString(script, instOptions);
    var code = instResult.code;
    return { instCode: code, iidSourceInfo: instResult.sourceMapObject };
}
exports.instScriptAndGetMetadata = instScriptAndGetMetadata;
function instrumentScriptMem(script, instOptions) {
    // let's assume we want to embed source maps for now
    instOptions.inlineSourceMap = true;
    var instResult = instScriptAndGetMetadata(script, instOptions);
    var outputFileName = instOptions.outputFile;
    fs.writeFileSync(outputFileName, instResult.instCode);
}
exports.instrumentScriptMem = instrumentScriptMem;
function getTraceForJS(script, instOptions, debugFun) {
    instOptions.inputFileName = script;
    instrumentScriptMem(String(fs.readFileSync(script)), instOptions);
    // run direct analysis
    var curDir = process.cwd();
    var outputDir = path.dirname(instOptions.outputFile);
    var otherOpts = debugFun ? { debugFun: debugFun } : {};
    otherOpts.syncFS = true;
    process.chdir(outputDir);
    var directPromise = jalangi.analyze(path.basename(instOptions.outputFile), [loggingAnalysis], otherOpts);
    var deferred = Q.defer();
    var handler = function (result) {
        process.chdir(curDir);
        var memTraceResult = {
            stdout: result.stdout,
            stderr: result.stderr,
            memTraceLoc: path.join(outputDir, 'mem-trace')
        };
        deferred.resolve(memTraceResult);
    };
    // the direct promise is rejected when we get an error code from the child process.
    // but, this might just be due to an uncaught exception in the underlying program.
    // so, use the same handler for resolve and reject.  It's up to the caller to figure
    // out of there was a real problem
    directPromise.then(handler, handler);
    return deferred.promise;
}
exports.getTraceForJS = getTraceForJS;
function instrumentHTMLDir(testDir, options, selenium) {
    var instOptions = {
        copy_runtime: true,
        inbrowser: true,
        analysis: exports.browserAnalysisFiles,
        inputFiles: [testDir],
        inlineIID: true
    };
    if (options.outputDir) {
        instOptions.outputDir = options.outputDir;
        // blow away existing directory
        var appDir = options.outputDir; //path.join(options.outputDir, path.basename(testDir));
        if (fs.existsSync(appDir)) {
            try{
                rimraf.sync(path.join(appDir, testDir));
                //rimraf.sync(appDir);
            }catch(e){ /*do nothing*/ }
        }
    }
    if (options.debugFun || options.syncAjax) {
        instOptions.initParam = [];
        if (options.debugFun) {
            instOptions.initParam.push("debugFun:" + options.debugFun);
        }
        if (options.syncAjax) {
            instOptions.initParam.push("syncAjax:" + options.syncAjax);
        }
    }
    if (options.verbose) {
        instOptions.verbose = true;
    }
    if (options.only_include) {
        instOptions.only_include = options.only_include;
    }
    if (selenium) {
        instOptions.selenium = true;
    }
    if(options.exclude){
        instOptions.exclude = options.exclude;
    }
    instOptions.instHandler = J$.configUtil.instHandler;
    instOptions.astHandler = getFreeVars;
    return jalangi.instrumentDir(instOptions);
}
exports.instrumentHTMLDir = instrumentHTMLDir;
function getTraceForHTMLDir(testDir, options) {
    var instPromise = instrumentHTMLDir(testDir, options, true);
    // load instrumented code and generate trace
    var tracePromise = instPromise.then(function (result) {
        var outputDir = path.join(result.outputDir, path.basename(testDir));
        var deferred = Q.defer();
        // start up the server, which will just dump the mem trace
        var memTraceLoc = path.join(outputDir, 'mem-trace');
        var serverArgs = ['./lib/server/server.js', '--outputFile', memTraceLoc, outputDir];
        var serverProc = child_process.spawn('node', serverArgs, {
            cwd: process.cwd(),
            env: process.env,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        var stdout = "", stderr = "";
        serverProc.stdout.on('data', function (chunk) {
            stdout += chunk.toString();
            // TODO fix this hack
            if (chunk.toString().indexOf("8080") !== -1) {
                // now fire up the phantomjs process to load the instrumented app
                child_process.exec(['phantomjs', './drivers/phantomjs-runner.js'].join(" "), function (error, stdout, stderr) {
                    if (error !== null) {
                        console.log(stdout);
                        console.log(stderr);
                        deferred.reject(error);
                    }
                });
            }
        });
        serverProc.stderr.on('data', function (chunk) {
            stderr += chunk.toString();
        });
        serverProc.on('exit', function () {
            var memTraceResult = {
                stdout: stdout,
                stderr: stderr,
                memTraceLoc: memTraceLoc
            };
            deferred.resolve(memTraceResult);
        });
        serverProc.on('error', function (err) {
            deferred.reject(err);
        });
        return deferred.promise;
    });
    return tracePromise;
}
exports.getTraceForHTMLDir = getTraceForHTMLDir;
function instrumentScriptsMem(scripts, options) {
    var instOptions = {
        copy_runtime: true,
        inbrowser: true,
        analysis: exports.browserAnalysisFiles,
        inputFiles: scripts,
        inlineIID: true
    };
    if (options.outputDir) {
        instOptions.outputDir = options.outputDir;
    }
    if (options.debugFun || options.syncAjax) {
        instOptions.initParam = [];
        if (options.debugFun) {
            instOptions.initParam.push("debugFun:" + options.debugFun);
        }
        if (options.syncAjax) {
            instOptions.initParam.push("syncAjax:" + options.syncAjax);
        }
    }
    if (options.verbose) {
        instOptions.verbose = true;
    }
    if (options.only_include) {
        instOptions.only_include = options.only_include;
    }
    instOptions.instHandler = J$.configUtil.instHandler;
    instOptions.astHandler = getFreeVars;
    return jalangi.instrumentDir(instOptions);
}
exports.instrumentScriptsMem = instrumentScriptsMem;
