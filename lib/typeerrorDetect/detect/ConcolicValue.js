const logger = require('../../../driver/logger.js').logger;

function ConcolicValue (concrete, symbolic, isFieldAccess) {

    this.concrete = concrete;
    //this.symbolic = symbolic;
    //this.result = this;

    if (isFieldAccess) {
        let local = null;
        let access_path = null;
        let base = symbolic.base;
        let prop = symbolic.prop;
        
        for (let cval of ConcolicValue.collection) {
            if (cval.concrete == base) {
                access_path = cval.symbolic.access_path? [...cval.symbolic.access_path, prop] : [prop];
                local = cval.symbolic.local? local.symbolic.local : base;
                break;
            }
        }
        this.symbolic = [{ access_path: access_path, local: local }];
    } else if (symbolic) {
        this.symbolic = [{ access_path: [], local: symbolic }];
    }

    ConcolicValue.collection.push(this);
}

ConcolicValue.collection = [];

ConcolicValue.computeAccessPath = function (symbolic) {

}

ConcolicValue.prototype.toString = function() {
    return this.concrete+"";
};

ConcolicValue.prototype.valueOf = function() {
    if (this.concrete !== null && this.concrete !== undefined)
        return this.concrete.valueOf();
    else
        return this.concrete;
}

ConcolicValue.getConcrete = function (val) {
    if (val instanceof ConcolicValue) {
        return val.concrete;
    } else {
        return val;
    }
}

ConcolicValue.getSymbolic = function (val) {
    if (val instanceof ConcolicValue) {
        return val.symbolic;
    } else {
        return undefined;
    }
}

ConcolicValue.searchConcolicValue = function (val) {
    return ConcolicValue.collection.find(cval => cval.concrete == val);
}

ConcolicValue.getConcolicValue = function (val) {
    let res = null;
    let cvals = ConcolicValue.collection.filter(cval => cval.concrete == val);
    if (cvals.length > 0)
        res = cvals[cvals.length - 1];
        if (cvals.leng == 1)
            logger.warn('more than one cvals');
    return res;   
}

ConcolicValue.updateSymbolic = function (cval, symbolic, isFieldAccess) {
    if (!isFieldAccess)
        cval.symbolic.push(symbolic);
    else {

    }
}

module.exports = ConcolicValue;
