var ___TraceCollector___;
var logger = require('./logger.js').logger;
var createObjIdManager = require('./ObjIdManager');
var NativeModels = require('./NativeModels');
var AsciiFSTracer = require('./Logging');
var AsyncMonitor = require('./AsyncMonitor');
var util = require('./util');

//iterate over the util property to attach it to ___TraceCollector___
(function (___TraceCollector___) {
    Object.keys(util).forEach(function (key) {
        ___TraceCollector___[key] = util[key];
    });
}) (___TraceCollector___ || (___TraceCollector___ = {}));

___TraceCollector___.AsciiFSTracer = AsciiFSTracer;

___TraceCollector___.createObjIdManager = createObjIdManager;

___TraceCollector___.NativeModels = NativeModels;

___TraceCollector___.AsyncMonitor = AsyncMonitor;

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
            this.tracer = new ___TraceCollector___.AsciiFSTracer(J$.configUtil.getTraceFile(), logger);
        };
        TraceCollector.prototype.onReady = function (readyCB) {
            readyCB();
        };
        TraceCollector.prototype.declare = function (iid, name, val, isArgument, isLocalSync, isCatchParam, refId) {
            var id = this.idManager.findOrCreateUniqueId(val, iid, false, name);
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
                    //TODO: deal with different script
                }
            }

            id = this.idManager.findObjId(f);
            //this.tracer.logRead(iid, id, id, id);
            this.nativeModels.modelInvokeFun(iid, f, base, args, val, isConstructor, isMethod);

            //xiaoning:
			//console.log("f.name: "+f.name+'\n');
			//console.log("args:\n");
			//console.log(args);
			/*
			for(var i = 0; i < args.length; i++) {
				console.log("["+i+"] "+args+'\n');
            }*/
            var metaArgs = '';
            if (f.name != 'setTimeout') {
                Object.keys(args).forEach(function (key) {
                    if (typeof args[key] == 'function') {
                        metaArgs += '1';
                    } else {
                        metaArgs += '0';
                    }
                });
            }
			this.tracer.logInvokeFun(iid, f.name, metaArgs);
       };

        TraceCollector.prototype.putField = function (iid, base, offset, val, isComputed, isOpAssign, basename) {
            if (___TraceCollector___.isObject(base)) {
                var baseId = this.idManager.findObjId(base);
                if (baseId !== -1) {
                    var valId = ___TraceCollector___.isObject(val) ? this.idManager.findOrCreateUniqueId(val, iid, false, basename) : 0;
                    this.tracer.logPutfield(iid, baseId, String(offset), valId, isOpAssign, basename);
                }
                //this.nativeModels.modelPutField(iid, base, offset, val);
            }
        };
        TraceCollector.prototype.read = function (iid, name, val, isGlobal, isScriptLocal, refId){
            //TODO
            var id = this.idManager.findOrCreateUniqueId(val, iid, true, name);
            this.tracer.logRead(iid,refId, name,id);
        };

        TraceCollector.prototype.write = function (iid, name, val, oldValue, isGlobal, isScriptLocal, refId) {
            var id = this.idManager.findOrCreateUniqueId(val, iid, false, name);
            this.tracer.logWrite(iid, refId, name, id);
        };

        TraceCollector.prototype.functionEnter = function (iid, fun, dis /* this */, args) {
            let current = this.asyncMonitor.getCurrent();
            this.tracer.logFunctionEnter(iid, fun.name, current);
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
        TraceCollector.prototype.getField = function (iid, base, offset, val, isComputed, isOpAssign, isMethodCal, basename) {
            // base may not be an object, e.g., if it's a string
            if (___TraceCollector___.isObject(base)) {
                // TODO fix handling of prototype chain
                var id = this.idManager.findObjId(base);
                if (id !== -1) {
                    this.tracer.logGetfield(iid, id, offset, this.idManager.findObjId(val), basename);
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
            /**
             * Add return value in the log
             * log format: iid, returnValue
             */
            var id = this.idManager.findOrCreateUniqueId(returnVal, iid, false);
            if (___TraceCollector___.isUndefined(returnVal)) id = ___TraceCollector___.UNDEFINED_OBJ_ID;
            //console.log('Return value: ', id);
            this.tracer.logFunctionExit(iid, id);
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
                        this.tracer.logDelete(iid, baseId, String(offset));
                        //this.tracer.logPutfield(iid, baseId, String(offset), 0);
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
