class AccessBuilder {
    constructor () {
        this.records = [];
    }

    push(rcd) {
        this.records.push(rcd);
    }
}

module.exports = AccessBuilder;