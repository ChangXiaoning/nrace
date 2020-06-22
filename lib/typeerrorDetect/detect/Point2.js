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
        if (!(me.isObjectInPoint2List(obj, me.pointers[p])))
            this.pointers[p].push(obj);
    }

    removePoint2 (map) {
        let me = this;
        for (let [cval, pointers] of map) {
            //let pointers = map.get(cval);
            for (let pointer of pointers) {
                //if (pointer.pointerName == 'this*_cache*id' && pointer.event == '1') 
                    //console.log('bug');
                let overwrittenObj = {concrete: cval.concrete, event: pointer.event, valIsObject: cval.valIsObject};
                _.remove(me.pointers[pointer.pointerName], (obj) => me.isObjectEqual(obj, overwrittenObj));
            }
        }
    }
    
    getPoint2Objects (pointer) {
        return this.pointers[pointer];
    }

    isObjectEqual (obj_a, obj_b) {
        return obj_a.concrete == obj_b.concrete && obj_a.valIsObject == obj_b.valIsObject && obj_a.event == obj_b.event;
    }

    isObjectInPoint2List (obj, list) {
        let res = false;
        let me = this;
        for (let candidate of list) {
            if (me.isObjectEqual(obj, candidate)) {
                res = true;
                break;
            }
        }
        return res;
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

    _print(pointerList) {
        let me = this;
        let info = '\n*** POINT2 RESULT ***\n';
        let count = 0;
        for (let pointer in me.pointers) {
            if (pointerList.indexOf(pointer) != -1) {
                count++;
                info += '[' + count + ']' + pointer + ' -> ' + JSON.stringify(me.pointers[pointer]) + '\n';
            }
        }
        logger.warn(info);
    }
}

module.exports = Point2;