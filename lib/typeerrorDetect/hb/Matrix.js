class Matrix {
    constructor (len) {
        this.matrix = new Array(len);
        console.log('init: %d', len);
        for (let i = 0; i < len; i++) {
            this.matrix[i] = new Array(len).fill(null);
        }
        this.referenceDict = {};
        this.cnt = 0;
    }

    findOrCreateRef (eid) {
        if (eid.startsWith('*A*')) return;
        let result;
        //console.log('---findOrCreateRef: find %s for %s', this.referenceDict[eid], eid);
        if (!this.referenceDict[eid] && this.referenceDict[eid] != 0) {
            this.referenceDict[eid] = this.cnt++;
            //console.log('create ref %d for %s', this.cnt, eid);
        }
        result = this.referenceDict[eid];
        return result;
    }

    init () {}

    update (ei, ej, value) {
        //we do not cache asyncTasks
        if (ei.startsWith('*A*') || ej.startsWith('*A*')) return;

        let i = this.findOrCreateRef(ei);
        let j = this.findOrCreateRef(ej);
        //console.log('update: %s, %s, %s, %s', ei, ej, i, j);
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
        //console.log('get: %s, %s', ei, ej);
        let i = this.findOrCreateRef(ei);
        let j = this.findOrCreateRef(ej);
        if (!this.matrix[i]) return null;
        return this.matrix[i][j];
    }
}

module.exports = Matrix;