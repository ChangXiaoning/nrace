/* Vector clock used for events and async tasks */

var BitArray = require('./BitArray');
var printObj = require('./Report').printObj;

// Constructor
function VectorClock (size) {
    BitArray.call(this, size);
    this.idx = VectorClock.counter++;
};

VectorClock.prototype = BitArray.prototype;

/*function defineStaticMethods () {
    var ownPropertyNames = Object.getOwnPropertyNames(BitArray);
    var ignore = ['length', 'name', 'arguments', 'caller', 'prototype'];
    ownPropertyNames.forEach(property => {
        if (ignore.indexOf(property) < 0) {
            VectorClock[property] = BitArray[property];
        }
    });
}

defineStaticMethods();*/

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
 * @return {Array} arr: arr[i] = max(vc1.m_bits[i], vc2.m_bits[i])
 */
VectorClock.lamda = function (vc1, vc2) {
    let result_bitArray = BitArray.getUnion(vc1, vc2);
    return result_bitArray;
};

VectorClock.bigUnion = function (vcs, size) {
    let result = new VectorClock(size);
    vcs.forEach(vc => {
        let bitArray = VectorClock.lamda(result, vc);
        result.m_bits = bitArray.m_bits;
    });
    return result;
}

VectorClock.inct = function (vcs, size) {
    let result = VectorClock.bigUnion(vcs, size);
    VectorClock.increase(result, result.idx);
    return result;
}

//Compare vc1[vc1.idx] and vc2[vc1.idx]
VectorClock.compare = function (vc1, vc2) {
    let bitArray1 = vc1.m_bits;
    let bitArray2 = vc2.m_bits;
    let bit1 = bitArray1.getAt(vc1.idx);
    let bit2 = bitArray2.getAt(vc1.idx);
    return BitArray._difference(bit1, bit2) ? BitArray._OFF : BitArray._ON;
}

VectorClock.stringify = function (vc) {
    let str = printObj(vc, ['m_bits', 'idx']);
    return str;
}

module.exports = VectorClock;