const _ = require('lodash');

/**
 * Promise.race(n) creates n+1 promises
 * Promise 1 waits for some of promises 2..n+1 to resolve 
 * Details: ei = po, ej = p1 has already been checked and failed because
 * ei starts after ej starts. Therefore, whether ei = p1 is registered by
 * Promise.all (ej = p0).
 */

function apply(e, relations){
    for (let promiseset of relations.promiseRaceSet) {
        if (e.id == promiseset[0]) {
            let processResult = preprocessSinglePromiseSet(promiseset, relations);
            if (processResult.length == 2) {
                relations.add(processResult[1], processResult[0]);
                break;
            }
        }
    }
    return;
};

function isInSamePromiseRaceSet (ei, ej, promiseRaceSets) {
    for (var p = 0; p < promiseRaceSets.length; p++) {
        let curr = promiseRaceSets[p];
        if (curr[0] == ej.id) {
            for (var q = 1; q < curr.length; q++) {
                if (curr[q] == ei.id) 
                    return true;
            }
        }
    }
    return false;
}

function getPromiseRaceSet (ei, ej, promiseRaceSets) {
    for (var p = 0; p < promiseRaceSets.length; p++) {
        let curr = promiseRaceSets[p];
        if (curr[0] == ej.id) {
            for (var q = 1; q < curr.length; q++) {
                if (curr[q] == ei.id)
                    return curr;
            }
        }
    }
}

function isFirstPromiseForRace (id, promiseRaceSets) {
    for (var i = 0; i < promiseRaceSets.length; i++) {
        if (promiseRaceSets[i][0] == id) {
            return promiseRaceSets[i];
        }
    }
    return false;
}

function _apply (asyncObjects, relations) {
    let copy = relations.promiseRaceSet.slice();
    preprocess(asyncObjects, relations, copy);
    removeResolveForFirstPromise(asyncObjects, relations);

    relations.promiseRaceSet.forEach(promiseset => {
        let firstPromise = asyncObjects.getByAsyncId(promiseset[0])[0];
        if (promiseset.length == 2) {
            relations.add(promiseset[0], firstPromise.id, 'promiserace');
        } else {
            let count = 0;
            asyncObjects.getAll().forEach(e => {
                if (promiseset.indexOf(e.id) == -1) {
                    for (let i = 1; i < promiseset.length; i++) {
                        if (!relations.happensBefore(e.id, promiseset[i])) 
                            break;
                        count++;
                    }
                    if (count == promiseset.length - 1)
                        relations.add(e.id, firstPromise.id, 'promiserace-i');
                }
            });
        }
    });
}

function removeResolveForFirstPromise (asyncObjects, relations) {
    relations.promiseRaceSet.forEach(promiseset => {
        let firstPromise = asyncObjects.getByAsyncId(promiseset[0])[0];
        relations.removeIncomingTo(firstPromise.id);
    });
}

function preprocess (asyncObjects, relations, promiseRaceSets) {
    promiseRaceSets.forEach(promiseset => {
        for (let i = 1; i < promiseset.length - 1; i++) {
            for (let j = i + 1; j < promiseset.length; j++) {
                if (relations.happensBefore(promiseset[i], promiseset[j])) {
                    relations.removeFromPromiseRaceSet(promiseset[j]);
                } else if (relations.happensBefore(promiseset[j], promiseset[i])) {
                    relations.removeFromPromiseRaceSet(promiseset[i]);
                }
            }
        }
    })
}

function _remove (arr, deletedEle) {
    _.remove(arr, (ele) => {return ele == deletedEle});
    return arr;
}

function preprocessSinglePromiseSet (promiseset, relations) {
    let copy = promiseset.slice();
    for (let i = 1; i < promiseset.length - 1; i++) {
        for (let j = i + 1; j < promiseset.length; j++) {
            if (relations.happensBefore(promiseset[i], promiseset[j])) {
                //relations.removeFromPromiseRaceSet(promiseset[j]);
                _remove(copy, promiseset[j]);
            } else if (relations.happensBefore(promiseset[j], promiseset[i])) {
                //relations.removeFromPromiseRaceSet(promiseset[i]);
                _remove(copy, promiseset[i]);
            }
        }
    }
    return copy;
}

module.exports = { apply, _apply };