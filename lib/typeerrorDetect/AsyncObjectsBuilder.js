const AsyncObjects = require('./asyncobjects');
const logger = require('../../driver/logger.js').logger;

class AsyncObjectsBuilder {
    constructor() {
        this.objects = [];
        this.eventExecutionStack = [];
        this.functionCallsMap = new Map();
        this.init();
    }

    //Add the event representing the global event
    init () {
        this.objects.push({
            id: '1',
        });
    }

    push(e) {
        this.objects.push(e);
    }

    getCurrentEvent() {
        return this.eventExecutionStack[this.eventExecutionStack.length -1];
    }

    enter(id) {
        this.eventExecutionStack.push(id);
    }

    exit(id) {
        if (this.getCurrentEvent() != id) {
            logger.error('Something wrong event exiting does not equal to the top of stack, id: ' + id);
        } else {
            this.eventExecutionStack.pop();
        }
    } 

    toString() {
        return JSON.stringify(this.objects);
    }

    extract() {
        return new AsyncObjects(this.objects);
    }

    startExecution(id, lineno) {
        var res = this.objects.filter(event => event.id === id);
        if (!res) {
            logger.error('Event %s is not registered before', id);
            return;
        }
        // Some system events may start to execute without registration
        if (res.length === 0) {
            return;
        }
        res[0].startOp = {
            event: id,
            lineno: lineno,
        };
    }

    initAsyncObjects(entries) {
        let self = this;
        let currentId = 1;

        entries
            .filter((entry) => entry.e === 'AsyncHook-init')
            .forEach(entry => {
                entries
                    .filter((b_entry) => b_entry.e === 'AsyncHook-before' &&
                        b_entry.id === entry.id)
                    .forEach((b_entry) => {
                        self.objects.push({
                            id: ++currentId,
                            entry: entry,
                            beforeindex: b_entry.logindex
                        });
                    });
            });

        //promises and object initiated but not exercised
        entries
            .filter((entry) => entry.e === 'AsyncHook-init')
            .forEach(entry => {
                //if not treated by previous case
                if (this.getByAsyncId(entry.id).length === 0) {
                    let b_entry = entries.find((b_entry) => b_entry.e === 'AsyncHook-promiseResolve' &&
                        b_entry.id === entry.id);
                    if (b_entry)
                        self.objects.push({
                            id: ++currentId,
                            entry: entry,
                            beforeindex: b_entry.logindex
                        });
                    else    //object only initiated
                        self.objects.push({
                            id: ++currentId,
                            entry: entry,
                            beforeindex: entry.logindex
                        });
                }
            });
    }

    addIndexes(entries) {   // eslint-disable-line no-unused-vars
        let index = 0;
        entries = entries.map((e) => {
            e.logindex = index++;
            return e;
        });
    }

    dealWithMainModule(entries) {
        let self = this;
        let mainentry = {
            id: 1,
            entry: {
                e: 'AsyncHook-init',
                id: 1,
                trigger: 0,
                type: 'main',
                current: 0
            }
        };

        let maincall = entries.find((entry) => entry.current === 1 && entry.e === 'call-entry');
        if (maincall)
            mainentry.callback = {
                name: maincall.function,
                file: maincall.file,
                line: maincall.line,
                args: maincall.args,
                logindex: maincall.logindex,
                instance: this.calculateInstanceOrder(maincall)
            };

        self.objects.push(mainentry);
    }

    calculateInstanceOrder(entry) {
        let funcInst = this.functionCallsMap.get(entry.function + '#' + entry.file + '#' + entry.line);
        if (!funcInst)
            funcInst = 0;
        this.functionCallsMap.set(entry.function + '#' + entry.file + '#' + entry.line, ++funcInst);

        return funcInst;
    }

    initAsyncObjects(entries) {
        let self = this;
        let currentId = 1;

        entries
            .filter((entry) => entry.e === 'AsyncHook-init')
            .forEach(entry => {
                entries
                    .filter((b_entry) => b_entry.e === 'AsyncHook-before' &&
                        b_entry.id === entry.id)
                    .forEach((b_entry) => {
                        self.objects.push({
                            id: ++currentId,
                            entry: entry,
                            beforeindex: b_entry.logindex
                        });
                    });
            });

        //promises and object initiated but not exercised
        entries
            .filter((entry) => entry.e === 'AsyncHook-init')
            .forEach(entry => {
                //if not treated by previous case
                if (this.getByAsyncId(entry.id).length === 0) {
                    let b_entry = entries.find((b_entry) => b_entry.e === 'AsyncHook-promiseResolve' &&
                        b_entry.id === entry.id);
                    if (b_entry)
                        self.objects.push({
                            id: ++currentId,
                            entry: entry,
                            beforeindex: b_entry.logindex
                        });
                    else    //object only initiated
                        self.objects.push({
                            id: ++currentId,
                            entry: entry,
                            beforeindex: entry.logindex
                        });
                }
            });
    }

    associateCallbacks(entries) {
        entries
            .filter((entry) => entry.e === 'call-entry')
            .forEach((entry) => {
                let asyncObj = this.findAssociatedAsyncObject(entry);
                if (!asyncObj.callback) {
                    asyncObj.callback = {
                        name: entry.function,
                        file: entry.file,
                        line: entry.line,
                        args: entry.args,
                        logindex: entry.logindex,
                        instance: this.calculateInstanceOrder(entry)
                    };
                }
            });
    }

    findAssociatedAsyncObject(targetEntry) {
        let ret = this.objects.filter((asyncObj) => targetEntry.current === asyncObj.entry.id);
        for (let i = 0; i < ret.length - 1; i++) {
            if (targetEntry.logindex > ret[i].beforeindex && targetEntry.logindex < ret[i + 1].beforeindex)
                return ret[i];
        }
        return ret[ret.length - 1];
    }

    getByAsyncId(asyncId) {
        return this.objects.filter((obj) => obj.entry.id === asyncId);
    }
}

module.exports = AsyncObjectsBuilder