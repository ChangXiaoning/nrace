const _ = require('lodash');
const logger = require('../../../driver/logger.js').logger;

const Connector = ConcolicValue.Connector = '*';

function ConcolicValue (concrete, symbolic, isFieldAccess, valIsObject, e) {
    this.concrete = concrete;
    this.valIsObject = valIsObject;
    this.symbolic = [];

    if (isFieldAccess) {  
        let base = symbolic.base;
        let prop = symbolic.prop;

        let c_base = ConcolicValue.getConcolicValue(base, 'true');
        let c_base_symbols = c_base.symbolic;
        for (let base_symbol of c_base_symbols) {
            let local = base_symbol.local;
            let access_path = base_symbol.access_path;
            this.symbolic.push({ local: local, access_path: [...access_path, prop], event: e });
        }
    } else {
        this.symbolic.push({ local: symbolic, access_path: [], event: e });
    }

    ConcolicValue.collection.push(this);
}

ConcolicValue.collection = [];

ConcolicValue.addSymbolic = function (concrete, symbolic, isFieldAccess, valIsObject, e) {
    let cval = ConcolicValue.getConcolicValue(concrete, valIsObject);
    if (isFieldAccess) {
        let base = symbolic.base;
        let prop = symbolic.prop;

        let c_base = ConcolicValue.getConcolicValue(base, 'true');
        let c_base_symbols = c_base.symbolic;
        for (let base_symbol of c_base_symbols) {
            let local = base_symbol.local;
            let access_path = base_symbol.access_path;
            let symbol = { local: local, access_path: [...access_path, prop], event: e };
            if (!(ConcolicValue.isExistSymbol(cval, symbol)))
                cval.symbolic.push(symbol);
        }
    } else {
        cval.symbolic.push({ local: symbolic, access_path: [], event: e });
    }
    return cval;
};

ConcolicValue.isExistSymbol = function (cval, symbol) {
    let s_symbol = ConcolicValue.toString(symbol)[0];
    let currentSymbol = cval.symbolic;
    let s_currentSymbol = ConcolicValue.toString(currentSymbol);
    let symNum = cval.symbolic.length;
    let cnt = 0;

    for (let s_sym of s_currentSymbol) {
        if (s_sym != s_symbol)
            cnt++;
        else
            break;
    }

    return cnt != symNum;
}

ConcolicValue.prototype.toString = function() {
    return printObj(this, ['concrete', 'symbolic', 'valIsObject']);
};

ConcolicValue.print = function () {
    let info = '\n*** CONCOLIC VALUE REPORTS ***\n';
        info += 'Count of concolic values found: ' + ConcolicValue.collection.length + '\n';
        let count = 0;
        for (let cval of ConcolicValue.collection) {
            count++;
            info += '[' + count + ']' + cval.toString() + '\n';
        }
        logger.warn(info);
}

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

ConcolicValue.searchConcolicValue = function (val, valIsObject) {
    return ConcolicValue.collection.find(cval => cval.concrete == val && cval.valIsObject == valIsObject);
}

ConcolicValue.getConcolicValue = function (val, valIsObject) {
    let res = null;
    let cvals = ConcolicValue.collection.filter(cval => cval.concrete == val && cval.valIsObject == valIsObject);
    if (cvals.length > 0)
        res = cvals[cvals.length - 1];
    if (cvals.length > 1)
        logger.warn('more than one cvals');
    return res;   
}

ConcolicValue.backwardUpdateSymbolic = function (ctarget) {
    //let symbolic = ctarget.symbolic[0];
    //let index_s_ym = ConcolicValue.toString(symbolic, false);
    for (let cval of ConcolicValue.collection) {
        if (cval == ctarget)
            continue;
        if (ConcolicValue.isOverwritten(index_s_ym, cval)) {
            //overwritten: x.h = o1; x.h = o2;
            //extend symbolic of ctarget
            //ConcolicValue.extendSymbolic(ctarget, cval.symbolic);
            //overwritten the previous value (e.g., o1)
            //cval.symbolic = [];
            ConcolicValue.dereference(cval, ctarget);
        }
    }
}

/**
 * Check whether storing value into cval_a causes cval_b is overwritten
 * @param {*} cval_a 
 * @param {*} cval_b 
 */
ConcolicValue.isOverwritten = function (cval_a, cval_b) {
    let isOverwritten = false;
    let s_indexSym = ConcolicValue.toString(cval_a.symbolic, false);
    for (let sym of cval.symbolic) {
        let s_sym = ConcolicValue.toString(sym, false);
        if (s_indexSym.indexOf(s_sym) != -1) {
            //check overwritten condition. Overwritten if:
            //1. in the same event OR
            //2.
            isOverwritten = true;
            break;
        }
    }
    return isOverwritten;
}

ConcolicValue.extendSymbolic = function (cval, symbolic) {
    let s_symbolic = [];
    for (let symbol of cval.symbolic) {
        let s_symbol = [symbol.local, ...symbol.access_path].join('*');
        s_symbolic.push(s_symbol);
    }
    
    for (let symbol of symbolic) {
        let s_symbol = [symbol.local, ...symbol.access_path].join('*');
        if (s_symbolic.indexOf(s_symbol) < 0) {
            cval.symbolic.push(symbol);
        }
    }
}

ConcolicValue.dereference = function (cval, crefer) {
    let s_refer_symbolic = ConcolicValue.toString(crefer.symbolic);
    _.remove(cval.symbolic, (sym) => {
        let s = ConcolicValue.toString(sym)[0];
        return s_refer_symbolic.indexOf(s) != -1;
    });
}

ConcolicValue.toString = function (symbolic, includeEv = true) {
    let res = [];
    if (Array.isArray(symbolic)) {
        for (let symbol of symbolic) {
            if (includeEv)
                res.push([symbol.local, ...symbol.access_path, symbol.event].join(Connector));
            else
                res.push([symbol.local, ...symbol.access_path]).join(Connector);
        }
    } else {
        if (includeEv)
            res.push([symbolic.local, ...symbolic.access_path, symbolic.event].join(Connector));
        else 
            res.push([symbolic.local, ...symbolic.access_path]);
    }
    return res;
}

function printObj (o, fields) {
    let res = [];
    if (o && fields) {
        fields.forEach(field => {
            if (o.hasOwnProperty(field)) {
                res.push(field + ':' +JSON.stringify(o[field]));
            }
        });
    }
    return '{' + res.join(', ') + '}';
}

module.exports = ConcolicValue;
