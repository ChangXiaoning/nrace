const opts = require('./config');
const registrationRule = require('./rules/registration');
const resolveRule = require('./rules/resolve');
const fifoRule = require('./rules/fifo');
const timeoutRule = require('./rules/timeout');
const intervalRule = require('./rules/interval');
const promiseAllRule = require('./rules/promiseall');
const globalRule = require('./rules/global');
const promiseRaceRule = require('./rules/promiserace');
const actionRule = require('./rules/action');
const AsyncObjects = require('../AsyncObjects');

var rules = [
    registrationRule,
    resolveRule,
    actionRule,
    intervalRule,
    promiseAllRule,
];

function _applyRules (asyncObjs, relations, actions) {

    let intervalHB = intervalRule.buildIntervalHB(asyncObjs);

    let events = asyncObjs.getAll()
        .filter(e => e.startOp)
        .sort(function (a, b) {
            return a.startOp.lineno - b.startOp.lineno;
        });
    
    let i = 0, j = 0;
    let tasks = [];
    while (i < events.length && j < actions.length) {
        if (events[i].startOp.lineno < actions[j].lineno) {tasks.push(events[i++])}
        else {tasks.push(actions[j++]);}
    }
    if (i == events.length) for (; j < actions.length; j++) {tasks.push(actions[j]);}
    else for (; i < events.length; i++) { tasks.push(events[i]); }

    let new_asyncObjs = new AsyncObjects(tasks);
        
    new_asyncObjs.getAll().forEach(t => {
        //let info = t.startOp ? t.startOp.lineno : t.lineno;
        //console.log(info);
        relations.addNode(t.id);
        let priors = collectPrior(asyncObjs, t, intervalHB, relations.promiseAllSet);
        priors.forEach(prior => relations.add(prior, t.id))
    });
}

function collectPrior (asyncObjs, e, intervalHB, promiseAllSet) {
    //console.log(e.id);
    var priors = [];
    if (e.startOp) {
        var candidate = registrationRule.apply(e);
        priors.push(candidate);
        candidate = resolveRule.apply(asyncObjs, e);
        if (candidate) priors.push(candidate);
        candidate = intervalRule.apply(intervalHB, e);
        priors = [...priors, candidate];
        candidate = promiseAllRule.apply(promiseAllSet, e);
        priors = [...priors, candidate];
    }
    return priors;
}

module.exports = { _applyRules };