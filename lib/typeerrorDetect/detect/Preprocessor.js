var Prefix = '*U*';
var Count = 0;

function preprocess (records) {
    for (let record of records) {
        //console.log(record.lineno);
        if (isNeedsPreprocess(record)) {
            record.val = generateValId(record.val);
        }
    }
}

function isNeedsPreprocess (record) {
    if (record.entryType.startsWith('FUNCTION') || record.entryType.startsWith('SCRIPT') || ["CONDITIONAL", "BINARY"].indexOf(record.entryType) > -1)
        return false;
    else if (['W', 'R', 'D', 'O', 'X', 'C', 'S'].indexOf(record.entryType) > -1)
        return false;
    else
        return (record.val.startsWith('*U*') || record.val.startsWith('*U*'));
}

function generateValId (val) {
    Count++;
    return val + Count;
}

module.exports = preprocess;