const asyncLog = require('./asyncLog.js')
const fs = require('fs')

fs.writeSync(1, 'My nextTicks start...\n');

setImmediate(()=>{
    fs.writeSync(1, 'Set immediate 1 is done!\n');
});

process.nextTick(()=>{
    fs.writeSync(1, 'Next tick 1 is done!\n');
});

process.nextTick(()=>{
    fs.writeSync(1, 'Next tick 2 is done!\n');
});

process.nextTick(()=>{
    fs.writeSync(1, 'Next tick 3 is done!\n');
});

fs.writeSync(1, 'My nextTicks end...\n');