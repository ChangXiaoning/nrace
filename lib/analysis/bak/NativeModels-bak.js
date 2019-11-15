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