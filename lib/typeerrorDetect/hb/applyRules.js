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

var chainCounter = 0;

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
        let priors = collectPrior(asyncObjs, t, intervalHB, relations.promiseAllSet, relations);
        //priors.forEach(prior => relations.add(prior, t.id))
        buildEdges(priors, t, relations);
    });
}

function collectPrior (asyncObjs, e, intervalHB, promiseAllSet, relations) {
    //console.log(e.id);
    var priors = [];
    if (e.startOp) {
        var candidate = registrationRule.apply(e);
        priors.push(candidate);
        candidate = resolveRule.apply(asyncObjs, e);
        if (candidate) priors.push(candidate);
        candidate = intervalRule.apply(intervalHB, e);
        priors = [...priors, ...candidate];
        candidate = promiseAllRule.apply(promiseAllSet, e);
        priors = [...priors, ...candidate];
        candidate = fifoRule.apply(e, asyncObjs, relations);
        priors = [...priors, ...candidate];
    }
    return priors;
}

function buildEdges (priors, task, relations) {
    //if (task.id == '10')
        //console.log('debug');
    let chainIds = getParticipateChains(priors, relations.chains);
    let isFindingExistingChain = false;
    let newChain = null;
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
    if (isFindingExistingChain == false) {
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
}

function getParticipateChains (priors, existingChains) {
    let result = [];
    priors.forEach(prior => {
        for (let chainId in existingChains) {
            let chain = existingChains[chainId];
            if (chain.indexOf(prior) > -1) {
                if (result.indexOf(chainId) == -1) result.push(chainId);
                break;
            }
        }
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