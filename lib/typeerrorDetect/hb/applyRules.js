const registrationRule = require('./rules/registration');
const timeoutRule = require('./rules/timeout');

function applyRules (asyncObjs, relations, opts) {
    var defaultOpts = {
        registration: true,
        resolve: true,
        timeout: true,
        interval: true,
        fifo: true,
        diffQ: true,
        promiseAll: true,
        promiseRace: true,
    };
    opts = {...defaultOpts, ...opts};

    let eventNum = asyncObjs.getNum();
    var events = asyncObjs.getAll();

    for (var i = 0; i < eventNum - 1; i++) {
        var ei = events[i];
        for (var j = i + 1; j < eventNum; j++) {
            var ej = events[j];
            buildEventHB(asyncObjs, ei, ej, relations, opts);
        }
    }

    if (opts.promiseRace) {
        dealWithPromiseRace (events, relations);
    }
};

function buildEventHB(asyncObjs, ei, ej, relations, opts) {
    if (opts.registration) {
        registrationRule.apply(asyncObjs, ei, ej, relations);
    }
    if (opts.timeout) {
        timeoutRule.apply(asyncObjs, ei, ej, relations);
    }
}

function dealWithPromiseRace (events, relations) {

};

module.exports = applyRules;