function applyRules (events, relations, opts) {
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
    if (opts.promiseRace) {
        dealWithPromiseRace (events, relations);
    }
};

function dealWithPromiseRace (events, relations) {

};

module.exports = applyRules;