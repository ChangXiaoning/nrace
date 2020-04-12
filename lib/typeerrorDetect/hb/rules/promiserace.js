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

module.exports = { apply }