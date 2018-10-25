const async_hooks = require('async_hooks');
const fs = require('fs');

var fs2 = require('../../lib/analysis/fsAgent.js');


var res = [];
fs2.writeFile('1.js','write data. by jie', function(){
    res.push('---done reading');
    console.log(res.join('\n'));
});

fs2.createReadStream('1.js', { start: 1, end: 4 }).on('data', function(c){
    console.log('-----received data from readstream:', c);
});

return;
let indent = 0;
async_hooks.createHook({
      init(asyncId, type, triggerAsyncId) {
              const eid = async_hooks.executionAsyncId();
              const indentStr = ' '.repeat(indent);
               res.push('===async init:'+asyncId+','+type+','+triggerAsyncId);
            },
      before(asyncId) {
              res.push('===async before ' + asyncId);
              const indentStr = ' '.repeat(indent);
              indent += 2;
            },
      after(asyncId) {
              res.push('===async after ' + asyncId);
              indent -= 2;
              const indentStr = ' '.repeat(indent);
            },
      destroy(asyncId) {
              res.push('===async destroy ' + asyncId);
              const indentStr = ' '.repeat(indent);
            },
      promiseResolve(asyncId) { 
              res.push('===asyncc resolve ' + asyncId + ', '+async_hooks.executionAsyncId());
              const indentStr = ' '.repeat(indent);
      }
}).enable();
/*
new Promise(function (resolve){
    var v = 'hello';
    res.push('before resolve');
    resolve(v);
}).then(function(value) {
    res.push('resolved');
    console.log(value);

    console.log('result:',res);
});
*/
/*
async function asyncFun () {
      var value = await Promise
        .resolve(1);
      res.push('----call resolve(1): in '+ async_hooks.executionAsyncId() );
      return value;
}
asyncFun().then(x => {
    res.push('----exiting, current asyncid: '+async_hooks.executionAsyncId());
    console.log('---result:'+res.join('\n'));
});
*/


