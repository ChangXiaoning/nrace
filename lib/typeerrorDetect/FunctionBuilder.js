const _ = require('lodash');

/**
 * context: id -> parent
 */
class FunctionBuilder {
    constructor () {
        this.counts = [];
        this.vars = {0: {}};
        //this.stack = [0];
        this.stack = [];
        this.contexts = new Map();
        this.variables = new Map();
        this.GLOBAL = makeGlobal();
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
        return this.top().iid + '-' + this.counts[this.top()];
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
        console.log(lineno);
        let context = this.contexts.get(functionId);
        //let parent = context.getParent();
        let ctx = new Context(context, iid);
        this.stack.push(ctx);

        ctx.markReferenced(referencedByClosure);

        this.counts[iid] = this.counts[iid] || 0;
        this.counts[iid] = this.counts[iid] + 1;
        this.vars[this.getId()] = this.vars[this.getId()] || {};
    }

    functionExit (lineno) {
        let ctx = this.stack.pop();
        let name2scope = ctx.seal();
        let me = this;
        for (let [name, scope] of name2scope.entries()) {
            //TODO
            me.variables.set(name, scope);
        }
    }

    scriptEnter () {
        this.stack.push(this.GLOBAL);
    }

    scriptExit () {
        this.stack.pop();
    }

    ready () {
        return this.variables;
    }
}

class Context {
    constructor (parent, iid) {
        if (arguments.length == 0) {
            this.parent = null;
            this.iid = 'GOLOBAL';
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
        while (c) {
            for (let [name, objId] of c.variables.entries()) {
                if (work.indexOf(name) > -1) {
                    res.set(name, [c.iid, functionEnterIid]);
                    _.remove(work, (na) => na == name);
                }
            }
            c = c.parent;
        }
        return res;
    }
}

var makeGlobal = function () {
    return new Context();
}

module.exports = FunctionBuilder;