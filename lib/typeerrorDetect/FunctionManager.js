var logger = require('../../driver/logger.js').logger;

/**
 * 
 * @param {String} iid 
 * @param {String} name 
 */
function Function (iid, name) {
    this.iid = iid;
    this.name = name;
    this.isExplicitReturn = false;
};

/**
 * used to match up functionEnter()/functionExit() because function argument f is not available in functionExit
 * each element of the stack is an instance of Function class
 * where the isExplicitReturn indicates if we have seen
 * an explicit return for this function.
 */
function FunctionManager () {
    this.stack = new Array();
    this.counts = {};
    this.vars = {};
};

FunctionManager.prototype.enter = function (iid, name) {
    var func = new Function (iid, name);
    this.stack.push(func);
    this.counts[iid] = this.counts[iid] || 0;
    this.counts[iid] += 1
    this.vars[this.getId()] = this.vars[this.getId()] || {};
};

FunctionManager.prototype.declare = function (name) {
    if (!this.vars[this.getId()]) {
        logger.error('Lack a FUNCTION_ENTER operation ...');
    }
    this.vars[this.getId()][name] = true;
};

FunctionManager.prototype.return = function () {
    this.top().isExplicitReturn = true;
};

FunctionManager.prototype.exit = function (iid) {
    var f = this.stack.pop();
};

/**
 * @return {Function}
 */
FunctionManager.prototype.top = function () {
    return this.stack[this.stack.length - 1];
};

FunctionManager.prototype.getId = function () {
    var currentFunciid = this.top().iid;
    return currentFunciid + this.counts[currentFunciid];
};

module.exports = {
    Function: Function,
    FunctionManager: FunctionManager
};