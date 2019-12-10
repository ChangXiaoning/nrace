var fs = require('fs'),
    util = require('util');

/**
 * 
 * @param {String|Object} x 
 */
function debugHelper (x) {
    fs.writeSync(1, `${util.format(x)}\n`);
};

/** Print Array */
function print_array(arr){
	for(var key in arr){
		if(typeof(arr[key])=='array'||typeof(arr[key])=='object'){//递归调用  
            print_array(arr[key]);
            debugHelper('============');
		}else{
			fs.writeSync(1, key + ' = ' + arr[key] + '\n');
		}
	}
};

/** Print Object */
function writeObj(obj){
	var description = "";
	for(var i in obj){  
		var property=obj[i];  
		description+=i+" = "+property+"\n"; 
	}  
    fs.writeSync(1, description);
    fs.writeSync(1, '===========');
}

module.exports = {
    debugHelper: debugHelper,
    print_array: print_array,
    writeObj: writeObj
};
