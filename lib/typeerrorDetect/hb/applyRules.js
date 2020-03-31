const registrationRule = require('./rules/registration');

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
        var event_i = events[i];
        for (var j = i + 1; j < eventNum; j++) {
            var event_j = events[j];
            if (opts.registration) {
                //console.log('i: %d, j: %d', i, j);
                //console.log('i: %s', JSON.stringify(event_i));
                //console.log('j: %s', JSON.stringify(event_j));
                registrationRule.apply(asyncObjs, event_i, event_j, relations);
            }
        }
    }

    if (opts.promiseRace) {
        dealWithPromiseRace (events, relations);
    }
};

function dealWithPromiseRace (events, relations) {

};

module.exports = applyRules;