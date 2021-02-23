function Report (ptn, rcd1, rcd2) {
    this.tuple = [rcd1, rcd2];
    this.ptn = ptn;
    this.ref = rcd1.ref;
    this.name = rcd1.name;
    this.iid = rcd1.iid + ' vs. ' + rcd2.iid;
    this.location = rcd1.location + ' vs. ' + rcd2.location;
    this.footprint = rcd1.cbLoc + ' vs. ' + rcd2.cbLoc;
    this.equivalent = [];
    this.id = Report.count++;
}

Report.count = 0;

Report.toString = function (rpt) {
    let result = rpt.footprint + ':' + rpt.ptn + '\n';
    rpt.tuple.forEach(rcd => {
        result += printObj(rcd, ['name', 'entryType', 'event', 'iid', 'location', 'lineno', 'val', 's_symbolic', 'valIsObject', 'cbLoc']);
        result += '\n';
    });
    if (this.benignInfo)
        result += "Benign info: " + printObj(rpt.benignInfo, ["benignPattern", "type"]) + "\n";
    return result;
}

Report.equals = function (rpt, other) {
    if (!other)
        return false;
    if (rpt.footprint == other.footprint)
        return true;
    else {
        let cbLoc11 = rpt.footprint.split(' vs. ')[0];
        let cbLoc12 = rpt.footprint.split(' vs. ')[1];
        let cbLoc21 = other.footprint.split(' vs. ')[0];
        let cbLoc22 = other.footprint.split(' vs. ')[1];
        return cbLoc11 == cbLoc22 && cbLoc12 == cbLoc21;
    }
}

function unique (arr) {
    return Array.from(new Set(arr))
}

function printObj (o, fields) {
    let res = [];
    if (o && fields) {
        fields.forEach(field => {
            if (o.hasOwnProperty(field)) {
                res.push(field + ':' +JSON.stringify(o[field]));
            }
        });
    }
    return '{' + res.join(', ') + '}';
}

module.exports = { Report, printObj };