var util = require('./util'),
    fs = require('fs');

var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};

var isDebugging = false;

// how often should we flush last use information?
// TODO set up a setInterval() script that also flushes last use, so we flush when the application is idle
var LAST_USE_FLUSH_PERIOD = 10000;
/**
 * these are some handy utilities for any implementation of Tracer to have.
 * this class doesn't implement the Tracer interface since we can't actually
 * make it an abstract class.
 */
//var LogEntryType = ___TraceCollector___.LogEntryType;
var LogEntryType = util.LogEntryType,
    ALREADY_FLUSHED = util.ALREADY_FLUSHED;

var AbstractTracer = (function () {
    function AbstractTracer() {
        /**
         * time stamp of *previous* log entry
         */
        this.time = -1;
        /**
         * the time at which we most recently flushed last-use information
         * @type {number}
         */
        /**
         * either the IID of the most recent top-level expression, or -1 if
         * we've already emitted a TOP_LEVEL_FLUSH for that most-recent expression
         * @type {number}
         */
        this.flushIID = ALREADY_FLUSHED;
        this.tracingStopped = false;
        /**
         * the script ID for the currently-executing script
         * @type {number}
         */
        this.currentScriptId = -1;
    }
    AbstractTracer.prototype.getTime = function () {
        return this.time;
    };
    AbstractTracer.prototype.setFlushIID = function (sourceFileId, iid) {
        if (this.flushIID !== ALREADY_FLUSHED) {
            throw new Error("invalid flush IID value " + this.flushIID);
        }
        this.flushIID = sourceFileId + ':' + iid;
    };
    AbstractTracer.prototype.getFlushIID = function () {
        return this.flushIID;
    };
    AbstractTracer.prototype.stopTracing = function () {
        this.tracingStopped = true;
    };
    /**
     * actions before logging an entry
     * @return true if logging should continue, false otherwise
     */
    AbstractTracer.prototype.beforeLog = function (fromLastUse){
        return true;
    };
    AbstractTracer.prototype.logTopLevelFlush = function (slId) {
        throw new Error("should be overridden by subclass!");
    };
    AbstractTracer.prototype.logUpdateCurrentScript = function (sid) {
        throw new Error("should be overridden by subclass!");
    };
    return AbstractTracer;
})();
/**
 * tracer that writes data using a fluent interface.
 * the fluent interface is implemented in subclasses,
 * defining the data format
 */
