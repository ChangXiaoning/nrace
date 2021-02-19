var FS_PATTERN = {
    'D': ['D', 'R', 'W', 'O', 'S'],
    'R': ['D', 'W', 'C'],
    'W': ['D', 'R', 'W', 'C'],
    'O': ['D', 'R', 'O', 'C'],
    'C': ['R', 'O', 'C'],
    'S': ['D'],
    //'O': ['O'],
};

var FS_RACE_PATTERNS = {};
FS_RACE_PATTERNS.FS_RACE_$D = function (first, second){
   if(first.entryType == 'D' && second.entryType == 'D'){
        return true;   
   } 
   return false;
}

FS_RACE_PATTERNS.FS_RACE_DR = function (first, second){
    if(first.entryType == 'D' && second.entryType == 'R' || first.entryType == 'R' && second.entryType == 'D'){
         return true;   
    } 
    return false;
}

FS_RACE_PATTERNS.FS_RACE_DW = function (first, second){
    if(first.entryType == 'D' && second.entryType == 'W' || first.entryType == 'W' && second.entryType == 'D'){
         return true;   
    } 
    return false;
}

FS_RACE_PATTERNS.FS_RACE_DO = function (first, second){
    if(first.entryType == 'D' && second.entryType == 'O' || first.entryType == 'O' && second.entryType == 'D'){
         return true;   
    } 
    return false;
}

FS_RACE_PATTERNS.FS_RACE_DS = function (first, second){
    if(first.entryType == 'D' && second.entryType == 'S' || first.entryType == 'S' && second.entryType == 'D'){
         return true;   
    } 
    return false;
}

FS_RACE_PATTERNS.FS_RACE_RW = function (first, second){
    if(first.entryType == 'R' && second.entryType == 'W' || first.entryType == 'W' && second.entryType == 'R'){
         return true;   
    } 
    return false;
}

FS_RACE_PATTERNS.FS_RACE_RC = function (first, second){
    if(first.entryType == 'R' && second.entryType == 'C' || first.entryType == 'C' && second.entryType == 'R'){
         return true;   
    } 
    return false;
}

FS_RACE_PATTERNS.FS_RACE_$W = function (first, second){
    if(first.entryType == 'W' && second.entryType == 'W'){
         return true;   
    } 
    return false;
}

FS_RACE_PATTERNS.FS_RACE_WC = function (first, second){
    if(first.entryType == 'W' && second.entryType == 'C' || first.entryType == 'C' && second.entryType == 'W'){
         return true;   
    } 
    return false;
}

FS_RACE_PATTERNS.FS_RACE_$O = function (first, second){
    if(first.entryType == 'O' && second.entryType == 'O'){
         return true;   
    } 
    return false;
}

FS_RACE_PATTERNS.FS_RACE_OC = function (first, second){
    if(first.entryType == 'O' && second.entryType == 'C' || first.entryType == 'C' && second.entryType == 'O'){
         return true;   
    } 
    return false;
}

FS_RACE_PATTERNS.FS_RACE_$C = function (first, second){
    if(first.entryType == 'C' && second.entryType == 'C'){
         return true;   
    } 
    return false;
}

var VAR_RACE_PATTERNS = {};

VAR_RACE_PATTERNS.VAR_$W = function (first, second){
    if (first.entryType == 'WRITE' && second.entryType == 'WRITE' || first.entryType == 'PUTFIELD' && second.entryType == 'PUTFIELD'){
        return true;
    }
    return false;
}

VAR_RACE_PATTERNS.VAR_WR = function (first, second){
    if (first.entryType == 'WRITE' && second.entryType == 'READ' || first.entryType == 'READ' && second.entryType == 'WRITE'
    || first.entryType == 'PUTFIELD' && second.entryType == 'GETFIELD' || first.entryType == 'GETFIELD' && second.entryType == 'PUTFIELD'){
        return true;
    }
    return false;
}

FP_FILTERS = {};

FP_FILTERS.DECLARED = function (report) {
    let rcd1 = report.tuple[0];
    let rcd2 = report.tuple[1];
    return !rcd1.isDeclaredLocal && !rcd2.isDeclaredLocal;
}

module.exports = {
    //FS_PATTERN: FS_PATTERN,
    FS_RACE_PATTERNS: FS_RACE_PATTERNS,
    VAR_RACE_PATTERNS: VAR_RACE_PATTERNS,
    FP_FILTERS: FP_FILTERS,
}