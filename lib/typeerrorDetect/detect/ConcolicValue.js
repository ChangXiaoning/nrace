const _ = require('lodash');
const logger = require('../../../driver/logger.js').logger;

const Connector = ConcolicValue.Connector = '*';
const BUILDIN_SCOPE = 'B';

class AnnotatedExecution {
    constructor (hbgraph, declaredVariable, contextChain) {
        this.collection = [];
        this.hbgraph = hbgraph;
        this.declaredVariable = Object.keys(declaredVariable);
        this.contextChain = contextChain;
    }

    addSymbolic (concrete, symbolic, isFieldAccess, valIsObject, e, lineno, isDeclaredLocal, contextIid) {
        //if (isDeclaredLocal) return;
        let me = this;
        let cval = me.getConcolicValue(concrete, valIsObject);
        if (isFieldAccess) {
            let base = symbolic.base;
            let prop = symbolic.prop;
    
            let c_base = me.getConcolicValue(base, 'true');
            let c_base_symbols = c_base.symbolic;
            for (let base_symbol of c_base_symbols) {
                let local = base_symbol.local;
                if (me.isPointerAccessible(local, contextIid, local.name)) {
                    let access_path = base_symbol.access_path;
                    let symbol = { local: local, access_path: [...access_path, prop], event: e, lineno: lineno };
                    if (!(me.isExistSymbol(cval, symbol))) {
                        //console.log('1');
                        cval.symbolic.push(symbol);
                    }   
                }
            }
        } else {
            var scope = null;
            if (isDeclaredLocal)
                scope = contextIid;
            else {
                //free variable pointer
                var ctx = contextIid;
                while (ctx) {
                    if (me.isGivenCtxHasDeclaredVar(ctx, symbolic)) {
                        scope = ctx;
                        break;
                    }
                    ctx = me.contextChain[ctx];
                }
            }
            cval.symbolic.push({ local: {scope: scope, name: symbolic},
                access_path: [], event: e, lineno: lineno });
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
        return printObj(cval, ['concrete', 'symbolic', 'valIsObject', 'lineno']);
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

    _print (vals) {
        let me = this;
        let info = '\n*** CONCOLIC VALUE REPORTS ***\n';
        let count = 0;
        for (let val of vals) {
            let cval = me.getConcolicValue(val.val, val.valIsObject);
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
        let overwrites = new Map();
        for (let cval of me.collection) {
            if (cval == ctarget)
                continue;
            let overwritePointers = me.overwrite(ctarget, cval);
            if (overwritePointers.length > 0)
                overwrites.set(cval, overwritePointers);
        }
        return overwrites;
    }

    /**
     * Check whether storing value into cval_a causes cval_b is overwritten
     * @param {*} cval_a 
     * @param {*} cval_b 
     */
    overwrite (cval_a, cval_b) {
        //if (cval_b.concrete == '*U*')
            //console.log('debug');
        let me = this;
        let res = [];
        let s_indexSym = me.toString(cval_a.symbolic, false);
        let count = -1;
        let backup_b_symbolic = cval_b.symbolic.slice();
        for (let sym of cval_b.symbolic) {
            count++;
            let s_sym = me.toString(sym, false)[0];
            let idx = s_indexSym.indexOf(s_sym);
            if ( idx != -1 ) {
                //check overwritten condition. Overwritten if:
                //1. in the same event OR
                //2. if cval_b access happens before cval_a access
                let ea = cval_a.symbolic[idx].event;
                let eb = sym.event;
                if (ea == eb || me.hbgraph.happensBeforeWithGraphLib(eb, ea)) {
                    res.push({pointerName: s_sym, event: sym.event});
                    _.remove(backup_b_symbolic, (s) => s == sym);
                }
            }
        }
        cval_b.symbolic = backup_b_symbolic;
        return res;
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
                    res.push([symbol.local.scope, symbol.local.name, ...symbol.access_path, symbol.event].join(Connector));
                else
                    res.push([symbol.local.scope, symbol.local.name, ...symbol.access_path].join(Connector));
            }
        } else {
            if (includeEv)
                res.push([symbolic.local.scope, symbolic.local.name, ...symbolic.access_path, symbolic.event].join(Connector));
            else 
                res.push([symbolic.local.scope, symbolic.local.name, ...symbolic.access_path].join(Connector));
        }
        return res;
    }

    isGivenCtxHasDeclaredVar (ctx, name) {
        let me = this;
        let target = [ctx, name].join(',')
        for (let name of me.declaredVariable) {
            if (name == target)
                return true;
        }
        return false;
    }

    isAncestorOf (ctxa, ctxb) {
        let me = this;
        let cur = ctxb;
        while (cur) {
            if (cur == ctxa)
                return true;
            cur = me.contextChain[cur];
        }
        return false;
    }

    isPointerAccessible (pointer, currentCtxIid, targetName) {
        let me = this;
        let ctx = currentCtxIid;
        let declaredCtx = pointer.scope;
        let name = pointer.name;
        while (ctx) {
            if (me.isGivenCtxHasDeclaredVar(ctx, target)) {
                if (ctx == pointer.scope)
                    return true;
                else
                    return false;
            }
            ctx = me.contextChain[ctx];
        }
        return false;
    }
}

function ConcolicValue (concrete, symbolic, isFieldAccess, valIsObject, e, execution, lineno, isDeclaredLocal, contextIid) {
    //if (concrete == '115')
        //console.log('bug');
    this.concrete = concrete;
    this.valIsObject = valIsObject;
    this.symbolic = [];

    if (isFieldAccess) {  
        let base = symbolic.base;
        let prop = symbolic.prop;

        //console.log('lineno: %s', lineno);
        let c_base = execution.getConcolicValue(base, 'true');
        let c_base_symbols = c_base.symbolic;
        for (let base_symbol of c_base_symbols) {
            let local = base_symbol.local;
            //check scope relation 
            if (execution.isPointerAccessible(local, contextIid, local.name)) {
                let access_path = base_symbol.access_path;
                let symbol = { local: local, access_path: [...access_path, prop], event: e, lineno: lineno };
                if (!(execution.isExistSymbol(this, symbol)))
                    this.symbolic.push(symbol);
            }
        }
    } else {
        var scope = null;
        if (isDeclaredLocal)
            scope = contextIid;
        else {
            //free variable pointer
            var ctx = contextIid;
            while (ctx) {
                if (execution.isGivenCtxHasDeclaredVar(ctx, symbolic)) {
                    scope = ctx;
                    break;
                }
                ctx = execution.contextChain[ctx];
            }
        }
        //for some built-in function, e.g., setImmediate, has no
        //declaration, we treat them as GLOBAL
        if (scope == null)
            scope = BUILDIN_SCOPE;
        this.symbolic.push({ local: {scope: scope, name: symbolic},
            access_path: [], event: e, lineno: lineno, });
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
