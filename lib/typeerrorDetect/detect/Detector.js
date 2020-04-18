const fs = require('fs');

class Detector {
    constructor (traceFile) {
        this.traceFile = traceFile;
        let recordFileName = hbFileName.replace('.hb-full.json', '.access-records.json')
        let hbFileName = traceFile.replace('.log', '.hb-full.json');
        this.recordFileName = checkFile(recordFileName)? recordFileName : null;
        this.hbFileName = checkFile(hbFileName)? hbFileName : null;
    }
}

function checkFile (file) {
    if (!fs.existsSync(file))
        //throw 'file does not exist.';
        return false;
    if (!fs.lstatSync(file).isFile())
        //throw 'it is not a file.';
        return false;
    }
    return true;
};

module.exports = Detector;