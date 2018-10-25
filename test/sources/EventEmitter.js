var EventEmitter = require('events');
var myEE = new EventEmitter();
function cb1 (){}
myEE.on('foo', cb1);
myEE.on('bar', () => {});
myEE.eventNames();
myEE.removeListener('bar',cb1);
myEE.listeners('foo')
myEE.emit('foo');
