function MultiLayerMap(initMap) {
    if(initMap){
        this.cache = initMap;
    }else{
        this.cache = {};
    }
    this.count = 0;
    this.set = function(path, value) {
        var isSet = false;
        if (!path || path.length == 0)
            return;
        var res = this.get(path.slice(0,-1));
        if(res == MultiLayerMap.NOT_EXIST){
            var res = this.cache;
            for (var i = 0; i < path.length - 1; i++) {
                res[path[i]] = typeof res[path[i]] === 'object' ? res[path[i]] : {};
                res = res[path[i]];
            }
        }else {
            res = res || {};
        } 
        if(typeof res.hasOwnProperty == 'function' && !res.hasOwnProperty(path[path.length-1])){
            this.count++;
            isSet = true;
        }
        res[path[path.length-1]] = value;
        return isSet;
    }
    this.get = function(path) {
        if (!path || path.length == 0)
            return this.cache; 
        var res = this.cache;
        for (var i = 0; i < path.length; i++) {
            if (!res || typeof res.hasOwnProperty != 'function' || !res.hasOwnProperty(path[i])) {
                return MultiLayerMap.NOT_EXIST;
            }
            res = res[path[i]];
        }
        return res;
    }
    this.size = function(){
        return this.count;
    }
    this.delete = function(path) {
        var p = path.slice(0, path.length-1);
        var base = this.get(p);
        if (base!=MultiLayerMap.NOT_EXIST && base){
            delete base[path[path.length - 1]];
        }
    }
    this.clean = function(){
        delete this.cache;
        this.cache = {};
        this.count= 0;
    }
    
    function _keyArray(root, path, depth, res) {
        if (path.length >= depth) {
            res.push(path.slice(0));
            return;
        }
        for (var x in root) {
            path.push(x);
            _keyArray(root[x], path, depth, res);
            path.pop();
        }
    }
    MultiLayerMap.NOT_EXIST = {
        valueOf: function(){
            return undefined;
        }
    };

    this.keyArray = function(depth) {
        var keys = [];
        _keyArray(this.cache, [], depth, keys);
        return keys;
    }

    this.valueArray = function(depth){
        var keys = this.keyArray(depth);
        var res = [];
        for(var i=0; i<keys.length; i++){
            res.push(this.get(keys[i]));
        }
        return res;
    }
}

exports.MultiLayerMap = MultiLayerMap;
