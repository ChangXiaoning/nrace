var fs = require('fs');

var res = [];
fs.writeFile('data.txt','this is file content', function(){
    res.push('done with writing');
    console.log(res.join('\n'));
});

var stream = fs.createReadStream('data.txt', { start: 1, end: 4 });
stream.on('data', function(c){
    console.log('on data', c);
});
stream.on('close',function(){
    console.log('there will be no more data');
});
stream.emit('close');
stream.pipe(fs.createWriteStream('output.txt'));
