/*
 for Promise.all([p1, p2, ...]) 
 we track: register p0, p1, p2, ... 
 we parse: [p0, p1, p2, ...] in promiseSets
 we analyze: p0 happens after p1, p2, 
 Details: ei = po, ej = p1 has already been checked and failed because
 ei starts after ej starts. Therefore, whether ei = p1 is registered by
 Promise.all (ej = p0).
*/

function apply(promiseAllSet, e){
    let result = [];
    promiseAllSet.forEach(promiseSet => {
        if (promiseSet[0] == e.id) {
            for (let i = 1; i < promiseSet.length; i++) {
                result.push(promiseSet[i]);
            }
        }
    });
    return result;
};

function _apply (asyncObjects, relations) {
    relations.promiseAllSet.forEach(promiseset => {
        let firstPromise = asyncObjects.getByAsyncId(promiseset.shift())[0];
        promiseset.forEach(pid => {
            let p = asyncObjects.getByAsyncId(pid)[0];
            relations.add(p.id, firstPromise.id, 'promiseall');
        });
    });
}

module.exports = { apply, _apply };