function findAsyncObjectWhereRegistered(asyncObjects, asyncObj) {
    let register = asyncObjects.getByAsyncId(asyncObj.prior);
    if (register && register.length == 1) {
        return register[0];
    } else {
        // For some system events, their prior is 0, which does not
        // exist before
        return null;
    }
};

//if aoi registers aoj, add relation aoi -> aoj
function apply (aoi, aoj, asyncObjects, relations) {
    let foundRelation = false;
    //console.log('registration: %s, %s', aoi.id, aoj.id);
    let parent = findAsyncObjectWhereRegistered(asyncObjects, aoj);
    if (parent && parent.id == aoi.id) {
        relations.add(aoi.id, aoj.id, 'registration');
        foundRelation = true;
    }
    return foundRelation;
}

module.exports = {apply};