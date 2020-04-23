/**
 * Promise.race(n) creates n+1 promises
 * Promise 1 waits for some of promises 2..n+1 to resolve 
 * Details: ei = po, ej = p1 has already been checked and failed because
 * ei starts after ej starts. Therefore, whether ei = p1 is registered by
 * Promise.all (ej = p0).
 */

function apply(asyncObjects, promiseSets, ei, ej, relations){
    let t = isFirstPromiseForRace(ej.id, promiseSets);

    if (t == false) return;

    if (t.indexOf(ei.id) != -1) {
        if (t.length == 2) {
            relations.removeIncomingTo(ej.id);
            relations.add(ei.id, ej.id, 'promise-race');
        } else {
            for (var k = 1; k < t.length; k++) {
                if (t[k] == ei.id)
                    continue;
                let ek = asyncObjects.getByAsyncId(t[k])[0];
                if (relations.isEventHB(ek, ei)) {
                    relations.removeFromPromiseRaceSet(t[k]);
                }
            }
        }
    } else {
        let pass = 0;
        for (var k = 1; k < t.length; k++) {
            let ek = asyncObjects.getByAsyncId(t[k])[0];
            if(!relations.isEventHB(ei, ek)) break;
            pass += 1
        }
        if (pass == t.length - 1) {
            relations.add(ei.id, ej.id, 'promise-race-i');
        }
    }
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

    this.relations.promiseRaceSet.forEach(promiseset => {
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
                    if (count == promiseset - 1)
                        relations.add(e.id, firstPromise.id, 'promiserace-i');
                }
            });
        }
    });
}

function preprocess (asyncObjects, relations, promiseRaceSets) {
    promiseRaceSets.forEach(promiseset => {
        for (let i = 1; i < promiseset.length - 1; i++) {
            for (let j = i + 1; j < promiseset.length; j++) {
                if (relations.happensBefore(promiseset[i].id, promiseset[j].id)) {
                    relations.removeFromPromiseRaceSet(promiseset[j]);
                } else if (relations.happensBefore(promiseset[j].id, promiseset[i].id)) {
                    relations.removeFromPromiseRaceSet(promiseset[i]);
                }
            }
        }
    })
}

module.exports = { apply, _apply };