var Prefix = '*U*';
var Count = 0;

function preprocess (records) {
    for (let record of records) {
        if (isNeedsPreprocess(record)) {
            record.val = generateValId();
        }
    }
}

function isNeedsPreprocess (record) {
    return record.entryType == 'DELETE' || 
        ((record.entryType == 'WRITE' || record.entryType == 'PUTFIELD') && (record.val == '-2' || record.val == '-3'));
}

function generateValId () {
    Count++;
    return Prefix + Count;
}

module.exports = preprocess;