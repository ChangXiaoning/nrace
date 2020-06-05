const logger = require('../../../driver/logger.js').logger;

function ConcolicValue (concrete, symbolic, isFieldAccess) {
    this.concrete = concrete;
    this.symbolic = [];

    if (isFieldAccess) {  
        let base = symbolic.base;
        let prop = symbolic.prop;

        let c_base = ConcolicValue.getConcolicValue(base);
        let c_base_symbols = c_base.symbolic;
        for (let base_symbol of c_base_symbols) {
            let local = base_symbol.local;
            let access_path = base_symbol.access_path;
            this.symbolic.push({ local: local, access_path: [...access_path, prop] });
        }
    } else {
        this.symbolic.push({ local: symbolic, access_path: [] });
    }

    ConcolicValue.collection.push(this);
}

ConcolicValue.collection = [];

ConcolicValue.addSymbolic = function (concrete, symbolic, isFieldAccess) {
    let cval = ConcolicValue.getConcolicValue(concrete);
    if (isFieldAccess) {
        let base = symbolic.base;
        let prop = symbolic.prop;

        let c_base = ConcolicValue.getConcolicValue(base);
        let c_base_symbols = c_base.symbolic;
        for (let base_symbol of c_base_symbols) {
            let local = base_symbol.local;
            let access_path = base_symbol.access_path;
            cval.symbolic.push({ local: local, access_path: [...access_path, prop] });
        }
    } else {
        cval.symbolic.push({ local: symbolic, access_path: [] });
    }
};

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
