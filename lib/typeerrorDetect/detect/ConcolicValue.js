const _ = require('lodash');
const logger = require('../../../driver/logger.js').logger;

const Connector = ConcolicValue.Connector = '*';

class AnnotatedExecution {
    constructor (hbgraph) {
        this.collection = [];
        this.hbgraph = hbgraph;
    }

    addSymbolic (concrete, symbolic, isFieldAccess, valIsObject, e) {
        let me = this;
        let cval = me.getConcolicValue(concrete, valIsObject);
        if (isFieldAccess) {
            let base = symbolic.base;
            let prop = symbolic.prop;
    
            let c_base = me.getConcolicValue(base, 'true');
            let c_base_symbols = c_base.symbolic;
            for (let base_symbol of c_base_symbols) {
                let local = base_symbol.local;
                let access_path = base_symbol.access_path;
                let symbol = { local: local, access_path: [...access_path, prop], event: e };
                if (!(me.isExistSymbol(cval, symbol)))
                    cval.symbolic.push(symbol);
            }
        } else {
            cval.symbolic.push({ local: symbolic, access_path: [], event: e });
        }
        return cval;
    };

    isExistSymbol (cval, symbol) {
        let me = this;
        let s_symbol = me.toString(symbol)[0];
        let currentSymbol = cval.symbolic;
        let s_currentSymbol = me.toString(currentSymbol);
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

    cval2String (cval) {
        return printObj(cval, ['concrete', 'symbolic', 'valIsObject']);
    };

    print () {
        let me = this;
        let info = '\n*** CONCOLIC VALUE REPORTS ***\n';
            info += 'Count of concolic values found: ' + this.collection.length + '\n';
            let count = 0;
            for (let cval of me.collection) {
                count++;
                info += '[' + count + ']' + me.cval2String(cval) + '\n';
            }
            logger.warn(info);
    }

    getConcrete (val) {
        if (val instanceof ConcolicValue) {
            return val.concrete;
        } else {
            return val;
        }
    }

    getSymbolic (val) {
        if (val instanceof ConcolicValue) {
            return val.symbolic;
        } else {
            return undefined;
        }
    }

    searchConcolicValue (val, valIsObject) {
        return this.collection.find(cval => cval.concrete == val && cval.valIsObject == valIsObject);
    }

    getConcolicValue (val, valIsObject) {
        let me = this;
        let res = null;
        let cvals = me.collection.filter(cval => cval.concrete == val && cval.valIsObject == valIsObject);
        if (cvals.length > 0)
            res = cvals[cvals.length - 1];
        if (cvals.length > 1)
            logger.warn('more than one cvals');
        return res;   
    }

    backwardUpdateSymbolic (ctarget) {
        //let symbolic = ctarget.symbolic[0];
        //let index_s_ym = ConcolicValue.toString(symbolic, false);
        let me = this;
        for (let cval of me.collection) {
            if (cval == ctarget)
                continue;
            me.overwrite(ctarget, cval);
        }
    }

    /**
     * Check whether storing value into cval_a causes cval_b is overwritten
     * @param {*} cval_a 
     * @param {*} cval_b 
     */
    overwrite (cval_a, cval_b) {
        let me = this;
        let s_indexSym = me.toString(cval_a.symbolic, false);
        for (let sym of cval_b.symbolic) {
            let s_sym = me.toString(sym, false)[0];
            let idx = s_indexSym.indexOf(s_sym);
            if ( idx != -1 ) {
                //check overwritten condition. Overwritten if:
                //1. in the same event OR
                //2. if cval_b access happens before cval_a access
                let ea = cval_a.symbolic[idx].event;
                let eb = sym.event;
                if (ea == eb || me.hbgraph.happensBeforeWithGraphLib(eb, ea))
                    _.remove(cval_b.symbolic, (s) => s == sym);
            }
        }
    }

    extendSymbolic (cval, symbolic) {
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

    dereference (cval, crefer) {
        let me = this;
        let s_refer_symbolic = me.toString(crefer.symbolic);
        _.remove(cval.symbolic, (sym) => {
            let s = me.toString(sym)[0];
            return s_refer_symbolic.indexOf(s) != -1;
        });
    }

    toString (symbolic, includeEv = true) {
        let res = [];
        if (Array.isArray(symbolic)) {
            for (let symbol of symbolic) {
                if (includeEv)
                    res.push([symbol.local, ...symbol.access_path, symbol.event].join(Connector));
                else
                    res.push([symbol.local, ...symbol.access_path].join(Connector));
            }
        } else {
            if (includeEv)
                res.push([symbolic.local, ...symbolic.access_path, symbolic.event].join(Connector));
            else 
                res.push([symbolic.local, ...symbolic.access_path]);
        }
        return res;
    }
}

function ConcolicValue (concrete, symbolic, isFieldAccess, valIsObject, e, execution) {
    this.concrete = concrete;
    this.valIsObject = valIsObject;
    this.symbolic = [];

    if (isFieldAccess) {  
        let base = symbolic.base;
        let prop = symbolic.prop;

        let c_base = execution.getConcolicValue(base, 'true');
        let c_base_symbols = c_base.symbolic;
        for (let base_symbol of c_base_symbols) {
            let local = base_symbol.local;
            let access_path = base_symbol.access_path;
            this.symbolic.push({ local: local, access_path: [...access_path, prop], event: e });
        }
    } else {
        this.symbolic.push({ local: symbolic, access_path: [], event: e });
    }

    execution.collection.push(this);
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

module.exports = {
    ConcolicValue: ConcolicValue,
    AnnotatedExecution: AnnotatedExecution,
};
