var mkdirp = require('mkdirp');
var path = require('path');
var fs = require('fs');
var instAPI = require('../lib/analysis/instAPI');
var Q = require('q');
var argparse = require('argparse');
var parser = new argparse.ArgumentParser({
    addHelp: true,
    description: "Command-line utility to generate memory trace"
});
parser.addArgument(['--debugFun'], { help: "function name for debug logging" });
parser.addArgument(['--only_include'], { help: "list of path prefixes specifying which sub-directories should be instrumented, separated by path.delimiter" });
parser.addArgument(['--syncAjax'], { help: "use synchronous AJAX calls for logging", action: 'storeTrue' });
parser.addArgument(['--outputDir'], { help: "directory in which to place instrumented files and traces.  " + "We create a new sub-directory for our output.", required: true });
parser.addArgument(['--justGenerate'], { help: "just instrument and generate metadata, but don't produce mem-trace", action: 'storeTrue' });
parser.addArgument(['--verbose'], { help: "print verbose output", action: 'storeTrue' });
parser.addArgument(['--exclude'], { help: "do not instrument any scripts whose file path contains this substring"});
parser.addArgument(['inputFile'], { help: "Either a JavaScript file or an HTML app directory with an index.html file" });

var args = parser.parseArgs();
var outputDir = args.outputDir;
var jsFile = !fs.statSync(args.inputFile).isDirectory();

var promise, trueOutputDir;
if (jsFile) {
    var script = args.inputFile;
    trueOutputDir = path.join(outputDir, path.basename(script, '.js') + "_inst");
    mkdirp.sync(trueOutputDir);
    var instScript = path.join(trueOutputDir, path.basename(script, '.js') + "_jalangi_.js");
    var instOptions = {
        outputFile: instScript,
        inputFileName: path.resolve(script)
    };
    if (args.justGenerate) {
        instAPI.instrumentScriptMem(String(fs.readFileSync(script)), instOptions);
        promise = Q(null);
    }
    else {
        promise = instAPI.getTraceForJS(script, instOptions, args.debugFun);
    }
}
else {
    var inputDirName = args.inputFile;
    if (args.justGenerate) {
        promise = instAPI.instrumentHTMLDir(inputDirName, {
            outputDir: outputDir,
            debugFun: args.debugFun,
            verbose: args.verbose,
            syncAjax: args.syncAjax,
            only_include: args.only_include,
            exclude: args.exclude
        }, false);
    }
    else {
        if (args.syncAjax) {
            throw new Error("must use syncAjax flag along with justGenerate flag");
        }
        promise = instAPI.getTraceForHTMLDir(inputDirName, {
            outputDir: outputDir,
            debugFun: args.debugFun,
            verbose: args.verbose
        });
    }
    trueOutputDir = path.join(outputDir, path.basename(inputDirName));
}
promise.then(function (result) {
    if (result && result.stdout) {
        console.log(result.stdout);
    }
    if (result && result.stderr) {
        console.log("error output: ");
        console.log(result.stderr);
    }
}).done();
//# sourceMappingURL=memTraceDriver.js.map
