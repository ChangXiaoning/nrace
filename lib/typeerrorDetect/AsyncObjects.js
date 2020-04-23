class AsyncObjects {
    constructor (events) {
        this.objects = events;
    }

    getAll() {
        return this.objects;
    }

    getByAsyncId (asyncId) {
        return this.objects.filter(event => {return event.id == asyncId;});
    }

    getNum() {
        return this.objects.length;
    }

    toString() {
        return JSON.stringify(this.objects);
    }

    findAsyncObjectWhereResolved (asyncObj) {
        let triggers = this.getAll().filter(e =>  
            (e.id == asyncObj.resolved.current || 
            e.id.split('-')[0] == asyncObj.resolved.current));
        //let triggers = asyncObjects.getByAsyncId(asyncObj.current);
        if (triggers.length == 0)
            return null;
        
        //select the closest
        for (let i = 0; i < triggers.length - 1; i++) {
            //TODO: check startOp property existence?
            if (triggers[i].startOp.lineno < asyncObj.resolved.lineno &&
                asyncObj.resolved.lineno < triggers[i + 1].startOp.lineno) {
                return triggers[i]; 
            }
        }
        return triggers[triggers.length - 1];
    }
}

module.exports = AsyncObjects;