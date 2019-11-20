var AccessType = {};
AccessType[AccessType['DECLARE_OBJ'] = 0] = 'DECLARE_OBJ';
AccessType[AccessType['ASSIGN_OBJ'] = 1] = 'ASSIGN_OBJ';
AccessType[AccessType['USE_OBJ'] = 2] = 'USE_OBJ';
AccessType[AccessType['WRITE_PROP'] = 3] = 'WRITE_PROP';
AccessType[AccessType['READ_PROP'] = 4] = 'READ_PROP';

var entryType2accessType = function (entryTypeName) {
    switch (entryTypeName) {
        case 'DECLARE':
            return AccessType['DECLARE_OBJ'];
        case ''
    }
};

module.exports = {
    AccessType: AccessType,
    entryType2accessType: entryType2accessType
};