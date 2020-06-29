class FunctionBuilder {
    constructor () {
        this.counts = [];
        this.vars = {0: {}};
        this.stack = [0];
        this.contexts = new Map();
    }

    enter (iid) {
        this.counts[iid] = this.counts[iid] || 0;
        this.counts[iid] = this.counts[iid] + 1;
        this.stack.push(iid);
        this.vars[this.getId()] = this.vars[this.getId()] || {};
    }

    declare (name) {
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
        return this.stack[this.stack.length - 1];
    }

    getId () {
        return this.top() + '-' + this.counts[this.top()];
    }

    exit () {
        this.stack.pop();
    }

    createContext (objId) {
        let curr = this.top();
        this.contexts.set(objId, curr);
    }

    functionEnter (functionId, iid) {
        let context = this.contexts.get(functionId);
        let parent = context.getParent();
        let ctx = new Context(parent, iid);
        this.stack.push(ctx);
    }

    functionExit () {
        this.stack.pop();
    }
}

class Context {
    constructor () {
        if (arguments.length == 0) {
            this.parent = null;
            this.iid = 'GOLOBAL';
        } else {
            this.parent = arguments.parent;
            this.iid = arguments.iid;
        }
        this.variables = new Map();
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
}

var makeGlobal = function () {
    return new Context();
}

module.exports = FunctionBuilder;