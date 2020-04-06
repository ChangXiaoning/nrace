var fs = require('fs');
var x, y, z, a;

x = 'hello';

setImmediate(function () {
    y = 'world';
});

setImmediate(function () {
    z = 'world';
});