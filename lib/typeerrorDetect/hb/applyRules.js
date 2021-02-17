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
        //console.log(t.id);
        /*let info;
        if (t.resource) info = t.lineno;
        else if (t.resolved) info = t.resolved.lineno;
        else info = t.startOp.lineno;
        console.log(info);*/
        relations.addNode(t.id);
        let priors = collectPrior(asyncObjs, t, intervalHB, relations.promiseAllSet);
        //priors.forEach(prior => relations.add(prior, t.id))
        buildEdges(priors, t, relations);
        priors = collectFIFOPrior(asyncObjs, t, relations);
        buildEdges(priors, t, relations, true);
        //if (t.id == 7)
        //console.log('debug');
        let stack = [];
        priors.forEach(prior => {
            let chainId = relations.getChainId(prior);
            let idx = relations.chains[chainId].indexOf(prior);
            stack.push({chainId: chainId, idx: idx});
        });
        nextTickRule.apply(t, asyncObjs, relations, stack);
    });
}

function collectPrior (asyncObjs, e, intervalHB, promiseAllSet) {
    //if (e.id == '*A*150')
    //console.log(e.id);
    var priors = [];
    var candidate = null;
    if (e.startOp || e.resolved) {
        candidate = registrationRule.apply(e);
        priors.push(candidate);
        candidate = resolveRule.apply(asyncObjs, e);
        if (candidate) priors.push(candidate);
        if (Object.keys(pendingEvents).indexOf(e.id) > -1) {
            priors.push(pendingEvents[e.id]);
            delete pendingEvents[e.id];
        }
        candidate = intervalRule.apply(intervalHB, e);
        priors = [...priors, ...candidate];
        candidate = promiseAllRule.apply(promiseAllSet, e);
        priors = [...priors, ...candidate];
    } else {
        let tmp = actionRule.apply(e);
        if (tmp) {
            priors.push(tmp.prior);
            pendingEvents[tmp.pending] = e.id;
        }
    }
    return priors;
}

function collectFIFOPrior (asyncObjs, e, relations) {
    //if (e.id == 8)
        //console.log('debug');
    var priors = [];
    if (e.startOp) {
        if (['TickObject', 'Immediate'].indexOf(e.type) > -1) {
            candidate = fifoRule.apply(e, asyncObjs, relations);
            priors = [...priors, ...candidate];
        } else if (e.type == 'Timeout') {
            candidate = timeoutRule.apply(e, asyncObjs, relations);
            priors = [...priors, ...candidate];
        }
    }
    return priors;
}

function buildEdges (priors, task, relations, isComplexRule) {
    //if (task.id == '11')
        //console.log('debug');
    if (priors.length == 0) return;
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
        relations.chains[chainCounter++] = newChain;
    }

    //Already find the first chain or create a new chain
    for (let i of chainIds) {
        let chain = relations.chains[i];
        if (chain.indexOf(task.id) == -1) {
            let lastNode = findLastNodeSatisfy(chain, priors);
            if (lastNode) {
                relations.add(lastNode, task.id);
            }
        }
    }

    //Corner case: for promise resolve, p1 is resolved by p2 at lineno
    //x, but p2 starts at lineno x after p1 is resolved by p2 in our
    //trace parsing result.
    if (Object.keys(pendingHBs).indexOf(task.id) > -1) {
        relations.add(task.id, pendingHBs[task.id]);
        delete pendingHBs[task.id];
    }
}

function getParticipateChains (priors, existingChains, tid) {
    let result = [];
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
    return result;
}

function findLastNodeSatisfy (chain, prior) {
    let lastNode = null;
    for (let i = chain.length - 1; i >= 0; i--) {
        if (prior.indexOf(chain[i]) > - 1) {
            lastNode = chain[i];
            break;
        }
    }
    return lastNode;
}

module.exports = { _applyRules };