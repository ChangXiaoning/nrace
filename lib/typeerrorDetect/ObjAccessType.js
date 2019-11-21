var AccessType = {};
AccessType[AccessType['DECLARE_OBJ'] = 0] = 'DECLARE_OBJ';
AccessType[AccessType['ASSIGN_OBJ'] = 1] = 'ASSIGN_OBJ';
AccessType[AccessType['USE_OBJ'] = 2] = 'USE_OBJ';
AccessType[AccessType['WRITE_PROP'] = 3] = 'WRITE_PROP';
AccessType[AccessType['READ_PROP'] = 4] = 'READ_PROP';
AccessType[AccessType['DELETE_PROP'] = 5] =' DELETE_PROP';
//backup CREATE_OBJ
AccessType[AccessType['CREATE_OBJ'] = 6] = 'CREATE_OBJ';

var entryType2accessType = function (entryTypeName) {
    switch (entryTypeName) {
        case 'DECLARE':
            return AccessType['DECLARE_OBJ'];
        case 'CREATE_OBJ':
            return AccessType['CREATE_OBJ'];
        case 'WRITE':
            return AccessType['ASSIGN_OBJ'];
        case 'READ':
            return AccessType['READ'];
        case 'PUTFIELD':
            return AccessType['WRITE_PROP'];
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