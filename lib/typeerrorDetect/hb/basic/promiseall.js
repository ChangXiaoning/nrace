//check if aoi happens before aoj according to promise-all rule
function apply(aoi, aoj, asyncObjects, relations) {
    let foundRelation = false;
    let promiseAllSet = relations.promiseAllSet;
    for (let promiseset of promiseAllSet) {
        let firstPromise = asyncObjects.getByAsyncId(promiseset[0])[0];
        if (firstPromise.id == aoi.id) {
            if (promiseset.indexOf(aoj.id) > 0) {
                relations.add(aoi.id, aoj.id, 'promiseall');
                foundRelation = true;
            }
            break;
        }
    }
    return foundRelation;
}

module.exports = {apply};