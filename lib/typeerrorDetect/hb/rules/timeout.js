function apply(asyncObjects, ea, eb, relations) {
    //console.log('timeout apply: %s, %s', ea.id, eb.id);
    if (ea.type == eb.type && eb.type === 'Timeout') {
        if (ea.delayTime <= eb.delayTime) {
            //console.log('1. timeout apply: %s, %s', ea.id, eb.id);
            if (relations.isOpHB(ea.registerOp, eb.registerOp)){
                relations.add(ea.id, eb.id, 'timeout');
                return true;
            }
        }
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