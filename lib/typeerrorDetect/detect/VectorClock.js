/* Vector clock used for events and async tasks */

var BitArray = require('./BitArray');

// Constructor
function VectorClock (size) {
    BitArray.call(this, size);
    this.idx = VectorClock.counter++;
};

VectorClock.prototype = VectorClock.prototype;

/* VectorClock PRIVATE STATIC METHODS */

//Incrementing the t-th component of a vector clock
VectorClock.increase = function (vc, index) {
    if (vc.getAt(index) == BitArray._OFF) vc.setAt(index, BitArray._ON)
    else console.log('error');
}

VectorClock.counter = 0;

/**
 * 
 * @param {VectorClock} vc1 
 * @param {VectorClock} vc2
 * @return {VectorClock} vc: vc[i] = max(vc1[i], vc2[i])
 */
VectorClock.lamda = function (vc1, vc2) {
    return this.getUnion(vc1, vc2);
};

VectorClock.bigUnion = function (vcs, size) {
    let result = new VectorClock(size);
    vcs.forEach(vc => {
        result = VectorClock.lamda(result, vc);
    });
    return result;
}

VectorClock.inct = function (vcs, size) {
    let result = VectorClock.bigUnion(vcs, size);
    return VectorClock.increase(result, result.idx);
}

//Compare vc1[vc1.idx] and vc2[vc1.idx]
VectorClock.compare = function (vc1, vc2) {
    let bit1 = vc1.getAt(vc1.idx);
    let bit2 = vc2.getAt(vc1.idx);
    return VectorClock._difference(bit1, bit2) ? VectorClock._OFF : VectorClock._ON;
}

module.exports = VectorClock;