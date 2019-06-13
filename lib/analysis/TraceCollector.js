var ___TraceCollector___;
var logger = require('./logger.js').logger;
if(false && logger.level.levelStr == 'DEBUG'){ //@jie
    var isDebugging = true;
}

var fs = require('fs');
(function (___TraceCollector___) {

    ___TraceCollector___.LogEntryType = require('./LogEntryType.js');
    ___TraceCollector___.ALREADY_FLUSHED = "ALREADY_FLUSHED";
    ___TraceCollector___.UNKNOWN_FLUSH_LOC = "0:-1";
    ___TraceCollector___.GLOBAL_OBJ = (function () {
        return this;
    })();
    function isObject(o) {
        return o && (typeof o === 'object' || typeof o === 'function');
    }
    ___TraceCollector___.isObject = isObject;
    // some defense against monkey-patching
    var objGetOwnPropDesc = Object.getOwnPropertyDescriptor;
    var objGetPrototypeOf = Object.getPrototypeOf;
    var objProtoHasOwnProperty = Object.prototype.hasOwnProperty;
    var objDefProperty = Object.defineProperty;
    function getPropertyDescriptor(o, prop) {
        var t = o;
        while (t != null) {
            var desc = objGetOwnPropDesc(t, prop);
            if (desc) {
                return desc;
            }
            t = objGetPrototypeOf(t);
        }
        return null;
    }
    ___TraceCollector___.getPropertyDescriptor = getPropertyDescriptor;
    function isGetterSetter(o, prop) {
        var desc = getPropertyDescriptor(o, prop);
        return desc && (desc.set !== undefined || desc.get !== undefined);
    }
    ___TraceCollector___.isGetterSetter = isGetterSetter;
    function HOP(o, prop) {
        return objProtoHasOwnProperty.call(o, prop);
    }
    ___TraceCollector___.HOP = HOP;
    function objDefineProperty(o, p, attributes) {
        return objDefProperty(o, p, attributes);
    }
    ___TraceCollector___.objDefineProperty = objDefineProperty;
    var funEnterRegExp = /J\$\.Fe\(([0-9]+)/;
    /**
     * cache for optimization
     * @type {WeakMap<K, V>}
     */
    var instFunction2EnterIID = typeof WeakMap === 'undefined' ? undefined : new WeakMap();
    var funEnterIIDHiddenProp = "*HP$*";
    ;
    function getFunEnterIID(f) {
        var parsed = funEnterRegExp.exec(f.toString());
        var result;
        if (parsed) {
            result = parseInt(parsed[1]);
            setCachedFunEnterIID(f, result);
        }
        else {
            result = -1;
        }
        return result;
    }
    ___TraceCollector___.getFunEnterIID = getFunEnterIID;
    function setCachedFunEnterIID(f, enterIID) {
        if (instFunction2EnterIID) {
            instFunction2EnterIID.set(f, enterIID);
        }
        else {
            // use a hidden property
            objDefineProperty(f, funEnterIIDHiddenProp, {
                enumerable: false,
                writable: true
            });
            f[funEnterIIDHiddenProp] = enterIID;
        }
    }
    function lookupCachedFunEnterIID(f) {
        if (instFunction2EnterIID) {
            return instFunction2EnterIID.get(f);
        }
        else {
            return f[funEnterIIDHiddenProp];
        }
    }
    ___TraceCollector___.lookupCachedFunEnterIID = lookupCachedFunEnterIID;
})(___TraceCollector___ || (___TraceCollector___ = {}));

var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};

