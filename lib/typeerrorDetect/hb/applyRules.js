const registrationRule = require('./rules/registration');
const timeoutRule = require('./rules/timeout');
const intervalRule = require('./rules/interval');
const fifoRule = require('./rules/fifo');
const opts = require('./config');

function applyRules (asyncObjs, relations) {
    let eventNum = asyncObjs.getNum();
    var events = asyncObjs.getAll();

    for (var i = 0; i < eventNum; i++) {
        var ei = events[i];
        for (var j = 0; j < eventNum; j++) {
            if (j === i) continue;
            var ej = events[j];
            relations.isEventHB(ei, ej);
            //buildEventHB(asyncObjs, ei, ej, relations);
        }
    }

    if (opts.promiseRace) {
        dealWithPromiseRace (events, relations);
    }
};

function buildEventHB(asyncObjs, ei, ej, relations) {
    if (opts.registration) {
        registrationRule.apply(asyncObjs, ei, ej, relations);
    }
    if (opts.timeout) {
        timeoutRule.apply(asyncObjs, ei, ej, relations);
    }
    if (opts.interval) {
        intervalRule.apply(asyncObjs, ei, ej, relations);
    }
    if (opts.fifo) {
        fifoRule.apply(asyncObjs, ei, ej, relations);
    }
}

function dealWithPromiseRace (events, relations) {

};

module.exports = {
    applyRules: applyRules,
    buildEventHB: buildEventHB,
};
//module.exports = applyRules;