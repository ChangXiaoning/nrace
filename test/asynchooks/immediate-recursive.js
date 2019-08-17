const asyncLog = require('./asyncLog.js')
const fs = require('fs')

setImmediate(()=>{
    setImmediate(()=>{
        setImmediate(()=>{
            fs.writeSync(1, 'File operation is done!\n');
        })
    })
})