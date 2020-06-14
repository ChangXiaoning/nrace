const logger = require('../../../driver/logger.js').logger;

class Point2 {
    constructor (hbgraph) {
        this.hbgraph = hbgraph;
        this.pointers = {};
    }

    addPoint2 (p, obj) {
        let me = this;
        this.pointers[p] = this.pointers[p]? this.pointers[p] : [];
        if (this.pointers[p].indexOf(obj) == -1)
            this.pointers[p].push(obj);
    }

    print () {
        let me = this;
        let info = '\n*** POINT2 RESULT ***\n';
        info += 'Count of pointers found: ' + this.pointers.length + '\n';
        let count = 0;
        for (let pointer in me.pointers) {
            count++;
            info += '[' + count + ']' + pointer + ' -> ' + JSON.stringify(me.pointers[pointer]) + '\n';
        }
        logger.warn(info);
    }
}

module.exports = Point2;