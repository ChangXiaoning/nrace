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
        ((record.entryType == 'WRITE' || record.entryType == 'PUTFIELD') && (record.val.startsWith('*U*') || record.val.startsWith('*U*')));
}

function generateValId () {
    Count++;
    return Prefix + Count;
}

module.exports = preprocess;