var fs = require("fs");

var timer = setInterval(function(){
    fs.writeSync(1, 'hello\n');
},2);

//clearInterval(timer);
setTimeout(function () {
    clearInterval(timer);
}, 7);