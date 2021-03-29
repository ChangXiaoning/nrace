class Matrix {
    constructor (len) {
        this.matrix = new Array(len);
        for (let i = 0; i < len; i++) {
            this.matrix[i] = new Array(len).fill(null);
        }
        this.referenceDict = {};
        this.cnt = 0;
    }

    findOrCreateRef (eid) {
        let result;
        if (!this.referenceDict[eid]) this.referenceDict[eid] = this.cnt++
        result = this.referenceDict[eid];
        return result;
    }

    init () {}

    update (ei, ej, value) {
        let i = this.findOrCreateRef(ei);
        let j = this.findOrCreateRef(ej);
        if (value == 0) {
            this.matrix[i][j] = value;
            this.matrix[j][i] = value;
        } else {
            this.matrix[i][j] = value;
            this.matrix[j][i] = -value;
        }
        //hb relation due to transtivity
        var visit = [];
        
    }

    get (ei, ej) {
        let i = this.findOrCreateRef(ei);
        let j = this.findOrCreateRef(ej);
        return this.matrix[i][j];
    }
}

module.exports = Matrix;