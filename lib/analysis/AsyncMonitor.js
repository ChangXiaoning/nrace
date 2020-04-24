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
        init(asyncId, type, triggerAsyncId, resource) {
            //debug(type,'('+asyncId+')','trigger:'+triggerAsyncId);
            //self.tracer.logAsyncInit(asyncId,type, triggerAsyncId);
            //xiaoning
            if (type === 'Timeout') {
                self.tracer.logTimerInit(asyncId, type, triggerAsyncId, resource._idleTimeout);
            } else {
                self.tracer.logAsyncInit(asyncId, type, triggerAsyncId);
            }
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
            //xiaoning: add a entryItem trigger
            self.tracer.logAsyncPromiseResolve(asyncId, async_hooks.executionAsyncId(), async_hooks.triggerAsyncId());
        }
    }).enable();

    //-------------------------------------------------------------------------------------------------------------------------
    //MONKEY PATCHING
    //-------------------------------------------------------------------------------------------------------------------------
    let _PromiseAll = Promise.all;
    Promise.all = function () {
        self.tracer.logPromiseAllBegin(async_hooks.executionAsyncId(), async_hooks.triggerAsyncId());
        
        let ret = _PromiseAll.apply(this, arguments);

        self.tracer.logPromiseAllEnd(async_hooks.executionAsyncId(), async_hooks.triggerAsyncId());
        
        return ret;
    };

    let _PromiseRace = Promise.race;
    Promise.race = function () {
        self.tracer.logPromiseRaceBegin(async_hooks.executionAsyncId(), async_hooks.triggerAsyncId());
        
        let ret = _PromiseRace.apply(this, arguments);

        self.tracer.logPromiseRaceEnd(async_hooks.executionAsyncId(), async_hooks.triggerAsyncId());
        
        return ret;
    };

}

AsyncMonitor.prototype.getCurrent = function () {
    return async_hooks.executionAsyncId();
}

module.exports = AsyncMonitor;