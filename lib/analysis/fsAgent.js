//JALANGI DO NOT INSTRUMENT
var fs = require('fs');

function defaultLog(namespace, fname, args){
//    console.log(namespace+'.'+fname + ' is called,', args && typeof args.join == 'function'?args.join(', '):'');
}

var logFsPre = defaultLog;
var logFs = defaultLog;
var logCtx = null;
if(typeof J$ !='undefined' && J$.analysis && J$.analysis.tracer){
    logFsPre = J$.analysis.tracer.logFsPre;
    logFs = J$.analysis.tracer.logFs;
    logCtx = J$.analysis.tracer;
}

function retrieveLoc(stack){
    var line = stack.split('\n')[5];
    return line?line.substring(line.indexOf('at ')+3):'unknown';
}

function createAgent(orig, namespace){
    var agent = Object.create(orig);
    for(var n in orig){
        if(typeof orig[n] == 'function'){
            if(!n.match('^[A-Z].*')){
               agent[n] = (function(fname){
                    return function(){
                        var loc = retrieveLoc(new Error().stack);
                        var stat = logFsPre.call(logCtx, namespace, fname, arguments, loc, undefined, this._file);
                        var res = orig[fname].apply(orig, arguments);
                        var _fd = typeof res == 'number'?res:undefined;
                        logFs.call(logCtx, namespace, fname, arguments, loc, _fd, this._file, stat);
                        
                        if(fname == 'createReadStream' || fname == 'createWriteStream'){
                            res = createAgent(res, fname == 'createReadStream'? 'readStream':'writeStream'); 
                            res._file = arguments[0];
                        }
                        return res;
                    }
                })(n);
            }
        };
    }
    return agent;
}
module.exports = createAgent(fs, 'fs');
