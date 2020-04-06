var fs = require('fs');
var a, b;
var p1 = new Promise((resolve, reject) => {
    a = 1;
    setImmediate(function () {
        resolve(100);
    });
});

p1.then(value => {
    b = 1;
    fs.writeSync(1, '1'+value+'\n');
}, reason => {
    fs.writeSync(1, reason);
});