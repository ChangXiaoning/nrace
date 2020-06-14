const _ = require('lodash');
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

    removePoint2 (map) {
        let me = this;
        for (let [cval, pointers] of map) {
            //let pointers = map.get(cval);
            for (let pointer of pointers) {
                let overwrittenObj = cval.valIsObject == 'true'? 'obj_' + cval.concrete : 'val_' + cval.concrete;
                _.remove(me.pointers[pointer], (obj) => obj == overwrittenObj);
            }
        }
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