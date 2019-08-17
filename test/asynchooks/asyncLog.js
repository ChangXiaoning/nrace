const async_hooks = require('async_hooks');
const fs = require('fs')

let indent = 0;
const asyncLog = async_hooks.createHook({
    init(asyncId, type, triggerAsyncId) {
        const eid = async_hooks.executionAsyncId();
        const indentStr = ' '.repeat(indent);
        // The first parameter 1 means the console output
        fs.writeSync(1, `${indentStr}${type}(${asyncId}):` + ` trigger: ${triggerAsyncId} execution: ${eid}\n`);
    },
    before(asyncId) {
        const indentStr = ' '.repeat(indent);
        fs.writeFileSync(1, `${indentStr}before:  ${asyncId}\n`, { flag: 'a' });
        indent += 2;
    },
    after(asyncId) {
        indent -= 2;
        const indentStr = ' '.repeat(indent);
        fs.writeFileSync(1, `${indentStr}after:  ${asyncId}\n`, { flag: 'a' });
    },
    destroy(asyncId) {
        const indentStr = ' '.repeat(indent);
        fs.writeFileSync(1, `${indentStr}destroy:  ${asyncId}\n`, { flag: 'a' });
    },
});

asyncLog.enable();

exports.asyncLog = asyncLog;