(function (___TraceCollector___) {
    // how often should we flush last use information?
    // TODO set up a setInterval() script that also flushes last use, so we flush when the application is idle
    var LAST_USE_FLUSH_PERIOD = 10000;
    /**
     * these are some handy utilities for any implementation of Tracer to have.
     * this class doesn't implement the Tracer interface since we can't actually
     * make it an abstract class.
     */
    var LogEntryType = ___TraceCollector___.LogEntryType;
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
            this.flushIID = ___TraceCollector___.ALREADY_FLUSHED;
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
            if (this.flushIID !== ___TraceCollector___.ALREADY_FLUSHED) {
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
        AbstractFluentTracer.prototype.logCreateObj = function (iid, objId) {
            return;
            if (!this.beforeLog())
                return;
            this.flushIfNeeded().writeTypeAndIID(LogEntryType["CREATE_OBJ"], iid).writeInt(objId).writeRt();
        };
        AbstractFluentTracer.prototype.logCreateObjDiffScript = function (sid, iid, objId) {
            return;
            if (!this.beforeLog())
                return;
            // write an update script entry for the sid parameter, followed by the create obj entry,
            // followed by an update script entry back to the current script
            this.logUpdateCurrentScript(sid);
            this.flushIfNeeded().writeTypeAndIID(LogEntryType["CREATE_OBJ"], iid).writeInt(objId).writeRt();
            this.logUpdateCurrentScript(J$.sid);
        };
        AbstractFluentTracer.prototype.logCreateFun = function (iid, funEnterIID, objId) {
            if (!this.beforeLog())
                return;
            this.flushIfNeeded().writeTypeAndIID(LogEntryType["CREATE_FUN"], iid).writeInt(funEnterIID).writeInt(objId).writeRt();
        };
        AbstractFluentTracer.prototype.logPutfield = function (iid, baseObjId, propName, valObjId) {
            if (!this.beforeLog(iid))
                return;
            this.flushIfNeeded().writeTypeAndIID(LogEntryType["PUTFIELD"], iid).writeInt(baseObjId).writeString(propName).writeInt(valObjId).writeRt();
        };
        AbstractFluentTracer.prototype.logGetfield = function (iid, baseObjId, propName, valObjId) {
            if (!this.beforeLog(iid))
               return;
            this.flushIfNeeded().writeTypeAndIID(LogEntryType["GETFIELD"], iid).writeInt(baseObjId).writeString(propName).writeInt(valObjId).writeRt();
        }
        AbstractFluentTracer.prototype.logWrite = function (iid, refId, name, objId) {
            if (!this.beforeLog(iid))
                return;
            this.flushIfNeeded().writeTypeAndIID(LogEntryType["WRITE"], iid).writeInt(refId).writeString(name).writeInt(objId).writeRt().logCallStack(['W', iid, refId, name]);
        };
        AbstractFluentTracer.prototype.logRead = function (iid, refId, name, objId) {
            if (!this.beforeLog())
                return;
            this.flushIfNeeded().writeTypeAndIID(LogEntryType["READ"], iid).writeInt(refId).writeString(name).writeInt(objId).writeRt().logCallStack(['R', iid, refId, name]);
        };
		//xiaoning: add logInvokeFun
		AbstractFluentTracer.prototype.logInvokeFun = function (iid, fName, args) {
			//TODO: capture delay time from args <Array>
			if (!this.beforeLog())
				return;
			this.flushIfNeeded().writeTypeAndIID(LogEntryType["INVOKE_FUN"], iid).writeString(fName).writeRt();
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
            console.log('ref: ' + ref + '\nfunName: ' + funName + '\n');
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
        AbstractFluentTracer.prototype.logFunctionEnter = function (iid, funObjId, fName) {
            if (!this.beforeLog() || !LogEntryType.hasOwnProperty('FUNCTION_ENTER'))
                return;
            this.flushIfNeeded().writeTypeAndIID(LogEntryType["FUNCTION_ENTER"], iid).writeString(fName).writeRt();
        };
        AbstractFluentTracer.prototype.logCallStack = function(arr){
            return;
            var stack = new Error().stack; //@jie: TODO only is called in debug mode
            logger.debug('eid:'+this.getExecutionAsyncId()+', (R/W, iid, refId, name): (' + arr +')');
            return this;
        }
        AbstractFluentTracer.prototype.logFunctionExit = function (iid) {
            if (!this.beforeLog() || !LogEntryType.hasOwnProperty('FUNCTION_EXIT'))
                return;
            this.flushIfNeeded().writeTypeAndIID(LogEntryType["FUNCTION_EXIT"], iid).writeRt();
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
            logger.debug('logTopLevelFlush. slId:', slId);
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
        AbstractFluentTracer.prototype.logAsyncPromiseResolve = function(asyncId, eid){
            if (!this.beforeLog())
                return;
            this.flushIfNeeded().writeType(LogEntryType["ASYNC_PROMISERESOLVE"]).writeInt(asyncId).writeInt(eid);
        } 
        AbstractFluentTracer.prototype.end = function (cb) {
            throw new Error("should be overridden by subclass!");
        };

        return AbstractFluentTracer;
    })(AbstractTracer);
    var NODE_BUF_LENGTH = 0;// 65536; //@jie:TODO
    var AsciiFSTracer = (function (_super) {
        __extends(AsciiFSTracer, _super);

        function AsciiFSTracer(traceLoc) {
            _super.call(this);
            this.traceFile = traceLoc ? traceLoc:'ascii-trace.log';
            if(fs.existsSync(this.traceFile)){
                fs.renameSync(this.traceFile, 'ascii-trace-bak-'+new Date().toString()+'.log');
            }
            this.buffer = "";
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
            logger.info("Done collecting trace.");
        };
        return AsciiFSTracer;
    })(AbstractFluentTracer);
    ___TraceCollector___.AsciiFSTracer = AsciiFSTracer;
})(___TraceCollector___ || (___TraceCollector___ = {}));

(function (___TraceCollector___) {
    var WeakMapMetadataManager = (function () {
        function WeakMapMetadataManager() {
            /**
             * WeakMap to hold the source ID at which we first encountered a native object.
             *
             * This is used to associate a correct IID with the native object if we
             * decide to create metadata for it.
             * @type {WeakMap<K, V>}
             */
            this.nativeObj2IID = new WeakMap();
            /**
             * WeakMap to hold object metadata
             * metadata is 32 bits.  31 bits for object id, highest-order bit to mark unannotated 'this'
             * objects from constructors
             * @type {WeakMap<K, V>}
             */
            this.obj2Metadata = new WeakMap();
        }
        WeakMapMetadataManager.prototype.hasMetadata = function (obj) {
            return this.obj2Metadata.has(obj);
        };
        WeakMapMetadataManager.prototype.getMetadata = function (obj) {
            return this.obj2Metadata.get(obj);
        };
        WeakMapMetadataManager.prototype.setMetadata = function (obj, metadata) {
            this.obj2Metadata.set(obj, metadata);
        };
        WeakMapMetadataManager.prototype.setIIDForNativeObj = function (obj, iid) {
            this.nativeObj2IID.set(obj, iid);
        };
        WeakMapMetadataManager.prototype.hasIIDForNativeObj = function (obj) {
            return this.nativeObj2IID.has(obj);
        };
        WeakMapMetadataManager.prototype.getIIDForNativeObj = function (obj) {
            return this.nativeObj2IID.get(obj);
        };
        WeakMapMetadataManager.prototype.flushNativeObj2IIDInfo = function () {
            this.nativeObj2IID = new WeakMap();
        };
        return WeakMapMetadataManager;
    })();
    var HiddenPropMetadataManager = (function () {
        function HiddenPropMetadataManager() {
            if (typeof Object.defineProperty !== 'function') {
                throw new Error("we need Object.defineProperty");
            }
        }
        HiddenPropMetadataManager.prototype.hasMetadata = function (obj) {
            return ___TraceCollector___.HOP(obj, HiddenPropMetadataManager.METADATA_PROP);
        };
        HiddenPropMetadataManager.prototype.getMetadata = function (obj) {
            return obj[HiddenPropMetadataManager.METADATA_PROP];
        };
        HiddenPropMetadataManager.prototype.setMetadata = function (obj, metadata) {
            if (!this.hasMetadata(obj)) {
                try {
                    ___TraceCollector___.objDefineProperty(obj, HiddenPropMetadataManager.METADATA_PROP, {
                        enumerable: false,
                        writable: true
                    });
                }
                catch (e) {
                }
            }
            obj[HiddenPropMetadataManager.METADATA_PROP] = metadata;
        };
        HiddenPropMetadataManager.prototype.setIIDForNativeObj = function (obj, iid) {
            ___TraceCollector___.objDefineProperty(obj, HiddenPropMetadataManager.NATIVE_IID_PROP, {
                enumerable: false,
                writable: true
            });
            obj[HiddenPropMetadataManager.NATIVE_IID_PROP] = iid;
        };
        HiddenPropMetadataManager.prototype.hasIIDForNativeObj = function (obj) {
            return ___TraceCollector___.HOP(obj, HiddenPropMetadataManager.NATIVE_IID_PROP);
        };
        HiddenPropMetadataManager.prototype.getIIDForNativeObj = function (obj) {
            return obj[HiddenPropMetadataManager.NATIVE_IID_PROP];
        };
        HiddenPropMetadataManager.prototype.flushNativeObj2IIDInfo = function () {
            // do nothing
        };
        HiddenPropMetadataManager.METADATA_PROP = "*M$*";
        HiddenPropMetadataManager.NATIVE_IID_PROP = "*NI$*";
        return HiddenPropMetadataManager;
    })();
    var ObjIdManagerImpl = (function () {
        function ObjIdManagerImpl(tracer, metaManager) {
            /**
             * counter for object ids
             * @type {number}
             */
            this.idCounter = 1;
            this.tracer = tracer;
            this.metaManager = metaManager;
        }
        /**
         * get a unique id for the object, creating it if necessary.
         * If created, log a CREATE event
         * @param obj the object, precondition isObject(obj) === true
         * @returns {*}
         */
        ObjIdManagerImpl.prototype.findOrCreateUniqueId = function (obj, iid, isLiteral) {
            if(!___TraceCollector___.isObject(obj)){
                return 0;
            }
            var meta = this.metaManager;
            if (meta.hasMetadata(obj)) {
                return this.extractObjId(meta.getMetadata(obj));
            }
            else {
                return this.createObjId(obj, iid, isLiteral);
            }
        };
        ObjIdManagerImpl.prototype.extractObjId = function (metadata) {
            return metadata & 0x7FFFFFFF;
        };
        ObjIdManagerImpl.prototype.isUnannotatedThis = function (metadata) {
            return metadata < 0;
        };
        ObjIdManagerImpl.prototype.setUnannotatedThis = function (metadata) {
            // set sign bit
            return metadata | 0x80000000;
        };
        /**
         * gets unique id for object.  assumes that an ID has already been created.
         * @param obj
         * @returns {number}
         */
        ObjIdManagerImpl.prototype.findExtantObjId = function (obj) {
            return this.extractObjId(this.metaManager.getMetadata(obj));
        };
        ObjIdManagerImpl.prototype.findObjId = function (obj) {
            if (___TraceCollector___.isObject(obj)) {
                var val = this.metaManager.getMetadata(obj);
                if (val !== undefined) {
                    return this.extractObjId(val);
                }
            }
            return -1;
        };
        /**
         * is obj unannotated and in need of an id?  This is to handle
         * cases where we discover objects from native / uninstrumented code
         * @param obj
         */
        ObjIdManagerImpl.prototype.needsAnId = function (obj) {
            return ___TraceCollector___.isObject(obj) && !this.metaManager.hasMetadata(obj);
        };
        ObjIdManagerImpl.prototype.createObjId = function (obj, iid, isLiteral) {
            var _this = this;
            var meta = this.metaManager;
            var allocIID;
            var allocScriptId;
            var diffScriptId;
            if (meta.hasIIDForNativeObj(obj)) {
                var sourceId = meta.getIIDForNativeObj(obj);
                var colonInd = sourceId.indexOf(':');
                allocScriptId = parseInt(sourceId.substring(0, colonInd));
                allocIID = parseInt(sourceId.substring(colonInd + 1));
                diffScriptId = allocScriptId !== J$.sid;
            }
            else {
                allocScriptId = J$.sid;
                allocIID = iid;
                diffScriptId = false;
            }
            var helper = function (o) {
                var objId = _this.idCounter + 2;
                meta.setMetadata(o, objId);
                _this.idCounter = objId;
                return objId;
            };
            var objId = helper(obj);
            // only emit the CREATE_FUN entry for function literals
            if (isLiteral && typeof obj === 'function') {
                // create ID for prototype as well
                var proto = obj.prototype;
                // prototype can be undefined for getters / setters
                if (proto !== undefined) {
                    helper(proto);
                }
                var funEnterIID = ___TraceCollector___.getFunEnterIID(obj);
                this.tracer.logCreateFun(allocIID, funEnterIID, objId);
            }
            else {
                if (diffScriptId) {
                    this.tracer.logCreateObjDiffScript(allocScriptId, allocIID, objId);
                }
                else {
                    this.tracer.logCreateObj(allocIID, objId);
                }
            }
            return objId;
        };
        /**
         * do we have metadata for the object already?
         * @param obj
         * @returns {boolean}
         */
        ObjIdManagerImpl.prototype.hasMetadata = function (obj) {
            return this.metaManager.hasMetadata(obj);
        };
        ObjIdManagerImpl.prototype.getMetadata = function (obj) {
            return this.metaManager.getMetadata(obj);
        };
        ObjIdManagerImpl.prototype.setMetadata = function (obj, id) {
            return this.metaManager.setMetadata(obj, id);
        };
        ObjIdManagerImpl.prototype.flushNativeObj2IIDInfo = function () {
            this.metaManager.flushNativeObj2IIDInfo();
        };
        ObjIdManagerImpl.prototype.setSourceIdForNativeObj = function (obj, sourceId) {
            this.metaManager.setIIDForNativeObj(obj, sourceId);
        };
        return ObjIdManagerImpl;
    })();
    function createObjIdManager(tracer, useHiddenProp) {
        if (useHiddenProp === void 0) { useHiddenProp = false; }
        //console.log('useHiddenProp is: ', useHiddenProp);
        var result = typeof WeakMap === 'undefined' || useHiddenProp ? new ObjIdManagerImpl(tracer, new HiddenPropMetadataManager()) : new ObjIdManagerImpl(tracer, new WeakMapMetadataManager());
        // reserve object ID 1 for the global object
        //console.log('type of idManager: ', (result instanceof HiddenPropMetadataManager));
        result.createObjId(___TraceCollector___.GLOBAL_OBJ, -1, false);
        return result;
    }
    ___TraceCollector___.createObjIdManager = createObjIdManager;
})(___TraceCollector___ || (___TraceCollector___ = {}));
/*!
 * https://github.com/paulmillr/es6-shim
 * @license es6-shim Copyright 2013-2014 by Paul Miller (http://paulmillr.com)
 * and contributors, MIT License
 * es6-shim: v0.20.2
 * see https://github.com/paulmillr/es6-shim/blob/master/LICENSE
 * Details and documentation:
 * https://github.com/paulmillr/es6-shim/
 */
var ___TraceCollector___;
(function (___TraceCollector___) {
    var _toString = Object.prototype.toString;
    var _defineProperty = Object.defineProperty;
    var TypeIsObject = function (x) {
        /* jshint eqnull:true */
        // this is expensive when it returns false; use this function
        // when you expect it to return true in the common case.
        return x != null && Object(x) === x;
    };
    var IsCallable = function (x) {
        return typeof x === 'function' && _toString.call(x) === '[object Function]';
    };
    var isNaN = function (value) {
        // NaN !== NaN, but they are identical.
        // NaNs are the only non-reflexive value, i.e., if x !== x,
        // then x is NaN.
        // isNaN is broken: it converts its argument to number, so
        // isNaN('foo') => true
        return value !== value;
    };
    var SameValueZero = function (a, b) {
        // same as SameValue except for SameValueZero(+0, -0) == true
        return (a === b) || (isNaN(a) && isNaN(b));
    };
    var SameValue = function (a, b) {
        if (a === b) {
            // 0 === -0, but they are not identical.
            if (a === 0) {
                return 1 / a === 1 / b;
            }
            return true;
        }
        return isNaN(a) && isNaN(b);
    };
    var defineProperty = function (object, name, value, force) {
        if (!force && name in object) {
            return;
        }
        _defineProperty(object, name, {
            configurable: true,
            enumerable: false,
            writable: true,
            value: value
        });
    };
    // Define configurable, writable and non-enumerable props
    // if they don’t exist.
    var defineProperties = function (object, map) {
        Object.keys(map).forEach(function (name) {
            var method = map[name];
            defineProperty(object, name, method, false);
        });
    };
    var emulateES6construct = function (o) {
        if (!TypeIsObject(o)) {
            throw new TypeError('bad object');
        }
        // es5 approximation to es6 subclass semantics: in es6, 'new Foo'
        // would invoke Foo.@@create to allocation/initialize the new object.
        // In es5 we just get the plain object.  So if we detect an
        // uninitialized object, invoke o.constructor.@@create
        if (!o._es6construct) {
            if (o.constructor && IsCallable(o.constructor['@@create'])) {
                o = o.constructor['@@create'](o);
            }
            defineProperties(o, { _es6construct: true });
        }
        return o;
    };
    var emptyObject = function emptyObject() {
        // accomodate some older not-quite-ES5 browsers
        return Object.create ? Object.create(null) : {};
    };
    // Simple shim for Object.create on ES3 browsers
    // (unlike real shim, no attempt to support `prototype === null`)
    var create = Object.create || function (prototype, properties) {
        function Type() {
        }
        Type.prototype = prototype;
        var object = new Type();
        if (typeof properties !== 'undefined') {
            defineProperties(object, properties);
        }
        return object;
    };
    // Map and Set require a true ES5 environment
    // Their fast path also requires that the environment preserve
    // property insertion order, which is not guaranteed by the spec.
    var testOrder = function (a) {
        var b = Object.keys(a.reduce(function (o, k) {
            o[k] = true;
            return o;
        }, {}));
        return a.join(':') === b.join(':');
    };
    var preservesInsertionOrder = testOrder(['z', 'a', 'bb']);
    // some engines (eg, Chrome) only preserve insertion order for string keys
    var preservesNumericInsertionOrder = testOrder(['z', 1, 'a', '3', 2]);
    var fastkey = function fastkey(key) {
        if (!preservesInsertionOrder) {
            return null;
        }
        var type = typeof key;
        if (type === 'string') {
            return '$' + key;
        }
        else if (type === 'number') {
            // note that -0 will get coerced to "0" when used as a property key
            if (!preservesNumericInsertionOrder) {
                return 'n' + key;
            }
            return key;
        }
        return null;
    };
    var emptyObject = function emptyObject() {
        // accomodate some older not-quite-ES5 browsers
        return Object.create ? Object.create(null) : {};
    };
    var MyMap = (function () {
        var empty = {};
        function MapEntry(key, value) {
            this.key = key;
            this.value = value;
            this.next = null;
            this.prev = null;
        }
        MapEntry.prototype.isRemoved = function () {
            return this.key === empty;
        };
        function MapIterator(map, kind) {
            this.head = map._head;
            this.i = this.head;
            this.kind = kind;
        }
        MapIterator.prototype = {
            next: function () {
                var i = this.i, kind = this.kind, head = this.head, result;
                if (typeof this.i === 'undefined') {
                    return { value: void 0, done: true };
                }
                while (i.isRemoved() && i !== head) {
                    // back up off of removed entries
                    i = i.prev;
                }
                while (i.next !== head) {
                    i = i.next;
                    if (!i.isRemoved()) {
                        if (kind === 'key') {
                            result = i.key;
                        }
                        else if (kind === 'value') {
                            result = i.value;
                        }
                        else {
                            result = [i.key, i.value];
                        }
                        this.i = i;
                        return { value: result, done: false };
                    }
                }
                // once the iterator is done, it is done forever.
                this.i = void 0;
                return { value: void 0, done: true };
            }
        };
        //        addIterator(MapIterator.prototype);
        function Map() {
            var map = this;
            map = emulateES6construct(map);
            if (!map._es6map) {
                throw new TypeError('bad map');
            }
            var head = new MapEntry(null, null);
            // circular doubly-linked list.
            head.next = head.prev = head;
            defineProperties(map, {
                _head: head,
                _storage: emptyObject(),
                _size: 0
            });
            return map;
        }
        var Map$prototype = Map.prototype;
        defineProperties(Map, {
            '@@create': function (obj) {
                var constructor = this;
                var prototype = constructor.prototype || Map$prototype;
                obj = obj || create(prototype);
                defineProperties(obj, { _es6map: true });
                return obj;
            }
        });
        _defineProperty(Map.prototype, 'size', {
            configurable: true,
            enumerable: false,
            get: function () {
                if (typeof this._size === 'undefined') {
                    throw new TypeError('size method called on incompatible Map');
                }
                return this._size;
            }
        });
        defineProperties(Map.prototype, {
            get: function (key) {
                var fkey = fastkey(key);
                if (fkey !== null) {
                    // fast O(1) path
                    var entry = this._storage[fkey];
                    if (entry) {
                        return entry.value;
                    }
                    else {
                        return;
                    }
                }
                var head = this._head, i = head;
                while ((i = i.next) !== head) {
                    if (SameValueZero(i.key, key)) {
                        return i.value;
                    }
                }
                return;
            },
            has: function (key) {
                var fkey = fastkey(key);
                if (fkey !== null) {
                    // fast O(1) path
                    return typeof this._storage[fkey] !== 'undefined';
                }
                var head = this._head, i = head;
                while ((i = i.next) !== head) {
                    if (SameValueZero(i.key, key)) {
                        return true;
                    }
                }
                return false;
            },
            set: function (key, value) {
                var head = this._head, i = head, entry;
                var fkey = fastkey(key);
                if (fkey !== null) {
                    // fast O(1) path
                    if (typeof this._storage[fkey] !== 'undefined') {
                        this._storage[fkey].value = value;
                        return this;
                    }
                    else {
                        entry = this._storage[fkey] = new MapEntry(key, value);
                        i = head.prev;
                    }
                }
                while ((i = i.next) !== head) {
                    if (SameValueZero(i.key, key)) {
                        i.value = value;
                        return this;
                    }
                }
                entry = entry || new MapEntry(key, value);
                if (SameValue(-0, key)) {
                    entry.key = +0; // coerce -0 to +0 in entry
                }
                entry.next = this._head;
                entry.prev = this._head.prev;
                entry.prev.next = entry;
                entry.next.prev = entry;
                this._size += 1;
                return this;
            },
            'delete': function (key) {
                var head = this._head, i = head;
                var fkey = fastkey(key);
                if (fkey !== null) {
                    // fast O(1) path
                    if (typeof this._storage[fkey] === 'undefined') {
                        return false;
                    }
                    i = this._storage[fkey].prev;
                    delete this._storage[fkey];
                }
                while ((i = i.next) !== head) {
                    if (SameValueZero(i.key, key)) {
                        i.key = i.value = empty;
                        i.prev.next = i.next;
                        i.next.prev = i.prev;
                        this._size -= 1;
                        return true;
                    }
                }
                return false;
            },
            clear: function () {
                this._size = 0;
                this._storage = emptyObject();
                var head = this._head, i = head, p = i.next;
                while ((i = p) !== head) {
                    i.key = i.value = empty;
                    p = i.next;
                    i.next = i.prev = head;
                }
                head.next = head.prev = head;
            },
            keys: function () {
                return new MapIterator(this, 'key');
            },
            values: function () {
                return new MapIterator(this, 'value');
            },
            entries: function () {
                return new MapIterator(this, 'key+value');
            },
            forEach: function (callback) {
                var context = arguments.length > 1 ? arguments[1] : null;
                var it = this.entries();
                for (var entry = it.next(); !entry.done; entry = it.next()) {
                    callback.call(context, entry.value[1], entry.value[0], this);
                }
            }
        });
        return Map;
    })();
    function allocMap() {
        if (typeof Map !== 'undefined') {
            return new Map();
        }
        else {
            return new MyMap();
        }
    }
    ___TraceCollector___.allocMap = allocMap;
})(___TraceCollector___ || (___TraceCollector___ = {}));
/**
 * Created by m.sridharan on 11/6/14.
 */
var ___TraceCollector___;
(function (___TraceCollector___) {
   var NativeModels = (function () {
        function NativeModels(idManager, tracer) {
            var _this = this;
            this.idManager = idManager;
            this.tracer = tracer;
            /**
             * native functions that we model before they have been called, i.e., in invokeFunPre()
             */
            this.invokeFunPreNatives = ___TraceCollector___.allocMap();
            /**
             * native functions that we model after they have been called, i.e., in invokeFun()
             */
            this.invokeFunPostNatives = ___TraceCollector___.allocMap();
            this.callbackIdToGlobal = ___TraceCollector___.allocMap();
            this.callbackCounter = 0;
            this.nativeFunctionModels = {
                'Array.prototype.push': function (iid, f, base, args, val, isConstructor, name) {
                    var len = base.length;
                    var baseId = _this.idManager.findObjId(base);
                    if (typeof len === 'number' && baseId !== -1) {
                        var ind = len - 1;
                        for (var argInd = args.length - 1; argInd >= 0; argInd--) {
                            var argId = _this.idManager.findObjId(args[argInd]);
                            if (argId !== -1) {
                                _this.tracer.logPutfield(iid, baseId, String(ind), argId);
                            }
                            ind--;
                        }
                    }
                },
                'Array.prototype.pop': function (iid, f, base, args, val, isConstructor, name) {
                    var len = base.length;
                    var baseId = _this.idManager.findObjId(base);
                    if (typeof len === 'number' && baseId !== -1) {
                        // NOTE this will emit a putfield at '0' even if the
                        // array was empty before; shouldn't be a big deal
                        _this.tracer.logPutfield(iid, baseId, String(len), 0);
                    }
                },
                'Array.prototype.unshift': function (iid, f, base, args, val, isConstructor, name) {
                    // we need to do a full pass to update all indices
                    var len = base.length;
                    var baseId = _this.idManager.findObjId(base);
                    if (typeof len === 'number' && baseId !== -1) {
                        for (var i = 0; i < len; i++) {
                            // TODO base[i] could be a getter...sigh.  ignore for now
                            var elemId = _this.idManager.findObjId(base[i]);
                            if (elemId === -1) {
                                // to be safe, still log a putfield with null id
                                elemId = 0;
                            }
                            _this.tracer.logPutfield(iid, baseId, String(i), elemId);
                        }
                    }
                },
                'Array.prototype.shift': function (iid, f, base, args, val, isConstructor, name) {
                    // we need to do a full pass to update all indices
                    var len = base.length;
                    var baseId = _this.idManager.findObjId(base);
                    if (typeof len === 'number' && baseId !== -1) {
                        for (var i = 0; i < len; i++) {
                            // TODO base[i] could be a getter...sigh.  ignore for now
                            var elemId = _this.idManager.findObjId(base[i]);
                            if (elemId === -1) {
                                // to be safe, still log a putfield with null id
                                elemId = 0;
                            }
                            _this.tracer.logPutfield(iid, baseId, String(i), elemId);
                        }
                        // also, putfield of null at length to reflect shifted value
                        // NOTE this will emit a putfield at '0' even if the
                        // array was empty before; shouldn't be a big deal
                        _this.tracer.logPutfield(iid, baseId, String(len), 0);
                    }
                },
                'Array.prototype.concat': function (iid, f, base, args, val, isConstructor, name) {
                    // full pass on result
                    if (val) {
                        // need to wrap eagerly
                        var valId = _this.idManager.findOrCreateUniqueId(val, iid, false);
                        var len = val.length;
                        if (typeof len === 'number') {
                            for (var i = 0; i < len; i++) {
                                var elemId = _this.idManager.findObjId(val[i]);
                                if (elemId !== -1) {
                                    _this.tracer.logPutfield(iid, valId, String(i), elemId);
                                }
                            }
                        }
                    }
                },
                'Array.prototype.splice': function (iid, f, base, args, val, isConstructor, name) {
                    // full pass on array
                    var len = base.length;
                    var baseId = _this.idManager.findObjId(base);
                    if (typeof len === 'number' && baseId !== -1) {
                        for (var i = 0; i < len; i++) {
                            // TODO base[i] could be a getter...sigh.  ignore for now
                            var elemId = _this.idManager.findObjId(base[i]);
                            if (elemId === -1) {
                                // to be safe, still log a putfield with null id
                                elemId = 0;
                            }
                            _this.tracer.logPutfield(iid, baseId, String(i), elemId);
                        }
                        // if old length was bigger than current length, need to emit putfields
                        // of null to extra elements
                        var oldLen = _this.spliceOldLen;
                        if (typeof oldLen === 'number' && oldLen > len) {
                            for (i = len; i < oldLen; i++) {
                                _this.tracer.logPutfield(iid, baseId, String(i), 0);
                            }
                        }
                        _this.spliceOldLen = undefined;
                    }
                    // full pass on result
                    if (val) {
                        var len = val.length;
                        if (len > 0) {
                            // need to wrap eagerly
                            var valId = _this.idManager.findOrCreateUniqueId(val, iid, false);
                            for (var i = 0; i < len; i++) {
                                var elemId = _this.idManager.findObjId(val[i]);
                                if (elemId !== -1) {
                                    _this.tracer.logPutfield(iid, valId, String(i), elemId);
                                }
                            }
                        }
                    }
                },
                'setTimeout': function (iid, f, base, args, val, isConstructor, name) {
                    var wrapperFun = args[0];
                    var globalName = wrapperFun.globalName;
                    var timeoutId = val;
                    _this.callbackIdToGlobal.set(timeoutId, globalName);
                    wrapperFun.timeoutId = timeoutId;
                },
                'clearTimeout': function (iid, f, base, args, val, isConstructor, name) {
                    var timeoutId = args[0];
                    var global = _this.callbackIdToGlobal.get(timeoutId);
                    if (global) {
                        _this.tracer.logWrite(iid, global, 0);
                        _this.tracer.setFlushIID(J$.sid, iid);
                        _this.callbackIdToGlobal.delete(timeoutId);
                    }
                },
                'setInterval': function (iid, f, base, args, val, isConstructor, name) {
                    var intervalFun = args[0];
                    var globalName = "~timer~global~" + (++_this.callbackCounter);
                    var timeoutId = val;
                    _this.callbackIdToGlobal.set(timeoutId, globalName);
                    _this.tracer.logWrite(iid, globalName, _this.idManager.findOrCreateUniqueId(intervalFun, iid, false));
                },
                'Object.defineProperty': function (iid, f, base, args, val, isConstructor, name) {
                    var targetObj = args[0];
                    var property = String(args[1]);
                    var descriptor = args[2];
                    if (targetObj && ___TraceCollector___.isObject(targetObj) && property && descriptor) {
                        var targetId = _this.idManager.findOrCreateUniqueId(targetObj, iid, false);
                        if (___TraceCollector___.HOP(descriptor, 'value')) {
                            var val = descriptor.value;
                            if (___TraceCollector___.isObject(val)) {
                                var valId = _this.idManager.findOrCreateUniqueId(val, iid, false);
                                _this.tracer.logPutfield(iid, targetId, property, valId);
                            }
                            else {
                                // still log a write in case it's an overwrite
                                _this.tracer.logPutfield(iid, targetId, property, 0);
                            }
                        }
                        if (___TraceCollector___.HOP(descriptor, 'get')) {
                            var getter = descriptor.get;
                            var getterId = _this.idManager.findOrCreateUniqueId(getter, iid, false);
                            _this.tracer.logPutfield(iid, targetId, "~get~" + property, getterId);
                        }
                        if (___TraceCollector___.HOP(descriptor, 'set')) {
                            var setter = descriptor.set;
                            var setterId = _this.idManager.findOrCreateUniqueId(setter, iid, false);
                            _this.tracer.logPutfield(iid, targetId, "~set~" + property, setterId);
                        }
                    }
                },
                'EventEmitter.prototype.setMaxListeners': function(iid, f, base, args, val, isConstructor, name){
                    var baseId = _this.idManager.findObjId(base);
                    _this.tracer.logPutfield(iid, baseId, 'maxListeners');
                },
                'EventEmitter.prototype.getMaxListeners': function(iid, f, base, args, val, isConstructor, name){
                    var baseId = _this.idManager.findObjId(base);
                    _this.tracer.logGetfield(iid, baseId, 'maxListeners');
                
                },
                'EventEmitter.prototype.emit': function(iid, f, base, args, val, isConstructor, name){
                    var baseId = _this.idManager.findObjId(base);
                    _this.tracer.logGetfield(iid, baseId, args?args[0]:undefined);
                
                },
                'EventEmitter.prototype.addListener': function(iid, f, base, args, val, isConstructor, name){
                    var baseId = _this.idManager.findObjId(base);
                    _this.tracer.logPutfield(iid, baseId, args?args[0]:undefined);
                
                },
                'EventEmitter.prototype.on': function(iid, f, base, args, val, isConstructor, name){
                    var baseId = _this.idManager.findObjId(base);
                    _this.tracer.logPutfield(iid, baseId, args?args[0]:undefined);
                },
                'EventEmitter.prototype.prependListener': function(iid, f, base, args, val, isConstructor, name){
                    var baseId = _this.idManager.findObjId(base);
                    _this.tracer.logPutfield(iid, baseId, args?args[0]:undefined);
                },
                'EventEmitter.prototype.once': function(iid, f, base, args, val, isConstructor, name){
                    var baseId = _this.idManager.findObjId(base);
                    _this.tracer.logPutfield(iid, baseId, args?args[0]:undefined);
                },
                'EventEmitter.prototype.prependOnceListener': function(iid, f, base, args, val, isConstructor, name){
                    var baseId = _this.idManager.findObjId(base);
                    _this.tracer.logPutfield(iid, baseId, args?args[0]:undefined);
                },
                'EventEmitter.prototype.removeListener': function(iid, f, base, args, val, isConstructor, name){
                    var baseId = _this.idManager.findObjId(base);
                    _this.tracer.logPutfield(iid, baseId, args?args[0]:undefined);
                
                },
                'EventEmitter.prototype.removeAllListeners': function(iid, f, base, args, val, isConstructor, name){
                    var baseId = _this.idManager.findObjId(base);
                    if(args){
                        if(args[0])
                            _this.tracer.logPutfield(iid, baseId, args[0]);
                        else{
                            var names = EventEmitter.prototype.eventNames.apply(base);
                            for(var n in names){
                                _this.tracer.logPutfield(iid, baseId, n);
                            }
                        }
                    }
                
                },
                'EventEmitter.prototype.eventNames':function(iid, f, base, args, val, isConstructor, name){
                    var baseId = _this.idManager.findObjId(base);
                    if(val){
                        for(var n in val){
                            _this.tracer.logGetfield(iid, baseId, n);
                        }
                    }
                },
                'EventEmitter.prototype.listeners':function(iid, f, base, args, val, isConstructor, name){
                    var baseId = _this.idManager.findObjId(base);
                    _this.tracer.logGetfield(iid,baseId, args?args[0]: undefined);
                }
            };
            this.initInterestingNatives();
        }
        NativeModels.prototype.getNumDOMNodesModeled = function () {
            return this.mutObs.getNumNodesModeled();
        };

        NativeModels.prototype.initInterestingNatives = function () {
            var preMap = this.invokeFunPreNatives;
            preMap.set(Array.prototype.splice, "Array.prototype.splice");
            preMap.set(setTimeout, "setTimeout");
            var postMap = this.invokeFunPostNatives;
            postMap.set(Array.prototype.pop, "Array.prototype.pop");
            postMap.set(Array.prototype.push, "Array.prototype.push");
            postMap.set(Array.prototype.shift, "Array.prototype.shift");
            postMap.set(Array.prototype.unshift, "Array.prototype.unshift");
            postMap.set(Array.prototype.concat, "Array.prototype.concat");
            postMap.set(Array.prototype.splice, "Array.prototype.splice");
            postMap.set(setTimeout, "setTimeout");
            postMap.set(clearTimeout, "clearTimeout");
            postMap.set(setInterval, "setInterval");
            postMap.set(clearInterval, "clearInterval");
            postMap.set(Object.defineProperty, "Object.defineProperty");
            var EventEmitter = require('events');
            postMap.set(EventEmitter.prototype.setMaxListeners, "EventEmitter.prototype.setMaxListeners");
            postMap.set(EventEmitter.prototype.getMaxListeners, "EventEmitter.prototype.getMaxListeners");
            postMap.set(EventEmitter.prototype.emit, "EventEmitter.prototype.emit");
            postMap.set(EventEmitter.prototype.addListener, "EventEmitter.prototype.addListener");
            postMap.set(EventEmitter.prototype.on, "EventEmitter.prototype.on");
            postMap.set(EventEmitter.prototype.prependListener, "EventEmitter.prototype.prependListener");
            postMap.set(EventEmitter.prototype.once, "EventEmitter.prototype.once");
            postMap.set(EventEmitter.prototype.prependOnceListener, "EventEmitter.prototype.prependOnceListener");
            postMap.set(EventEmitter.prototype.removeListener, "EventEmitter.prototype.removeListener");
            postMap.set(EventEmitter.prototype.removeAllListeners, "EventEmitter.prototype.removeAllListeners");
            postMap.set(EventEmitter.prototype.eventNames, "EventEmitter.prototype.eventNames");
            postMap.set(EventEmitter.prototype.listeners, "EventEmitter.prototype.listeners");
            //postMap.set();
       };
        NativeModels.prototype.modelInvokeFunPre = function (iid, f, base, args, isConstructor, isMethod) {
            if (this.invokeFunPreNatives.has(f)) {
                if (f === Array.prototype.splice) {
                    // to model splice, we need to stash away the old length of the array
                    this.spliceOldLen = base.length;
                }
                else if (f === setTimeout) {
                    var fun = args[0];
                    if (typeof fun === 'function') {
                        var funIID = ___TraceCollector___.getFunEnterIID(fun);
                        // keep 'this' pointer ourselves since we need to refer to the real 'this'
                        // inside the function
                        var self = this;
                        var freshGlobal = "~timer~global~" + (++this.callbackCounter);
                        var wrapper = function () {
                            try {
                                fun.apply(this, arguments);
                            }
                            finally {
                                // reset script ID temporarily for our modeling code
                                var funScriptId = fun[J$.Constants.SPECIAL_PROP_SID];
                                var backupScriptId = J$.sid;
                                J$.sid = funScriptId;
                                self.tracer.logWrite(funIID, freshGlobal, 0);
                                self.tracer.setFlushIID(funScriptId, funIID);
                                self.callbackIdToGlobal.delete(wrapper.timeoutId);
                                J$.sid = backupScriptId;
                            }
                        };
                        wrapper.globalName = freshGlobal;
                        this.tracer.logWrite(iid, freshGlobal, this.idManager.findOrCreateUniqueId(fun, iid, false));
                        args[0] = wrapper;
                    }
                }
                return true;
            }
            return false;
        };
        NativeModels.prototype.modelInvokeFun = function (iid, f, base, args, val, isConstructor, isMethod) {
            if (this.invokeFunPostNatives.has(f)) {
                this.modelNativeFunction(iid, f, base, args, val, isConstructor, this.invokeFunPostNatives.get(f));
                return true;
            }
            return false;
        };
        NativeModels.prototype.modelNativeFunction = function (iid, f, base, args, val, isConstructor, name) {
            var fun = this.nativeFunctionModels[name];
            if (fun) {
                fun(iid, f, base, args, val, isConstructor, name);
            }
        };
        return NativeModels;
    })();
    ___TraceCollector___.NativeModels = NativeModels;
})(___TraceCollector___ || (___TraceCollector___ = {}));
(function(){
    const async_hooks = require('async_hooks');
    const util = require('util');
    
    //TODO remove
    function debug(...args) {
        //use a function like this one when debugging inside an AsyncHooks callback
        fs.writeSync(1, `${util.format(...args)}\n`);
    }

    function AsyncMonitor(idManager, tracer){
        this.idManager = idManager;
        this.tracer = tracer;
        this.init();
    }
    AsyncMonitor.prototype.init = function(){
        var self = this;
        self.tracer.setExecutionAsyncId(1);

        async_hooks.createHook({
            init(asyncId, type, triggerAsyncId) {
                //debug(type,'('+asyncId+')','trigger:'+triggerAsyncId);
                self.tracer.logAsyncInit(asyncId,type, triggerAsyncId);
                //xiaoning
                //console.debug(asyncId, type, triggerAsyncId);
                //fs.writeSync(1, '*******register:'+String(asyncId)+','+type+','+String(triggerAsyncId)+'\n');
            },
            before(asyncId) {
                //debug('before:'+asyncId);
                self.tracer.logAsyncBefore(asyncId);
                self.tracer.setExecutionAsyncId(async_hooks.executionAsyncId());
            },
            after(asyncId) {
                //debug('after:'+asyncId);
                self.tracer.logAsyncAfter(asyncId);
            },
            destroy(asyncId) {
                //debug('destroy:'+asyncId);
                self.tracer.logAsyncDestroy(asyncId);
            },
            promiseResolve(asyncId){
                self.tracer.logAsyncPromiseResolve(asyncId, async_hooks.executionAsyncId());
            }
        }).enable();
    }
    ___TraceCollector___.AsyncMonitor = AsyncMonitor;
})(___TraceCollector___ || (___TraceCollector___ = {}));
var ___TraceCollector___;
(function (___TraceCollector___) {
    require('./jalangi2/src/js/instrument/astUtil');
    require('./configUtil');
    var TraceCollector = (function () {
        /***********************************/
        /* CONSTRUCTOR AND JALANGI METHODS */
        /***********************************/
        function TraceCollector() {
            /**
             * used to track whether we have emitted a call log entry from the caller.
             * If so, then functionEnter in the callee need not emit the log entry
             * @type {boolean}
             */
            this.emittedCall = false;
            /**
             * used to track whether a call is known to be a constructor call.  set at
             * invokeFunPre, unset in functionEnter
             * @type {boolean}
             */
            this.isConstructor = false;
            
            /**
             * if true, log all putfields, even if value before
             * and after is a primitive
             * @type {boolean}
             */
            this.logAllPutfields = false;
            /**
             * for each call frame, either the metadata for the unannotated this parameter,
             * or 0 if this was annotated
             * @type {Array}
             */
            this.unannotThisMetadata = [];
            /**
             * public flag indicating when logging is complete
             * @type {boolean}
             */
            this.doneLogging = false;
        }
        /***************************************/
        /* ANALYSIS STATE AND INTERNAL METHODS */
        /***************************************/
        TraceCollector.prototype.initJalangiConfig = function () {
            var conf = J$.Config;
            var instHandler = J$.configUtil.instHandler;
            conf.INSTR_READ = instHandler.instrRead;
            conf.INSTR_WRITE = instHandler.instrWrite;
            conf.INSTR_GETFIELD = instHandler.instrGetfield;
            conf.INSTR_PUTFIELD = instHandler.instrPutfield;
            conf.INSTR_BINARY = instHandler.instrBinary;
            conf.INSTR_PROPERTY_BINARY_ASSIGNMENT = instHandler.instrPropBinaryAssignment;
            conf.INSTR_UNARY = instHandler.instrUnary;
            conf.INSTR_LITERAL = instHandler.instrLiteral;
            conf.INSTR_CONDITIONAL = instHandler.instrConditional;
        };
        TraceCollector.prototype.init = function (initParam) {
            var _this = this;
            this.initTracer(initParam);
            var idManager = ___TraceCollector___.createObjIdManager(this.tracer, initParam["useHiddenProp"] !== undefined);
            //console.log('*******initParam is: ', initParam);
            this.idManager = idManager;
            this.nativeModels = new ___TraceCollector___.NativeModels(idManager, this.tracer);
            this.asyncMonitor = new ___TraceCollector___.AsyncMonitor(idManager, this.tracer);
            this.logAllPutfields = initParam["allPutfields"] !== undefined;
            this.initJalangiConfig();
            var debugFun = initParam["debugFun"];
            if (debugFun) {
                var origInvokeFunPre = this.invokeFunPre;
                this.invokeFunPre = function (iid, f, base, args, isConstructor, isMethod) {
                    if (f && f.name === debugFun) {
                        var obj = args[0];
                        if (!idManager.hasMetadata(obj)) {
                            throw new Error("missing metadata for argument to debug function");
                        }
                        var objId = idManager.findExtantObjId(obj);
                        _this.tracer.logDebug(iid, objId);
                    }
                    origInvokeFunPre.call(_this, iid, f, base, args, isConstructor, isMethod);
                    return null;
                };
            }
            var that = this;
            process.on('exit', function(){
                logger.info('process exited');
                that.tracer.end(function () {
                    _this.doneLogging = true;
                });
     
            })
        };
        TraceCollector.prototype.initTracer = function (initParam) {
            this.tracer = new ___TraceCollector___.AsciiFSTracer(J$.configUtil.getTraceFile());
        };
        TraceCollector.prototype.onReady = function (readyCB) {
            readyCB();
        };
        TraceCollector.prototype.declare = function (iid, name, val, isArgument, isLocalSync, isCatchParam, refId) {
            var id = this.idManager.findOrCreateUniqueId(val, iid, false);
            this.tracer.logDeclare(iid, refId, name, id);
        };
       
        TraceCollector.prototype.invokeFunPre = function (iid, f, base, args, isConstructor, isMethod) {
            //TODO: if function is asyncCalls, replace it with wrapped callbacks.
            return;
            
            if (!this.nativeModels.modelInvokeFunPre(iid, f, base, args, isConstructor, isMethod)) {
                if (f) {
                    var funEnterIID = ___TraceCollector___.lookupCachedFunEnterIID(f);
                    if (funEnterIID !== undefined) {
                        var funObjId = this.idManager.findObjId(f);
                        var funSID = f[J$.Constants.SPECIAL_PROP_SID];
                        this.tracer.logCall(iid, funObjId, funEnterIID, funSID);
                        this.emittedCall = true;
                        this.isConstructor = isConstructor;
                    }
                }
            }

        };
        /**
         * if evalIID === -1, indirect eval
         * @param evalIID
         * @param iidMetadata
         */
        TraceCollector.prototype.instrumentCode = function (evalIID, newAST) {
            var _this = this;
            logger.info("instrumenting eval, iid: " + evalIID);
            var na = J$.configUtil;
            // TODO log source mapping???
            var curVarNames = null;
            var freeVarsHandler = function (node, context) {
                var fv = na.freeVars(node);
                curVarNames = fv === na.ANY ? "ANY" : Object.keys(fv);
            };
            var visitorPost = {
                'CallExpression': function (node) {
                    if (node.callee.object && node.callee.object.name === 'J$' && (node.callee.property.name === 'Fe')) {
                        var iid = node.arguments[0].value;
                        _this.tracer.logFreeVars(iid, curVarNames);
                    }
                    return node;
                }
            };
            var visitorPre = {
                'FunctionExpression': freeVarsHandler,
                'FunctionDeclaration': freeVarsHandler
            };
            J$.astUtil.transformAst(newAST, visitorPost, visitorPre);
            return;
        };
        TraceCollector.prototype.invokeFun = function (iid, f, base, args, val, isConstructor, isMethod) {
	        var idManager = this.idManager;
            if (___TraceCollector___.isObject(val)) {
                if (idManager.hasMetadata(val)) {
                    var metadata = idManager.getMetadata(val);
                    if (idManager.isUnannotatedThis(metadata)) {
                        var objId = idManager.extractObjId(metadata);
                        if (isConstructor) {
                            // update the IID
                            this.tracer.logUpdateIID(objId, iid);
                            // log a putfield to expose pointer to the prototype object
                            var funProto = f.prototype;
                            if (___TraceCollector___.isObject(funProto)) {
                                var funProtoId = idManager.findOrCreateUniqueId(funProto, iid, false);
                                this.tracer.logPutfield(iid, objId, "__proto__", funProtoId);
                            }
                        }
                        // unset the bit
                        idManager.setMetadata(val, objId);
                    }
                }
                else {
                    // native object.  stash away the iid of the call
                    // in case we decide to create an id for the object later
                    //idManager.setSourceIdForNativeObj(val,this.lastUse.getSourceId(iid));
                }
            }

            id = this.idManager.findObjId(f);
            this.tracer.logRead(iid, id, id, id);
            this.nativeModels.modelInvokeFun(iid, f, base, args, val, isConstructor, isMethod);

            //xiaoning:
			//console.log("f.name: "+f.name+'\n');
			//console.log("args:\n");
			//console.log(args);
			/*
			for(var i = 0; i < args.length; i++) {
				console.log("["+i+"] "+args+'\n');
			}*/
			this.tracer.logInvokeFun(iid, f.name, args);
       };

        TraceCollector.prototype.putField = function (iid, base, offset, val) {
            if (___TraceCollector___.isObject(base)) {
                var baseId = this.idManager.findObjId(base);
                if (baseId !== -1) {
                    var valId = ___TraceCollector___.isObject(val) ? this.idManager.findOrCreateUniqueId(val, iid, false) : 0;
                    this.tracer.logPutfield(iid, baseId, String(offset), valId);
                }
                //this.nativeModels.modelPutField(iid, base, offset, val);
            }
        };
        TraceCollector.prototype.read = function (iid, name, val, isGlobal, isScriptLocal, refId){
            //TODO
            var id = this.idManager.findOrCreateUniqueId(val, iid, false);
            this.tracer.logRead(iid,refId, name,id);
        };

        TraceCollector.prototype.write = function (iid, name, val, oldValue, isGlobal, isScriptLocal, refId) {
            var id = this.idManager.findOrCreateUniqueId(val, iid, false);
            this.tracer.logWrite(iid, refId, name, id);
        };

        TraceCollector.prototype.functionEnter = function (iid, fun, dis /* this */, args) {
            this.tracer.logFunctionEnter(iid, fun);
            if (this.emittedCall) {
                // we emitted a call entry, so we don't need a functionEnter also
                this.emittedCall = false;
            }
            else {
                var funId = this.idManager.findOrCreateUniqueId(fun, iid, false);
                // in this case, we won't see the invokeFun callback at the
                // caller to update the last use of fun.  so, update it here
                //this.updateLastUse(funId, iid);
            }
            // check for unannotated this and flag as such
            if (dis !== ___TraceCollector___.GLOBAL_OBJ) {
                var idManager = this.idManager;
                var metadata = 0;
                if (!idManager.hasMetadata(dis)) {
                    metadata = idManager.findOrCreateUniqueId(dis, iid, false);
                    if (this.isConstructor) {
                        // TODO could optimize to only add value to obj2Metadata once
                        metadata = idManager.setUnannotatedThis(metadata);
                        idManager.setMetadata(dis, metadata);
                        this.unannotThisMetadata.push(metadata);
                    }
                    else {
                        // we haven't seen the this object, but we are not
                        // sure this is a constructor call.  so, just create
                        // an id, but push 0 on the unnannotThisMetadata stack
                        this.unannotThisMetadata.push(0);
                    }
                }
                else {
                    metadata = idManager.getMetadata(dis);
                    this.unannotThisMetadata.push(0);
                }
                var refId = this.idManager.extractObjId(metadata);
                this.tracer.logDeclare(iid, refId, "this", refId);
            }
            else {
                // global object; don't bother logging the assignment to this
                this.unannotThisMetadata.push(0);
            }
            // always unset the isConstructor flag
            this.isConstructor = false;
        };
        TraceCollector.prototype.getField = function (iid, base, offset, val) {
            // base may not be an object, e.g., if it's a string
            if (___TraceCollector___.isObject(base)) {
                // TODO fix handling of prototype chain
                var id = this.idManager.findObjId(base);
                if (id !== -1) {
                    this.tracer.logGetfield(iid, id, offset, this.idManager.findObjId(val));
                }
            }
        };
        TraceCollector.prototype.functionExit = function (iid, returnVal, exceptionVal) {
            var loggedReturn = false;
            if (___TraceCollector___.isObject(returnVal)) {
                var idManager = this.idManager;
                if (idManager.hasMetadata(returnVal)) {
                    this.tracer.logReturn(idManager.findExtantObjId(returnVal));
                    loggedReturn = true;
                }
            }
            // NOTE: analysis should treat function exit as a top-level flush as well
            var unannotatedThis = this.unannotThisMetadata.pop();
            if (unannotatedThis !== 0 && !loggedReturn) {
                // we had an unannotated this and no explicit return.
                // we are very likely exiting from a constructor call.
                // so, add a RETURN log entry for this, so that it doesn't
                // become unreachable.
                // this could be the wrong thing to do, e.g., if this function
                // is actually being invoked from uninstrumented code.
                // don't worry about that corner case for now.
                this.tracer.logReturn(this.idManager.extractObjId(unannotatedThis));
            }
            this.tracer.logFunctionExit(iid);
            return;
        };
        TraceCollector.prototype.binary = function (iid, op, left, right, result_c) {
            if (op === 'delete') {
                // left is object, right is property
                var base = left;
                var offset = right;
                if (___TraceCollector___.isObject(base)) {
                    var baseId = this.idManager.findObjId(base);
                    if (baseId !== -1 && offset !== null && offset !== undefined) {
                        this.tracer.logPutfield(iid, baseId, String(offset), 0);
                        //this.updateLastUse(baseId, iid);
                    }
                }
            }
        };
        TraceCollector.prototype.scriptEnter = function (iid, fileName) {
            var _this = this;
            var iidInfo = J$.iids;
            var origFileName = iidInfo.originalCodeFileName;
            this.tracer.logScriptEnter(iid, J$.sid, origFileName);
            // NOTE we should have already logged the file name due to a previous callback
            Object.keys(iidInfo).forEach(function (key) {
                // check if it's a numeric property
                var iid = parseInt(key);
                if (!isNaN(iid)) {
                    var mapping = iidInfo[iid];
                    _this.tracer.logSourceMapping(iid, mapping[0], mapping[1], mapping[2], mapping[3]);
                }
            });
            var freeVars = J$.ast_info;
            /*
            Object.keys(freeVars).forEach(function (key) {
                _this.tracer.logFreeVars(parseInt(key), freeVars[key]);
            });
            */
        };
        TraceCollector.prototype.scriptExit = function (iid) {
            this.tracer.logScriptExit(iid);
            return;
        };
        TraceCollector.prototype.endExpression = function (iid) {
            if (this.tracer.getFlushIID() === ___TraceCollector___.ALREADY_FLUSHED) {
                this.tracer.setFlushIID(J$.sid, iid);
                // at this point, we can empty the map from native objects to iids,
                // since after a flush we won't be storing them anywhere
                this.idManager.flushNativeObj2IIDInfo();
            }
        };
        return TraceCollector;
    })();
    J$.analysis = new TraceCollector();
    J$.analysis.init(J$.initParams || {});
})(___TraceCollector___ || (___TraceCollector___ = {}));
//# sourceMappingURL=TraceCollector.js.map
