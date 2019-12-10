var AccessType = {};
AccessType[AccessType['DECLARE_OBJ'] = 0] = 'DECLARE_OBJ';
AccessType[AccessType['ASSIGN_OBJ'] = 1] = 'ASSIGN_OBJ';
AccessType[AccessType['USE_OBJ'] = 2] = 'USE_OBJ';
AccessType[AccessType['WRITE_PROP'] = 3] = 'WRITE_PROP';
AccessType[AccessType['READ_PROP'] = 4] = 'READ_PROP';
AccessType[AccessType['DELETE_PROP'] = 5] =' DELETE_PROP';
//backup CREATE_OBJ
AccessType[AccessType['CREATE_OBJ'] = 6] = 'CREATE_OBJ';
AccessType[AccessType['CREATE_FUN'] = 7] = 'CREATE_FUN';

var entryType2accessType = function (entryTypeName) {
    switch (entryTypeName) {
        case 'DECLARE':
            return AccessType['DECLARE_OBJ'];
        case 'CREATE_OBJ':
            return AccessType['CREATE_OBJ'];
        case 'CREATE_FUN':
            return AccessType['CREATE_FUN'];
        case 'WRITE':
            return AccessType['ASSIGN_OBJ'];
        case 'READ':
            /** Model READ operation as USE_OBJ */
            return AccessType['USE_OBJ'];
        case 'PUTFIELD':
            return AccessType['WRITE_PROP'];
            /** 
             * Look at TraceParser:
             * If TraceParser identifies a property deletion by the val of PUTFIELD operation,
             * which is already a record object with WRITE_PROP accessType,
             * TraceParser utilizes WRITE_PROP to search for DELETE_PROP
             */
        case 'WRITE_PROP':
            return AccessType['DELETE_PROP'];
        case 'GETFIELD':
            return AccessType['READ_PROP'];
    }
};

module.exports = {
    AccessType: AccessType,
    entryType2accessType: entryType2accessType
};