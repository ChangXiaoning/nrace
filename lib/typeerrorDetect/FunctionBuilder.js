const fs = require('fs');
const _ = require('lodash');
const GLOBAL_IID = 1;

/**
 * context: funcId -> parent <Context>
 * iid: the FUNCITION_ENTET iid, where the function is created
 */
class FunctionBuilder {
    constructor () {
        this.counts = [];
        this.vars = {0: {}};
        //this.stack = [0];
        this.stack = [];
        this.contexts = new Map();
        this.contextChain = {};
        this.dyContextChain = {};
        this.variables = new Map();
        this.GLOBAL = makeGlobal();
        this.declaredVariables = new Map();
    }

    enter (iid) {
        this.counts[iid] = this.counts[iid] || 0;
        this.counts[iid] = this.counts[iid] + 1;
        this.stack.push(iid);
        this.vars[this.getId()] = this.vars[this.getId()] || {};
    }

    declare (name, objId) {
        let curr = this.top();
        curr.newVariable(name, objId);

        if (!this.vars[this.getId()]) 
            return;
        if (typeof name == 'string')
            this.vars[this.getId()][name] = true;
    }

    isDeclaredLocal (name) {
        if (!this.vars[this.getId()])
            return false;
        return this.vars[this.getId()][name];
    }

    top () {
        if (this.stack.length == 0) {
            this.stack.push(this.GLOBAL);
        }
        return this.stack[this.stack.length - 1];
    }

    getId () {
        return this.top().iid + '-' + this.counts[this.top().iid];
    }

    exit () {
        this.stack.pop();
    }

    createFun (objId, functionEnterIid, referencedByClosure) {
        this.createContext(objId);
    }

    createContext (objId) {
        let curr = this.top();
        this.contexts.set(objId, curr);
    }

    functionEnter (functionId, iid, referencedByClosure, lineno) {
        //if (lineno == 17447)
        //console.log(lineno);
        let context = this.contexts.get(functionId);
        //let parent = context.getParent();
        let ctx = new Context(context, iid);
        this.stack.push(ctx);

        //FUNCTION_ENTET iid -> parent FUNCTION_ENTET iid
        if (ctx && ctx.parent)
            this.contextChain[ctx.iid] = ctx.parent.iid;

        ctx.markReferenced(referencedByClosure);

        this.counts[iid] = this.counts[iid] || 0;
        this.counts[iid] = this.counts[iid] + 1;
        this.vars[this.getId()] = this.vars[this.getId()] || {};

        //compute dynamic scope chain: i.e., if a function is invoked more than once
        ctx.count = this.counts[iid];
        if (ctx && ctx.parent)
            this.dyContextChain[ctx.iid + '-' + ctx.count] = ctx.parent.iid + '-' + ctx.parent.count;
    }

    functionExit (lineno) {
        let ctx = this.stack.pop();
        /*let name2scope = ctx.seal();
        let me = this;
        for (let [name, contexts] of name2scope.entries()) {
            let contexts_iid = contexts.map(context => context.iid);
            let existingContexts = me.getVariable(name);
            if (existingContexts) {
                for (let context_iid of contexts_iid) {
                    if (existingContexts.indexOf(context_iid) == -1)
                        existingContexts.push(context_iid);
                }
            } else
                me.variables.set(name, contexts_iid);       
            //me.variables.set(name, scope);
        }*/
        this.getDeclaredVariables(ctx);
    }

    getVariable (index) {
        for (let name of this.variables.keys()) {
            if (isArrayEqual(name, index))
                return this.variables.get(name);
        }
        return;
    }

    scriptEnter (iid) {
        let ctx = new Context(null, iid);
        this.stack.push(ctx);
        //this.stack.push(this.GLOBAL);

        this.counts[iid] = this.counts[iid] || 0;
        this.counts[iid] = this.counts[iid] + 1;
        this.vars[this.getId()] = this.vars[this.getId()] || {};

        //compute dynamic scope chain: i.e., if a function is invoked more than once
        ctx.count = this.counts[iid];
        //this.dyContextChain[ctx.iid + '-' + ctx.count] = ctx.parent.iid + '-' + ctx.parent.count;
    }

    scriptExit () {
        let ctx = this.stack.pop();
        this.getDeclaredVariables(ctx);
    }

    ready () {
        return this.variables;
    }

    getCurrentContextEnterIid () {
        let iid = this.top().iid;
        return iid + '-' + this.counts[iid];
    }

