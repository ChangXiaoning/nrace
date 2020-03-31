function apply(asyncObjects, ea, eb, relations) {
    if (ea.type = eb.type && eb.type === 'Timeout') {
        if (ea.delayTime <= eb.delayTime) {
            let parentObject_a = findAsyncObjectWhereRegistered(asyncObjects, ea),
                parentObject_b = findAsyncObjectWhereRegistered(asyncObjects, eb);
            
        }
    }
    
    let parentObject = findAsyncObjectWhereRegistered(asyncObjects, eb);
    if (parentObject == ea) {
        relations.add(ea.id, eb.id, 'registration');
    }
};

function findAsyncObjectWhereRegistered(asyncObjects, asyncObj) {
    //TODO: promise has no prior property
    let register = asyncObjects.getByAsyncId(asyncObj.prior);
    if (register && register.length == 1) {
        return register[0];
    } else {
        return null;
    }
};

module.exports = { apply }