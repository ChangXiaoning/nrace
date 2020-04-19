const fs = require('fs');

class Detector {
    constructor (traceFile) {
        this.traceFile = traceFile;
        let recordFileName = traceFile.replace('.hb-full.json', '.access-records.json')
        let hbFileName = traceFile.replace('.log', '.hb-full.json');
        this.recordFileName = fs.existsSync(recordFileName) && fs.lstatSync(recordFileName).isFile()? recordFileName : null;
        this.hbFileName = fs.existsSync(hbFileName) && fs.lstatSync(hbFileName).isFile()? hbFileName : null;
        this.reports = [];
    }

    init (results) {
        this.asyncObjects = results.asyncObjects;
        this.records = results.records;
        this.hbGraph = results.hbGraph;

        this.varRcds = this.classifyRecords(this.records.getAll());
    }

    classifyRecords (records) {
        var ret = {};
        records.forEach(rcd => {
            let name = rcd.name;
            ret[name] = ret[name] == undefined? new Array() : ret[name];
            ret[name].push(rcd);
        });
        return ret;
    }

    detect (cb) {
        Object.keys(this.varRcds).forEach(name => {
            let rcds = this.varRcds[name];
            let undefs = rcds.filter(rcd => rcd.entryType == 'WRITE' && rcd.val == undefined);
            let uses = rcds.filter(rcd => rcd.val != undefined);
            undefs.forEach(undef => {
                uses.forEach(use => {
                    if (this.hbGraph.isOpHB(undef, use)) {
                        this.reports.push(new Report(undef, use));
                    }
                })
            })
        });
        cb(this.reports);
    }
}

class Report {
    constructor (undef, use) {
        this.tuple = [undef, use];
        this.name = undef.name;
        this.ptn = undef.entryType + ' vs. ' + use.entryType;
        this.iid = undef.iid + ' vs. ' + use.iid;
        this.location = undef.location + ' vs. ' + use.location;
        this.footprint = undef.e + ' vs. ' + use.e;
        //TODO: cbLoc
    }

    toString () {
        let res = this.footprint + ':' + this.ptn + '\n';
        res += this.tuple.join('\n');
        return res;
    }
}

module.exports = Detector;