    /**
     * combine variables declared in the given context into this.declaredVariable
     * @param {Context} ctx 
     */
    getDeclaredVariables (ctx) {
        let me = this;
        for (let [name, objId] of ctx.variables.entries()) {
            let tKey = [ctx.iid, name];
            if (!isMapHasArrKey(me.declaredVariables, tKey))
                me.declaredVariables.set(tKey, objId);
        }
    }

    store (hbFileName) {
        let contextInfoFileName = hbFileName.replace('.hb-full.json', '.context.json')
        let variables = convertMap2Obj(this.declaredVariables);
        fs.writeFileSync(contextInfoFileName, JSON.stringify({ variables }, null, 4), 'utf-8');
        
        let contextChainFileName = hbFileName.replace('.hb-full.json', '.context-chain.json')
        //let contexts = convertContextsMap2Obj(this.contexts);
        let contextsChain = this.contextChain;
        fs.writeFileSync(contextChainFileName, JSON.stringify({ contextsChain }, null, 4), 'utf-8');
        
        let dycontextChainFileName = hbFileName.replace('.hb-full.json', '.dyContext-chain.json')
        let dyContextChain = this.dyContextChain;
        fs.writeFileSync(dycontextChainFileName, JSON.stringify({ dyContextChain }, null, 4), 'utf-8');
    }
}

class Context {
    constructor (parent, iid) {
        if (arguments.length == 0) {
            this.parent = null;
            this.iid = GLOBAL_IID;
        } else {
            this.parent = parent;
            this.iid = iid;
        }
        this.variables = new Map();
        this.referencedNames = new Array();
    }

    isGlobal () {
        return this.parent == null;
    }

    getParent () {
        return this.parent;
    }
    
    hasVariable (name) {
        return this.variables.has(name);
    }

    newVariable (name, objId) {
        if (!(this.hasVariable(name))) {
            this.variables.set(name, objId);
        }
    }

    writeToVariable (name, objId) {
        let me = this;
        while (me != null) {
            if (me.hasVariable(name)) {
                me.variables.set(name, objId);
                return me;
            }
            if (me.isGlobal()) {
                me.newVariable(name, objId);
                return me;
            }
            me = me.parent;
        }
    }

    /**
     * Mark the given names as being referenced by the context and its
     * parents
     * @param {Set} names 
     */
    markReferenced (names) {
        if (names == null) 
            return;
        this.referencedNames = [...this.referencedNames, ...names.values()];
    }

    /**
     * Invoked when functionEnter. Compute scope chain for each free variable.
     * name -> [start(declare), freevarialbeLocation]
     */
    seal () {
        let work = this.referencedNames;
        let res = new Map();
        let c = this;
        let functionEnterIid = this.iid;
        let locate = this;
        while (c) {
            for (let [name, objId] of c.variables.entries()) {
                if (work.indexOf(name) > -1) {
                    res.set(name, [c, locate]);
                    _.remove(work, (na) => na == name);
                }
            }
            c = c.parent;
        }
        res = this.processScope(res);
        return res;
    }

    /**
     * 
     * @param {Map} map: name -> array (tuple) [start(declare), freevariableLocation]
     * @returns {Map}: identifier [declareScope (iid), name] -> [...childrenScopes (iid)]
     */
    processScope (map) {
        let res = new Map();
        for (let [name, tuple] of map.entries()) {
            let declareCtx = tuple[0];
            let endCtx = tuple[1];
            let idx_iid = declareCtx.iid ? declareCtx.iid : GLOBAL_IID;
            let idx = [idx_iid, name];
            let scopes = [];
            let ctx = endCtx;
            while (ctx) {
                scopes.push(ctx);
                if (ctx == declareCtx)
                    break;
                ctx = ctx.parent;
            }
            scopes.reverse();
            res.set(idx, scopes);
        }
        return res;
    }
}

var makeGlobal = function () {
    return new Context();
}

function isArrayEqual (arr1, arr2) {
    if (arr1.length != arr2.length)
        return false;
    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] != arr2[i]) 
            return false;
    }
    return true;
}

function isMapHasArrKey (map, arr) {
    for (let key of map.keys()) {
        if (isArrayEqual(key, arr))
            return true;
    }
    return false;
}

function convertMap2Obj (inputMap) {
    let obj = {};
    for (let [key, value] of inputMap.entries()) {
        obj[key] = value;
    }
    return obj;
}

module.exports = FunctionBuilder;