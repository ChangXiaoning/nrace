class AsyncObjects {
    constructor (events) {
        this.objects = events;
    }

    getAll() {
        return this.objects;
    }

    getByAsyncId (asyncId) {
        return this.objects.filter(event => event.id === asyncId);
    }

    getNum() {
        return this.objects.length;
    }
}

module.exports = AsyncObjects;