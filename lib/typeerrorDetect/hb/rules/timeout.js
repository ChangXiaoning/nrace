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

function _apply (asyncObjects, relations) {
    let timers = asyncObjects.getAll().filter(t => t.type == 'Timeout');
    
    let groups = {};
    timers.forEach(timer => {
        let tick = relations.registeredIn(timer.id);
        if (!groups[tick])
            groups[tick] = [];
        
        //interval - only the first one is included
        if (! isIntervelTimer(timer.id)) 
            g[tick].push(timer);
            
        for (let tick in groups) {
            let timers = groups[tick];
            for (let i = 0; i < timers.length - 1; i++) {
                for (let j = i + 1; j < timers.length; j++) {
                    if (timers[i].delayTime <= timers[j].delayTime)
                        relations.add(timers[i].id, timers[j].id, 'timeout');
                }
            }
        }
    });

}

function isIntervelTimer (id) {
    return id.indexOf('-') > -1;
}

module.exports = { apply }