const opts = require('./config');
const registrationRule = require('./rules/registration');
const resolveRule = require('./rules/resolve');
const fifoRule = require('./rules/fifo');
const timeoutRule = require('./rules/timeout');
const intervalRule = require('./rules/interval');
const promiseAllRule = require('./rules/promiseall');
const globalRule = require('./rules/global');
const promiseRaceRule = require('./rules/promiserace');

function applyRules (asyncObjs, relations) {
    let eventNum = asyncObjs.getNum();
    var events = asyncObjs.getAll();

    for (var i = 0; i < eventNum; i++) {
        var ei = events[i];
        //if (isSkipForDebug(ei, ['10', '14'])) continue;
        for (var j = 0; j < eventNum; j++) {
            if (j === i) continue;
            var ej = events[j];
            //if (isSkipForDebug(ej, ['10', '14'])) continue;
            console.log('applyRule %s %s', ei.id, ej.id);
            relations.isEventHB(ei, ej);
            //buildEventHB(asyncObjs, ei, ej, relations);
        }
    }

    /*if (opts.promiseRace) {
        dealWithPromiseRace (events, relations);
    }*/
};

function isSkipForDebug(e, skipIds) {
    for (var i = 0; i < skipIds.length; i++) {
        //console.log('isSkip: %s', JSON.stringify(e));
        if (e.id == skipIds[i])
            return true;
    }
    return false;
}

function _applyRules (asyncObjs, relations) {
    let defaultOpts = {
        registration: true,
        resolve: true,
        fifo: true,
        fifoByTimeout: true,
        timeout: true,
        promiseAll: true,
        promiseRace: true,
        global: true
    };
    let _opts = { ...defaultOpts, ...opts };

    if (_opts.registration) {
        console.log('apply registration rule');
        registrationRule._apply(asyncObjs, relations);
        console.log('complete');
    }
    if (_opts.resolve) {
        console.log('apply resolve rule');
        resolveRule._apply(asyncObjs, relations);
        console.log('complete');
    }
    if (_opts.fifo) {
        console.log('apply fifo rule');
        fifoRule._apply(asyncObjs, relations);
        console.log('complete');
    }
    if (_opts.timeout) {
        console.log('apply timeout rule');
        timeoutRule._apply(asyncObjs, relations);
        console.log('complete');
    }
    if (_opts.interval) {
        console.log('apply interval rule');
        intervalRule._apply(asyncObjs, relations);
        console.log('complete');
    }
    if (_opts.promiseAll) {
        console.log('apply promiseall rule');
        promiseAllRule._apply(asyncObjs, relations);
        console.log('complete');
    }
    if (_opts.global) {
        console.log('apply global rule');
        globalRule.apply(asyncObjs, relations);
        console.log('complete');
    }
    if (_opts.promiseRace) {
        console.log('apply promiserace rule');
        promiseRaceRule._apply(asyncObjs, relations);
        console.log('complete');
    }
}

module.exports = { applyRules, _applyRules };