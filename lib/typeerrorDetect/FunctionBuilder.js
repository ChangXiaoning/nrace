class FunctionBuilder {
    constructor () {
        this.counts = [];
        this.vars = {0: {}};
        this.stack = [0];
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
}

module.exports = FunctionBuilder;