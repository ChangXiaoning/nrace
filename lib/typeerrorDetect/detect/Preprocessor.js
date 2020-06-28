var Prefix = '*U*';
var Count = 0;

function preprocess (records) {
    for (let record of records) {
        if (isNeedsPreprocess(record)) {
            record.val = generateValId(record.val);
        }
    }
}

function isNeedsPreprocess (record) {
    return (record.val.startsWith('*U*') || record.val.startsWith('*U*'));
}

function generateValId (val) {
    Count++;
    return val + Count;
}

module.exports = preprocess;