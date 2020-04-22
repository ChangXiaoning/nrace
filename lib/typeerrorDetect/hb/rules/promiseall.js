/*
 for Promise.all([p1, p2, ...]) 
 we track: register p0, p1, p2, ... 
 we parse: [p0, p1, p2, ...] in promiseSets
 we analyze: p0 happens after p1, p2, 
 Details: ei = po, ej = p1 has already been checked and failed because
 ei starts after ej starts. Therefore, whether ei = p1 is registered by
 Promise.all (ej = p0).
*/

function apply(promiseSets, ei, ej, relations){
    if (isInSamePromiseSet(ei, ej, promiseSets)) {
        relations.add(ei.id, ej.id, 'promise-all');
        console.log('promiseall (%s, %s)', ei.id, ej.id);
    }
};

function isInSamePromiseSet (ei, ej, promiseSets) {
    for (var p = 0; p < promiseSets.length; p++) {
        let curr = promiseSets[p];
        if (curr[0] == ej.id) {
            for (var q = 1; q < curr.length; q++) {
                if (curr[q] == ei.id) 
                    return true;
            }
        }
    }
    return false;
}

function _apply (asyncObjects, relations, promiseAllSets) {
    promiseAllSets.forEach(promiseset => {
        let firstPromise = asyncObjects.getByAsyncId(promiseset.shift())[0];
        promiseset.forEach(pid => {
            let p = asyncObjects.getByAsyncId(pid)[0];
            relations.add(p.id, firstPromise.id, 'promiseall');
        });
    });
}

module.exports = { apply }