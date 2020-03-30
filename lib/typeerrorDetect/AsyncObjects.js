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
}

module.exports = AsyncObjects;