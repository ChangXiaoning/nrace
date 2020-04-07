/**
 * Promise.race(n) creates n+1 promises
 * Promise 1 waits for some of promises 2..n+1 to resolve 
 * Details: ei = po, ej = p1 has already been checked and failed because
 * ei starts after ej starts. Therefore, whether ei = p1 is registered by
 * Promise.all (ej = p0).
 */

function apply(promiseSets, ei, ej, relations){
    if (isInSamePromiseRaceSet(ei, ej, promiseSets)) {
        relations.add(ei.id, ej.id, 'promise-race');
        //console.log('promiseall (%s, %s)', ei.id, ej.id);
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

module.exports = { apply }