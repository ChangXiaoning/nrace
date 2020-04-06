var fs = require('fs');
var x, y, z, a;

x = 'hello';

setImmediate(function () {
    y = 'world';
    fs.writeSync(1, 'Immediate\n');
});

process.nextTick(function () {
    z = 'world';
    fs.writeSync(1, 'nextTick\n');
});