var AbstractFluentTracer = (function (_super) {
    var lastAsyncId = -1;
    __extends(AbstractFluentTracer, _super);
    function AbstractFluentTracer() {
        _super.apply(this, arguments);
    }
    ///////////////
    // fluent interface for writing out data
    ///////////////
    AbstractFluentTracer.prototype.flushIfNeeded = function (nextRecordLength) {
        throw new Error("override in subclass!");
    };
    AbstractFluentTracer.prototype.writeByte = function (val) {
        throw new Error("override in subclass!");
    };
    AbstractFluentTracer.prototype.writeInt = function (val) {
        throw new Error("override in subclass!");
    };
    AbstractFluentTracer.prototype.strLength = function (val) {
        throw new Error("override in subclass!");
    };
    AbstractFluentTracer.prototype.writeString = function (val) {
        throw new Error("override in subclass!");
    };
    AbstractFluentTracer.prototype.writeType = function(type){
        if(isDebugging)
            this.writeString('/*'+ LogEntryType[type]+'*/'); //@jie: to remove
        return this.writeByte(type);
    }
    AbstractFluentTracer.prototype.writeTypeAndIID = function (type, iid) {
        this.writeType(type);
        if(iid) this.writeInt(iid);
        return this;
    };
    AbstractFluentTracer.prototype.logDeclare = function (iid, refId, name, objId) {
        if (!this.beforeLog(iid))
            return;
        if(name!='arguments' && name != 'this')
            this.flushIfNeeded().writeTypeAndIID(LogEntryType["DECLARE"] , iid).writeInt(refId).writeString(name).writeInt(objId).writeRt();
    };
    AbstractFluentTracer.prototype.logCreateObj = function (iid, objId, name) {
        //return;
        if (!this.beforeLog())
            return;
        this.flushIfNeeded().writeTypeAndIID(LogEntryType["CREATE_OBJ"], iid).writeInt(objId).writeString(name).writeRt();
    };
    AbstractFluentTracer.prototype.logCreateObjDiffScript = function (sid, iid, objId) {
        return;
        //TODO: deal with different script
        if (!this.beforeLog())
            return;
        // write an update script entry for the sid parameter, followed by the create obj entry,
        // followed by an update script entry back to the current script
        this.logUpdateCurrentScript(sid);
        this.flushIfNeeded().writeTypeAndIID(LogEntryType["CREATE_OBJ"], iid).writeInt(objId).writeRt();
        this.logUpdateCurrentScript(J$.sid);
    };
    AbstractFluentTracer.prototype.logCreateFun = function (iid, funEnterIID, objId, name) {
        if (!this.beforeLog())
            return;
        this.flushIfNeeded().writeTypeAndIID(LogEntryType["CREATE_FUN"], iid).writeInt(funEnterIID).writeInt(objId).writeString(name).writeRt();
    };
    AbstractFluentTracer.prototype.logPutfield = function (iid, baseObjId, propName, valObjId, isOpAssign, valIsObject, isComputed) {
        if (!this.beforeLog(iid))
            return;
        this.flushIfNeeded().writeTypeAndIID(LogEntryType["PUTFIELD"], iid).writeInt(baseObjId).writeString(propName).writeInt(valObjId).writeByte(isOpAssign).writeByte(valIsObject).writeByte(isComputed).writeRt();
    };
    AbstractFluentTracer.prototype.logDelete = function (iid, baseObjId, propName) {
        if (!this.beforeLog())
            return;
        this.flushIfNeeded().writeTypeAndIID(LogEntryType["DELETE"], iid).writeInt(baseObjId).writeString(propName).writeRt();
    }
    AbstractFluentTracer.prototype.logGetfield = function (iid, baseObjId, propName, valObjId, valIsObject, isComputed) {
        if (!this.beforeLog(iid))
            return;
        this.flushIfNeeded().writeTypeAndIID(LogEntryType["GETFIELD"], iid).writeInt(baseObjId).writeString(propName).writeInt(valObjId).writeByte(valIsObject).writeByte(isComputed).writeRt();
    }
    AbstractFluentTracer.prototype.logWrite = function (iid, refId, name, objId, valIsObject) {
        if (!this.beforeLog(iid))
            return;
        this.flushIfNeeded().writeTypeAndIID(LogEntryType["WRITE"], iid).writeInt(refId).writeString(name).writeInt(objId).writeByte(valIsObject).writeRt().logCallStack(['W', iid, refId, name]);
    };
    AbstractFluentTracer.prototype.logRead = function (iid, refId, name, objId, valIsObject) {
        if (!this.beforeLog())
            return;
        this.flushIfNeeded().writeTypeAndIID(LogEntryType["READ"], iid).writeInt(refId).writeString(name).writeInt(objId).writeByte(valIsObject).writeRt().logCallStack(['R', iid, refId, name]);
    };
    AbstractFluentTracer.prototype.logLiteral = function (iid, objId) {
        if (!this.beforeLog())
            return;
        this.flushIfNeeded().writeTypeAndIID(LogEntryType["LITERAL"], iid).writeInt(objId).writeRt();
    }
    //xiaoning: add logInvokeFun
    AbstractFluentTracer.prototype.logInvokeFun = function (iid, fName, args) {
        //TODO: capture delay time from args <Array>
        if (!this.beforeLog())
            return;
        this.flushIfNeeded().writeTypeAndIID(LogEntryType["INVOKE_FUN"], iid).writeString(fName).writeString(args).writeRt();
        /*
        if (fName == 'createReadStream' || fName == 'createWriteStream')
            this.flushIfNeeded().writeTypeAndIID(LogEntryType["INVOKE_FUN"], iid).writeString(fName).writeString(args[0]).writeRt();
        else
            this.flushIfNeeded().writeTypeAndIID(LogEntryType["INVOKE_FUN"], iid).writeString(fName).writeRt();
        */
    };
    
    /* fs API interfaces:
        
        // modeled:
        fs.exists(path, callback)
        fs.existsSync(path)

        fs.stat(path, callback)
        fs.statSync(path)

        fs.copyFile(src, dest[, flags], callback)
        fs.copyFileSync(src, dest[, flags])

        fs.link(existingPath, newPath, callback)
        fs.linkSync(existingPath, newPath)
        fs.symlink(target, path[, type], callback)
        fs.symlinkSync(target, path[, type])

        fs.unlink(path, callback)
        fs.unlinkSync(path)
        fs.truncate(path[, len], callback)
        fs.truncateSync(path[, len])

        fs.ftruncate(fd[, len], callback)
        fs.ftruncateSync(fd[, len])
        fs.rename(oldPath, newPath, callback)
        fs.renameSync(oldPath, newPath)

        fs.appendFile(file, data[, options], callback)
        fs.appendFileSync(file, data[, options])

        fs.read(fd, buffer, offset, length, position, callback)
        fs.readdir(path[, options], callback)
        fs.readdirSync(path[, options])
        fs.readFile(path[, options], callback)
        fs.readFileSync(path[, options])
        fs.readlink(path[, options], callback)
        fs.readlinkSync(path[, options])
        fs.readSync(fd, buffer, offset, length, position)

        fs.write(fd, buffer[, offset[, length[, position]]], callback)
        fs.write(fd, string[, position[, encoding]], callback)
        fs.writeFile(file, data[, options], callback)
        fs.writeFileSync(file, data[, options])
        fs.writeSync(fd, buffer[, offset[, length[, position]]])
        fs.close(fd, callback)
        fs.closeSync(fd)
        fs.open(path, flags[, mode], callback)
        fs.openSync(path, flags[, mode])
        
        fs.mkdir(path[, mode], callback)
        fs.mkdirSync(path[, mode])
        fs.rmdir(path, callback)
        fs.rmdirSync(path)
    
        fs.createReadStream(path[, options])
        fs.createWriteStream(path[, options])
        
        //ignored APIs:

        fs.chmod(path, mode, callback)
        fs.chmodSync(path, mode)
        fs.chown(path, uid, gid, callback)
        fs.chownSync(path, uid, gid)
        fs.constants

        fs.fchmod(fd, mode, callback)
        fs.fchmodSync(fd, mode)
        fs.fchown(fd, uid, gid, callback)
        fs.fchownSync(fd, uid, gid)
        fs.fdatasync(fd, callback)
        fs.fdatasyncSync(fd)
        fs.fstat(fd, callback)
        fs.fstatSync(fd)
        fs.fsync(fd, callback)
        fs.fsyncSync(fd)
        fs.futimes(fd, atime, mtime, callback)
        fs.futimesSync(fd, atime, mtime)
        fs.lchmod(path, mode, callback)
        fs.lchmodSync(path, mode)
        fs.lchown(path, uid, gid, callback)
        fs.lchownSync(path, uid, gid)
        fs.lstat(path, callback)
        fs.lstatSync(path)
        fs.mkdtempSync(prefix[, options])
        fs.realpath(path[, options], callback)
        fs.realpath.native(path[, options], callback)
        fs.realpathSync(path[, options])
        fs.realpathSync.native(path[, options])
        fs.mkdtemp(prefix[, options], callback)
        fs.utimes(path, atime, mtime, callback)
        fs.utimesSync(path, atime, mtime)
        fs.access(path[, mode], callback)
        fs.accessSync(path[, mode])
        //fs.unwatchFile(filename[, listener])
        //fs.watch(filename[, options][, listener])
        //fs.watchFile(filename[, options], listener)

        */


    //[accessType, resourceIdx]
    var _fsFunMap_bak = {
        'write|append|truncate': ['WRITE', 0],
        'unlink|rmdir': ['DELETE', 0],
        'read' : ['READ', 0],
        'access|exists|stat' : ['STAT', 0],
        'copy':['READ', 0,'WRITE',1],
        'link':['READ', 0,'WRITE',1],
        'rename':['DELETE', 0, 'WRITE', 1],
        'open':['OPEN', 0], //TODO: need to distinguash the opending mode
        'close':['CLOSE', 0],
        'mkdir':['CREATE', 0],
        'createReadStream':['READ', 0],
        'createWriteStream':['WRITE', 0]
    };
    
    //xiaoning:
    var _fsFunMap = {
        'write|append|truncate': ['WRITE', 0],
        'unlink|rmdir': ['DELETE', 0],
        'read': ['READ', 0],
        'access|exists|stat': ['STAT', 0],	
        'copy': ['READ', 0, 'WRITE', 1],
        'link': ['READ', 0, 'WRITE', 1],
        'rename': ['DELETE', 0, 'WRITE', 1],
        'open': ['OPEN', 0],	
        'close': ['CLOSE', 0],	
        'mkdir': ['CREATE', 0],
        'createReadStream': ['READ', 0],
        'createWriteStream': ['WRITE', 0],
        'end': ['CLOSE']
    };

    //return if a file exists before open
    AbstractFluentTracer.prototype.logFsPre = function(ref, funName, args, location, fd, file){
        if(ref=='fs' && funName =='open'){
            return {exists: fs.existsSync(args[0])};
        }
    }
    var _fdCache = {}

    AbstractFluentTracer.prototype.logFs = function(ref, funName, args, location, fd, file, stat){
        //console.log('ref: ' + ref + '\nfunName: ' + funName + '\n');
        var that = this;
        var path = require('path');
        function _logFs (entryType, resource, ref, funName, location, isAsync){
            //@param isAsync <Int>
            if(!that.beforeLog(location))
                return;
            if(typeof resource == 'string')
                resource = path.resolve(process.cwd(), resource);
            that.flushIfNeeded().writeType(LogEntryType[entryType]).writeString(resource).writeString(ref).writeString(funName).writeInt(lastAsyncId).writeString(location).writeInt(isAsync).writeRt();
            lastAsyncId = -1;
        }

        function _doLog (accessType, resource, isAsync){
            //if(!that.beforeLog(location))
            if(accessType =='OPEN'){
                if(stat && stat.exists == false){
                    _logFs('FS_CREATE', args[0], ref, funName, location, isAsync);
                }
                _logFs('FS_'+accessType, args[0], ref, funName, location, isAsync);
                _fdCache[fd] = args[0];
            }else if(accessType == 'CLOSE'){
                _logFs('FS_'+accessType, args[0], ref, funName, location, isAsync);
                delete _fdCache[args[0]];
            }else if(funName.match('create(Read|Write)Stream')){
                isAsync = 0;
                _logFs('FS_OPEN',args[0], ref, funName, location, isAsync);
                //_logFs('FS_'+accessType,args[0], ref, funName, location);
            }else{
                //just record current record 
                _logFs('FS_'+accessType, resource, ref, funName, location, isAsync);
            }
        }

        var isAsync, resource, accessType, _cb, _cb_idx;
        if(ref == 'fs'){
            if(funName.match("Sync")) {
                isAsync = 0;
            } else {
                isAsync = 1;
            }
            for(var ptn in _fsFunMap){
                if(funName.match(ptn)){
                    var _Finfo = _fsFunMap[ptn];
                    accessType = _Finfo[0];
                    resource = args[_Finfo[1]];
                    if(typeof resource == 'number')
                        resource = _fdCache.hasOwnProperty(resource)?_fdCache[resource]:'fd'+resource;
                    _doLog(accessType, resource, isAsync); 
                    if(_Finfo.length == 4){
                        accessType = _Finfo[2];
                        resource = _fdCache.hasOwnProperty(_Finfo[3])?_fdCache[_Finfo[3]]:_Finfo[3];
                        _doLog(accessType, resource, isAsync);
                    }
                    break;
                }
            }
        }else if(ref == 'readStream'){
            isAsync = 1;
            if(funName == 'emit'){
                if(args[0] =='data'){
                    _logFs('FS_READ', file, ref, funName+'_'+args[0], location, isAsync);
                }else if(args[0] == 'close'){
                    _logFs('FS_STAT_CLOSED', file, ref, funName+'_'+args[0], location, isAsync);
                }
            }else if(funName == 'pipe'){
                _logFs('FS_READ', file, ref, funName, location, isAsync);
                _logFs('FS_WRITE', args[0]._file, ref, funName, location, isAsync);
            }else if(funName == 'read'){
                _logFs('FS_READ', file, ref, funName, location, isAsync);
            }
        }else if(ref == 'writeStream'){
            isAsync = 1;
            if(funName == 'emit'){
                if(args[0] == 'close'){
                    _logFs('FS_STAT_CLOSED', file, ref, funName+'_'+args[0], location, isAsync);
                }
            }else if(funName == 'write'){
                _logFs('FS_WRITE', file, ref, funName, location, isAsync);
            }else if(funName == 'end'){
                _logFs('FS_CLOSE', file, ref, funName, location, isAsync);
            } 
        }
    }
    //xiaoning: add the function name
    AbstractFluentTracer.prototype.logFunctionEnter = function (iid, fName, current) {
        if (!this.beforeLog() || !LogEntryType.hasOwnProperty('FUNCTION_ENTER'))
            return;
        this.flushIfNeeded().writeTypeAndIID(LogEntryType["FUNCTION_ENTER"], iid).writeString(fName).writeInt(current).writeRt();
    };
    AbstractFluentTracer.prototype.logCallStack = function(arr){
        return;
        var stack = new Error().stack; //@jie: TODO only is called in debug mode
        //logger.debug('eid:'+this.getExecutionAsyncId()+', (R/W, iid, refId, name): (' + arr +')');
        //xiaoning:bug
        return this;
    }
    /** xiaoning: add returnValue in log */
    AbstractFluentTracer.prototype.logFunctionExit = function (iid, returnValue) {
        if (!this.beforeLog() || !LogEntryType.hasOwnProperty('FUNCTION_EXIT'))
            return;
        this.flushIfNeeded().writeTypeAndIID(LogEntryType["FUNCTION_EXIT"], iid).writeInt(returnValue).writeRt();
    };
    AbstractFluentTracer.prototype.logUpdateIID = function (objId, newIID) {
        if (!this.beforeLog())
            return;
        this.flushIfNeeded().writeByte(LogEntryType["UPDATE_IID"]).writeInt(objId).writeInt(newIID).writeRt();
    };
    AbstractFluentTracer.prototype.logDebug = function (callIID, objId) {
        if (!this.beforeLog())
            return;
        this.flushIfNeeded().writeTypeAndIID(LogEntryType["DEBUG"], callIID).writeInt(objId).writeRt();
    };
    AbstractFluentTracer.prototype.logReturn = function (objId) {
        if (!this.beforeLog())
            return;
        this.flushIfNeeded().writeByte(LogEntryType["RETURN"]).writeInt(objId).writeRt();
    };
    AbstractFluentTracer.prototype.logCall = function (iid, funObjId, funEnterIID, funSID) {
        if (!this.beforeLog())
            return;
        this.flushIfNeeded().writeTypeAndIID(LogEntryType["CALL"], iid).writeInt(funObjId).writeInt(funEnterIID).writeInt(funSID).writeRt();
    };
    AbstractFluentTracer.prototype.logScriptEnter = function (iid, scriptID, filename) {
        if (!this.beforeLog())
            return;
        this.flushIfNeeded().writeTypeAndIID(LogEntryType["SCRIPT_ENTER"], iid).writeInt(scriptID).writeString(filename).writeRt();
    };
    AbstractFluentTracer.prototype.logScriptExit = function (iid) {
        if (!this.beforeLog())
            return;
        this.flushIfNeeded().writeTypeAndIID(LogEntryType["SCRIPT_EXIT"], iid).writeRt();
    };
    AbstractFluentTracer.prototype.logFreeVars = function (iid, names) {
        if (!this.beforeLog())
            return;
        if (typeof names === 'string') {
            // we write -1 before the names to distinguish the case of the string ANY
            // from the array case
            this.flushIfNeeded().writeTypeAndIID(LogEntryType["FREE_VARS"], iid).writeInt(-1).writeString(names).writeRt();
        }
        else {
            var arrayByteLength = 4; // for writing array length
            for (var i = 0; i < names.length; i++) {
                arrayByteLength += 4 + this.strLength(names[i]);
            }
            this.flushIfNeeded().writeTypeAndIID(21 /* FREE_VARS */, iid).writeInt(names.length);
            for (var i = 0; i < names.length; i++) {
                this.writeString(names[i]);
            }
            this.writeRt();
        }
        // this shouldn't have incremented the time since it is metadata
        // so, subtract 1
        this.time--;
    };
    AbstractFluentTracer.prototype.logSourceMapping = function (iid, startLine, startColumn, endLine, endColumn) {
        if (!this.beforeLog())
            return;
        this.flushIfNeeded().writeTypeAndIID(LogEntryType["SOURCE_MAPPING"], iid).writeInt(startLine).writeInt(startColumn).writeInt(endLine).writeInt(endColumn).writeRt();
        // this shouldn't have incremented the time since it is metadata
        // so, subtract 1
        this.time--;
    };
    AbstractFluentTracer.prototype.logUpdateCurrentScript = function (scriptID) {
        this.flushIfNeeded().writeTypeAndIID(LogEntryType["UPDATE_CURRENT_SCRIPT"], scriptID).writeRt();
    };
    AbstractFluentTracer.prototype.logTopLevelFlush = function (slId) {
        //logger.debug('logTopLevelFlush. slId:', slId);
        //xiaoning:bug
    };
    AbstractFluentTracer.prototype.setExecutionAsyncId = function (eid){
        this.eid = eid;
    }
    AbstractFluentTracer.prototype.getExecutionAsyncId = function (){
        return this.eid;
    }
    AbstractFluentTracer.prototype.logAsyncInit = function(asyncId, type, trigger){
        if (!this.beforeLog())
            return;
        this.flushIfNeeded().writeType(LogEntryType["ASYNC_INIT"]).writeInt(asyncId).writeString(type).writeInt(trigger).writeRt(); 
        lastAsyncId = asyncId;    
    };
    //xiaoning: log event registration for setTimeout timer
    AbstractFluentTracer.prototype.logTimerInit = function(asyncId, type, trigger, delayTime){
        if (!this.beforeLog())
            return;
        this.flushIfNeeded().writeType(LogEntryType["ASYNC_INIT_TIMER"]).writeInt(asyncId).writeString(type).writeInt(trigger).writeInt(delayTime).writeRt(); 
        lastAsyncId = asyncId;    
    };
    AbstractFluentTracer.prototype.logAsyncBefore = function(asyncId){
        if (!this.beforeLog())
            return;
        this.flushIfNeeded().writeType(LogEntryType["ASYNC_BEFORE"]).writeInt(asyncId).writeRt();
    };
    AbstractFluentTracer.prototype.logAsyncAfter = function(asyncId){
        if (!this.beforeLog())
            return;
        this.flushIfNeeded().writeType(LogEntryType["ASYNC_AFTER"]).writeInt(asyncId).writeRt();
    };
    
    AbstractFluentTracer.prototype.logAsyncDestroy = function(asyncId){
        if (!this.beforeLog())
            return;
        //this.flushIfNeeded().writeType(LogEntryType["ASYNC_DESTROY"]).writeInt(asyncId); // do not destroy
    };
    AbstractFluentTracer.prototype.logAsyncPromiseResolve = function(asyncId, eid, trigger){
        if (!this.beforeLog())
            return;
        this.flushIfNeeded().writeType(LogEntryType["ASYNC_PROMISERESOLVE"]).writeInt(asyncId).writeInt(eid).writeInt(trigger).writeRt();
    };
    AbstractFluentTracer.prototype.logPromiseAllBegin = function (currentId, triggerId) {
        if(!this.beforeLog())
            return;
        this.flushIfNeeded().writeType(LogEntryType["PROMISE_ALL_BEGIN"]).writeInt(currentId).writeInt(triggerId).writeRt();
    };
    AbstractFluentTracer.prototype.logPromiseAllEnd = function (currentId, triggerId) {
        if(!this.beforeLog())
            return;
        this.flushIfNeeded().writeType(LogEntryType["PROMISE_ALL_END"]).writeInt(currentId).writeInt(triggerId).writeRt();
    };
    AbstractFluentTracer.prototype.logPromiseRaceBegin = function (currentId, triggerId) {
        if(!this.beforeLog())
            return;
        this.flushIfNeeded().writeType(LogEntryType["PROMISE_RACE_BEGIN"]).writeInt(currentId).writeInt(triggerId).writeRt();
    };
    AbstractFluentTracer.prototype.logPromiseRaceEnd = function (currentId, triggerId) {
        if(!this.beforeLog())
            return;
        this.flushIfNeeded().writeType(LogEntryType["PROMISE_RACE_END"]).writeInt(currentId).writeInt(triggerId).writeRt();
    };
    AbstractFluentTracer.prototype.end = function (cb) {
        throw new Error("should be overridden by subclass!");
    };

    return AbstractFluentTracer;
})(AbstractTracer);
var NODE_BUF_LENGTH = 0;// 65536; //@jie:TODO
var AsciiFSTracer = (function (_super) {
    __extends(AsciiFSTracer, _super);

    function AsciiFSTracer(traceLoc, logger) {
        _super.call(this);
        this.traceFile = traceLoc ? traceLoc:'ascii-trace.log';
        //to make TraceCollector and Logging use the same logger
        this.logger = logger;
        if(fs.existsSync(this.traceFile)){
            fs.renameSync(this.traceFile, 'ascii-trace-bak-'+new Date().toString()+'.log');
        }
        this.buffer = "";
        if(false && this.logger.level.levelStr == 'DEBUG'){ //@jie
            isDebugging = true;
        }
    }
    AsciiFSTracer.prototype.flushIfNeeded = function () {
        if (this.buffer.length > NODE_BUF_LENGTH) {
            this.flush();
        }
        return this;
    };
    AsciiFSTracer.prototype.writeByte = function (val) {
        this.buffer += val + ',';
        return this;
    };
    AsciiFSTracer.prototype.writeInt = function (val) {
        this.buffer += val + ',';
        return this;
    };
    AsciiFSTracer.prototype.strLength = function (val) {
        return val.length;
    };
    AsciiFSTracer.prototype.writeString = function (val) {
        this.buffer += val + ',';
        return this;
    };
    AsciiFSTracer.prototype.writeRt = function(){
        this.buffer += '\n';
        return this;
    }
    AsciiFSTracer.prototype.flush = function () {
        fs.appendFileSync(this.traceFile, this.buffer);
        this.buffer = "";
    };
    AsciiFSTracer.prototype.end = function (cb) {
        if (this.buffer !== "") {
            this.flush();
        }
        cb();
        this.logger.info("Done collecting trace.");
    };
    return AsciiFSTracer;
})(AbstractFluentTracer);

module.exports = AsciiFSTracer;