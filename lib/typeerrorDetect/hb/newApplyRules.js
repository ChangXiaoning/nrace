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
const nextTickRule = require('./rules/nextTick');

var rules = [
    registrationRule,
    resolveRule,
    actionRule,
    intervalRule,
    promiseAllRule,
];

var chainCounter = 0;
var pendingEvents = {};
var pendingHBs = {};

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

    //promise may have no startOp but it resolves others. So we take
    //these promises into consideration
    let promises = asyncObjs.getAll()
                    .filter(p => p.resolved && !p.startOp)
                    .sort(function (a, b) {
                        return a.resolved.lineno - b.resolved.lineno;
                    });
    
    i = 0, j = 0;
    let _tasks = [];
    while (i < tasks.length && j < promises.length) {
        if (tasks[i].startOp && tasks[i].startOp.lineno < promises[j].resolved.lineno) {_tasks.push(tasks[i++]);}
        else if (tasks[i].resource && tasks[i].lineno < promises[j].resolved.lineno) {_tasks.push(tasks[i++]);}
        else {_tasks.push(promises[j++]);}
    }
    if (i == tasks.length) for (; j < promises.length; j++) {_tasks.push(promises[j]);}
    else for (; i < tasks.length; i++) { _tasks.push(tasks[i]); }

    let new_asyncObjs = new AsyncObjects(_tasks);
        
    new_asyncObjs.getAll().forEach(t => {
        //let info = t.startOp ? t.startOp.lineno : t.lineno;
        //if (t.id == '30')
        //console.log(t.id);
        console.log(t.id);
        /*let info;
        if (t.resource) info = t.lineno;
        else if (t.resolved) info = t.resolved.lineno;
        else info = t.startOp.lineno;
        console.log('applyRules:' + info);*/
        relations.addNode(t.id);
        addNodeIntoGraphBySimpleRules(t, intervalHB, relations);
        addInterChainEdgesBySimpleRules(asyncObjs, t, relations.promiseAllSet, relations.promiseRaceSet, relations);
        addInterChainEdgesByComplexRules(asyncObjs, t, relations);
    
        //promiseRaceRule.apply(t, relations);
    });
}

/**
 * Add the given node into graph by simple rules, i.e., registration
 * rule, setInterval rule, asynctask offload rule
 */
function addNodeIntoGraphBySimpleRules (e, intervalHB, relations) {
    var prior = [];
    var candidate = null;
    if (e.startOp || e.resolved) {
        //deal with event 1
        if (e.id == '1') {
            buildEdges(null, e, relations);
        } else {
            candidate = registrationRule.apply(e);
            if (candidate) {
                prior.push(candidate);
                buildEdges(prior, e, relations);
                prior = [];
                candidate = null;
            }
            candidate = intervalRule.apply(intervalHB, e);
            if (candidate.length > 0) {
                prior = candidate;
                buildEdges(prior, e, relations)
            }
        }
    } else {
        let tmp = actionRule.apply(e);
        if (tmp) {
            //cache the pending event (callback)
            pendingEvents[tmp.pending] = e.id;
            prior.push(tmp.prior);
            buildEdges(prior, e, relations);
        }
    }
}

/**
 * Add edges between chains by simple rules, i.e., asynctask-cb rule,
 * resolve rule, promiseall rule, 
 */
function addInterChainEdgesBySimpleRules (asyncObjs, e, promiseAllSet, promiseRaceSet, relations) {
    var prior = [];
    var candidate = null;
    if (Object.keys(pendingEvents).indexOf(e.id) > -1) {
        prior.push(pendingEvents[e.id]);
        delete pendingEvents[e.id];
    }
    if (prior.length > 0) {
        buildInterChainEdges(prior, e, relations);
        prior = [];
        candidate = null;
    }
    candidate = resolveRule.apply(asyncObjs, e, promiseRaceSet);
    if (candidate) {
        prior.push(candidate);
        buildInterChainEdges(prior, e, relations);
        prior = [];
        candidate = null;
    }
    candidate = promiseAllRule.apply(promiseAllSet, e);
    if (candidate) {
        prior = candidate;
        buildInterChainEdges(prior, e, relations);
    }
}

function buildInterChainEdges (priors, task, relations) {
    for (let prior of priors) {
        if (relations.hasNode(prior)) {
            relations.add(prior, task.id);
            relations.updateLastSync(prior, task.id);
            relations.reduceChain(prior, task.id);
        } else {
            pendingHBs[prior] = task.id;
        }
    }

    //Corner case: for promise resolve: p starts at line x, event e
    //starts at line y and resolves p at line z, where x < y < z.
    //Thus, when processing p, we have no information about its
    //resolve, since e does not start currently.
    if (Object.keys(pendingHBs).indexOf(task.id) > -1) {
        relations.add(task.id, pendingHBs[task.id]);
        relations.updateLastSync(task.id, pendingHBs[task.id]);
        relations.reduceChain(task.id, pendingHBs[task.id]);
        delete pendingHBs[task.id];
    }
}

/**
 * Add edges between chains by complex rules, i.e., FIFO rule,
 * FIFO-Timeout rule and nextTick rule
 */
function addInterChainEdgesByComplexRules (asyncObjs, e, relations) {
    var priors = [];
    if (e.startOp) {
        if (['TickObject', 'Immediate'].indexOf(e.type) > -1) {
            candidate = fifoRule.apply(e, asyncObjs, relations);
            priors = [...priors, ...candidate];
        } else if (e.type == 'Timeout') {
            candidate = timeoutRule.apply(e, asyncObjs, relations);
            priors = [...priors, ...candidate];
        }
        buildInterChainEdges(priors, e, relations);
        nextTickRule.apply(e, asyncObjs, relations);
    }
}

function buildEdges (priors, task, relations, isComplexRule) {
    //if (task.id == '11')
        //console.log('debug');
    //deal with event 1

    //if (priors.length == 0) return;
    let chainIds = getParticipateChains(priors, relations.chains, task.id);
    let isFindingExistingChain = false;
    let newChain = null;
    if (!isComplexRule) {
        for (let chainId of chainIds) {
            let chain = relations.chains[chainId];
            //Find the first chain to add the given task
            if (isFindingExistingChain == false) {
                let leaf = chain[chain.length - 1];
                if (priors.indexOf(leaf) > -1) {
                    isFindingExistingChain = true;
                    relations.add(leaf, task.id);
                    chain.push(task.id);
                    break;
                }
            }
        }
    }
    if (!isComplexRule && isFindingExistingChain == false) {
        //Create a new chain
        newChain = [task.id];
        //relations.chains[chainCounter++] = newChain;
        relations.addChain(newChain);
        if (priors) {
            buildInterChainEdges(priors, task, relations);
        }
    }
}

function getParticipateChains (priors, existingChains, tid) {
    //deal with event 1
    let result = [];
    if (priors) {
        priors.forEach(prior => {
            let found = false;
            for (let chainId in existingChains) {
                let chain = existingChains[chainId];
                if (chain.indexOf(prior) > -1) {
                    if (result.indexOf(chainId) == -1) result.push(chainId);
                    found = true;
                    break;
                }
            }
            if (!found) pendingHBs[prior] = tid;
        });
    }
    return result;
}

module.exports = { _applyRules };