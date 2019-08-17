const asyncLog = require('./asyncLog.js')
const fs = require('fs')

setImmediate(()=>{
    fs.writeSync(1, 'File operation 1 is done!\n');
});

setImmediate(()=>{
    fs.writeSync(1, 'File operation 2 is done!\n');
});

setImmediate(()=>{
    fs.writeSync(1, 'File operation 3 is done!\n');
});