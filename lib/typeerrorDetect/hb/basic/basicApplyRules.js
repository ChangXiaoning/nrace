const registrationRule = require('./registration');
const resolveRule = require('./resolve');
const intervalRule = require('./interval');
const promiseallRule = require('./promiseall');
const actionRule = require('./action');
const fifoRule = require('./fifo');
const fifoTimeoutRule = require('./fifotimeout');
const nextTickRule = require('./nexttick');

var simpleRules = [
    registrationRule,
    resolveRule,
    intervalRule,
    promiseallRule,
];

var complexApplyCount = 0;

function applyRules (asyncObjects, relations, actions) {
    buildSimpleRules(asyncObjects, relations, actions);
    buildComplexRules(asyncObjects, relations);
    console.log('complete: %d', complexApplyCount);
}

function buildSimpleRules (asyncObjects, relations, actions) {
    let asyncObjs = asyncObjects.getAll();
    for (let i = 0; i < asyncObjs.length; i++) {
        let aoi = asyncObjs[i];
        for (let j = 0; j < asyncObjs.length; j++) {
            if (j == i) continue;
            let aoj = asyncObjs[j];
            //console.log(aoi.id, aoj.id);
            
            for (let i = 0; i < simpleRules.length; i++) {
                let rule = simpleRules[i];
                if (rule.apply(aoi, aoj, asyncObjects, relations))
                    break;
            }
            //registration
            //registrationRule.apply(aoi, aoj, asyncObjects, relations);
            //resolve
            //resolveRule.apply(aoi, aoj, asyncObjects, relations);
            //interval
            //intervalRule.apply(aoi, aoj, relations);
            //promise-all
            //promiseallRule.apply(aoi, aoj, asyncObjects, relations);
        }
    }

    //action
    for (let i = 0; i < asyncObjs.length; i++) {
        let aoi = asyncObjs[i];
        for (let j = 0; j < actions.length; j++) {
            let aoj = actions[j];
            actionRule.apply(aoi, aoj, relations);
        }
    }
}

function buildComplexRules (asyncObjects, relations) {
    complexApplyCount++;
    if (complexApplyCount % 10 == 0)
        console.log('running: %d', complexApplyCount);
    let newRelationsFound = false;
    let asyncObjs = asyncObjects.getAll();
    for (let i = 0; i < asyncObjs.length; i++) {
        let aoi = asyncObjs[i];
        for (let j = 0; j < asyncObjs.length; j++) {
            if (j == i) continue;
            let aoj = asyncObjs[j];
            //fifo or fifo-timeout
            console.log(aoi.id, aoj.id);
            if (aoi.type == aoj.type && !relations.basicHappensBefore(aoi.id, aoj.id) && !relations.basicHappensBefore(aoj.id, aoi.id)) {
                switch (aoi.type) {
                    case 'TickObject':
                    case 'Immediate':
                    case 'Promise':
                        if (fifoRule.apply(aoi, aoj, relations))
                            newRelationsFound = true;
                        break;
                    case 'Timeout':
                        if (fifoTimeoutRule.apply(aoi, aoj, relations))
                            newRelationsFound = false;
                        break;
                }
            }
            //nexttick
            if (isOneOfTick(aoi, aoj) && !relations.basicHappensBefore(aoi.id, aoj.id) && !relations.basicHappensBefore(aoj.id, aoi.id)) {
                if (nextTickRule.apply(aoi, aoj, relations))
                    newRelationsFound = true;
            }
        }
    }
    if (newRelationsFound)
        buildComplexRules(asyncObjects, relations);
}

//different types, but one is tick
function isOneOfTick (aoi, aoj) {
    let itype = aoi.type, jtype = aoj.type;
    return itype !== jtype && (itype === 'TickObject' || jtype === 'TickObject');
}

module.exports = applyRules;