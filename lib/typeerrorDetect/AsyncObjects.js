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
}

module.exports = AsyncObjects;