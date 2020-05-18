const fs = require('fs');

function read(cbinfofile) {
    let cbinfo = JSON.parse(fs.readFileSync(cbinfofile));

    return cbinfo.info;
}

module.exports = {read}