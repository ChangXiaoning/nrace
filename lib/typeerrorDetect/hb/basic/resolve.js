function findAsyncObjectWhereResolved (asyncObjects, e) {
    let current = asyncObjects.getByAsyncId(e.resolved.current);
    if (current.length == 0) {
        return null;
    } else {
        return current[0];
    }
};

//check if aoi resolves aoj
function apply (aoi, aoj, asyncObjects, relations) {
    let foundRelation = false;
    if (aoj.type == 'PROMISE' && aoj.hasOwnProperty('resolved') && aoj.id != aoj.resolved.current) {
        let parent = asyncObjects.findAsyncObjectWhereResolved(aoj);
        if (parent.id == aoi.id) {
            relations.add(aoi.id, aoj.id, 'resolve');
            foundRelation = true;
        }
    }
    return foundRelation;
}

module.exports = {apply};