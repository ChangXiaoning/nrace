var fs = require('fs');
function readFile(file) {
    fs.readFile(file, 'utf8', function(err, contents) {
        if (err) throw new Error(err);
        console.log('read done:', contents);
    });
}

function Non_atomic_write(file) {
    var writer = fs.createWriteStream(file);
    writer.write('write first line of data\n');
    setTimeout(function() {
        writer.write('write second line of data\n');
    }, 30);
}

var datafile = 'data.txt';
if(fs.existsSync(datafile))
    fs.unlinkSync(datafile);

setTimeout(function() {
    Non_atomic_write(datafile);
}, 0)
setTimeout(function() {
    readFile(datafile);
}, 0);
