(function() {
    //no read/write between before and after the execution of a callback
    //map each variable to the count of callbacks access it: remove the variables that has a count < 3
    //output (variable, callback  pairs) and happen-before graph
    var logger = require('./logger.js').logger;
    var LogEntryType = require('./LogEntryType.js');
    var lineReader = require('line-reader');
    var MultiLayerMap = require('./MultiLayerMap.js').MultiLayerMap;
    var iidToLocation = require('./jalangi2/src/js/runtime/iidToLocation.js');


    var VarAccessTypes = {
        'WRITE': 'W',
        'PUTFIELD': 'W',
        'READ': 'R',
        'GETFIELD': 'R'

    }
    var FileAccessTypes = {
        'FS_WRITE': 'W',
        'FS_READ': 'R',
        'FS_DELETE': 'D',
        'FS_OPEN': 'O',
        'FS_CLOSE': 'X',
        'FS_CREATE': 'C',
        'FS_STAT': 'S'
    }

    function TraceParser() {}
    TraceParser.prototype.parse = function(trace, cb) {
        logger.info('Begin parsing trace', (typeof trace=='string' && trace.endsWith('.log')) ? trace : '');

        this.trace = trace;
        this.dataAccessManager = new DataAccessRecordManager();
        this.happenBeforeGraph = new HappenBeforeGraph();
        this.time_parse_begin = new Date().getTime();
        var record, lineno = 0,
            that = this;
        var pendingAsyncIds = {};
        var sourceMap = {};
        var declareMap = {};
        var currentSourceFile;
        var currentFun;
        var all = {};
	//var numberOfEvents=0;


        var funCtx = {
            counts:[],
            vars:{0:{}},
            stack:[0],
            enter:function(iid){
                this.counts [iid] = this.counts[iid] || 0;
                this.counts [iid] = this.counts [iid]+1;
                this.stack.push(iid);
                this.vars[this.getId()] = this.vars[this.getId()] || {};
            },
            declare:function(name){
                if(!this.vars[this.getId()])
                    return;
                if(typeof name == 'string'){
                    this.vars[this.getId()][name] = true;
                }
            },
            isDeclaredLocal:function(name){
                if(!this.vars[this.getId()])
                    return false;
                return this.vars[this.getId()].hasOwnProperty(name);
            },
            top: function(){
                return this.stack[this.stack.length-1];
            },
            getId: function(){
                return this.top()+'-'+this.counts[this.top()];
            },
            exit:function(){
                this.stack.pop();
            }
        }
        var cbCtx = {
            stack:[],
            cbs: {}, //use the source location of the first record during the execution of a callback as the location of the callback
            curCtx:{},
            top:function(){
                return this.stack[this.stack.length-1];
            },
            enter:function(eid){
                this.stack.push(eid);
                this.curCtx[eid] = {};
                this.curCtx[eid].vars = new MultiLayerMap();
                this.curCtx[eid].rcds = [];
            },
            exit:function(){
                if(!this.curCtx[this.top()])
                    return;
                var shouldIgnored = this.curCtx[this.top()].vars.valueArray(4);
                for(var i=0; i<shouldIgnored.length;i++){
                    shouldIgnored[i].ignore = false;
                }
                var rcds = this.curCtx[this.top()].rcds;
                for(var i=0;i<rcds.length;i++){
                    if(rcds[i].ignore == false)
                        that.dataAccessManager.add(rcds[i]);
                }
                delete this.curCtx[this.top()];
                this.stack.pop();
            },
            exitAll:function(){
                while(this.stack.length>0){
                    this.exit();
                }
            },
            getRemainingRcds: function(){
                for(var remaining in this.curCtx){
                    var rcds = this.curCtx[remaining].rcds;
                    for(var i=0; i<rcds.length; i++){
                        if(rcds[i].ignore == false)
                            that.dataAccessManager.add(rcds[i]);
                    }
                }
            },
            access:function(rcd){
                if(!rcd || !rcd.etp)
                    return;
               
                if(!this.cbs.hasOwnProperty(rcd.eid)){ 
                    this.cbs[rcd.eid] = rcd.location;
                }
                this.curCtx[this.top()].rcds.push(rcd);
                if(this.curCtx[this.top()].vars.get(['min', rcd.ref, rcd.name, rcd.accessType]) == MultiLayerMap.NOT_EXIST){
                    this.curCtx[this.top()].vars.set(['min',rcd.ref,rcd.name, rcd.accessType], rcd);
                }
                this.curCtx[this.top()].vars.set(['max', rcd.ref, rcd.name, rcd.accessType], rcd);
            },
            getCbId:function(rcd){
                if(rcd && this.cbs.hasOwnProperty(rcd.eid))
                    return this.cbs[rcd.eid];
            }
        }
        function processLine(line, last) {
            lineno++;
            record = undefined;
            if (line) {
                var item = line.split(',');
                var itemEntryType = item[0];
                if(typeof itemEntryType!='number'){
                    itemEntryTyp = Number.parseInt(itemEntryType);
                }
                if(!LogEntryType.hasOwnProperty(itemEntryType)){
                    return;
                }
                var itemEntryTypeName = LogEntryType[itemEntryType];
                if (VarAccessTypes.hasOwnProperty(itemEntryTypeName)){
                    record = new DataAccessRecord(lineno, itemEntryTypeName, VarAccessTypes[itemEntryTypeName], item[2], item[3], cbCtx.top(), item[1]);
                } else if(FileAccessTypes.hasOwnProperty(itemEntryTypeName)){
                    record = new FileAccessRecord(lineno, itemEntryTypeName, FileAccessTypes[itemEntryTypeName], item[1], item[2], item[3],cbCtx.top(), item[4], item[5]);
                }else if (itemEntryType == LogEntryType['ASYNC_INIT']) {
                    record = new HappenBeforeRecord(lineno, item[1], item[3], HappenBeforeRecord.CAUSAL_TYPE.REGISTEREDBY, item[2]);
                    that.happenBeforeGraph.add(record);
                } else if (itemEntryType == LogEntryType['ASYNC_BEFORE']) {
                    cbCtx.enter(item[1]);
                    pendingAsyncIds[cbCtx.top()] = true;
		    //numberOfEvents++;
                } else if (itemEntryType == LogEntryType['ASYNC_AFTER']) {
                    cbCtx.exit();
                    
                    delete pendingAsyncIds[item[1]];
                } else if (itemEntryType == LogEntryType['ASYNC_PROMISERESOLVE']) {
                    record = new HappenBeforeRecord(lineno, item[1], item[2], HappenBeforeRecord.CAUSAL_TYPE.RESOLVEDBY, 'resolve');
                    that.happenBeforeGraph.add(record);
                } else if (itemEntryType == LogEntryType['SCRIPT_ENTER']) {
                    currentSourceFile = item[3];
                } else if (itemEntryType == LogEntryType['SOURCE_MAPPING']) {
                    var arr = [currentSourceFile];
                    Array.prototype.push.apply(arr, item.slice(2, 6));
                    sourceMap[item[1]] = arr;
                } else if (itemEntryType == LogEntryType['DECLARE']){
                    funCtx.declare(item[3]);
                } else if(itemEntryType == LogEntryType['FUNCTION_ENTER']){
                    funCtx.enter(item[1]);
                } else if(itemEntryType == LogEntryType['FUNCTION_EXIT']){
                    funCtx.exit();
                }
            }

            if (typeof record == 'object'){
                all[lineno] = record;
                
                if (record instanceof DataAccessRecord || record instanceof FileAccessRecord) {
                    var arr = sourceMap[record.iid];
                    if (arr){
                        record.location = arr.join('#');
                    }
                    if (funCtx.isDeclaredLocal(record.name)){
                        record.isDeclaredLocal = true;   
                    }
                    var ctx = that.happenBeforeGraph.records[record.eid];
                    ctx? record.etp=ctx.resourceType : null;
                    cbCtx.access(record);
                    record.cbLoc = cbCtx.getCbId(record);
                    
                    //that.dataAccessManager.add(record);
               }
            }
            if (last) {
                try {
                    cbCtx.exitAll();
                    that.result = {};
                    that.result.all = all;
                    that.result.graph = that.happenBeforeGraph.ready();
                    that.result.manager = that.dataAccessManager.ready();
                    that.result.pendingAsyncIds = pendingAsyncIds;
                    //that.persist();
                    that.time_parse = (that.time_parse||0) + (new Date().getTime() - that.time_parse_begin)/1000.0;
		    //that.result.numberOfEvents=numberOfEvents;
		    //logger.info('There are '+numberOfEvents+' events in total\n');
                    logger.info('End parsing trace');
                    cb(that.result);
                } catch (e) {
                    logger.error(e);
                    throw e;
                }
            }
        }
        try{
            if(typeof trace == 'string'){
                if (!trace.endsWith('.log')) {
                    var lines = trace.split('\n');
                    for (var i = 0; i < lines.length; i++) {
                        processLine(lines[i], i == lines.length - 1);
                    }
                } else {
                    lineReader.eachLine(trace, processLine)
                }
            }else if(typeof trace == 'object'){
                that.time_parse = (that.time_parse ||0)+(new Date().getTime() - that.time_parse_begin)/1000.0;
                logger.info('Trace is already parsed');
                that.result = trace;
                cb(that.result);
            }
        }catch(e){
            logger.error(e);
            throw e;
        }
    }

    function DataAccessRecord(lineno, entryType, accessType, ref, name, eid, iid) {
        this.lineno = lineno
        this.logEntryType = entryType;
        this.accessType = accessType;
        this.ref = ref;
        this.name = name;
        this.eid = eid;
        this.iid = iid;
    }
    DataAccessRecord.prototype.toString = function() {
        return printObj(this, ['lineno','location', 'cbLoc',  'iid', 'accessType', 'logEntryType', 'ref', 'name', 'eid', 'etp']);
    }

    function printObj(obj, listOfFeilds) {
        var res = [];
        if (obj && listOfFeilds) {
            for (var i = 0; i < listOfFeilds.length; i++) {
                var v = obj[listOfFeilds[i]];
                if(obj.hasOwnProperty(listOfFeilds[i]))
                    res.push(listOfFeilds[i] + ':' + JSON.stringify(obj[listOfFeilds[i]]));
            }
        }
        return '{' + res.join(', ') + '}';
    }
    function FileAccessRecord(lineno, entryType, accessType, resource, ref, name, eid, cid,location){
        this.lineno = lineno;
        this.logEntryType = entryType;
        this.accessType =  accessType;
        this.resource = resource;
        this.ref = ref;
        this.name = name;
        this.eid = eid;
        if(cid && cid>0)
            this.cid = cid;
        this.location = location;
    }

    FileAccessRecord.prototype.toString = function(){
        return printObj(this, ['lineno','accessType', 'logEntryType', 'resource', 'ref', 'name', 'eid','cid', 'etp']);
    }

    TraceParser.prototype.stringOfRecords = function(collection) {
        if (collection instanceof Array) {
            return this.collection.join('\n');
        } else {
            return new MultiLayerMap(collection).valueArray(1).join('\n');
        }
    }

    function VariableIndexing() {
        this.variables = new MultiLayerMap();

    }
    VariableIndexing.prototype.addDataAccess = function(key, value) {
        var list = this.variables.get(key);
        if (list == MultiLayerMap.NOT_EXIST) {
            list = [];
        }
        try {
            list.push(value);
        } catch (e) {
            logger.error(e);
        }
        this.variables.set(key, list);
    }
    VariableIndexing.prototype.getDataAccess = function(key) {
        this.variables.get(key);
    }

    VariableIndexing.prototype.filterOut = function(filterOutFun) {
        if (filterOutFun && typeof filterOutFun == 'function') {
            var keys = this.keys();
            var count = 0;
            logger.info('Begin cleaning data access records: Deleting a variable access information if it is accessed less than 3 times');
            for (var i = 0; i < keys.length; i++) {
                var _var = this.variables.get(keys[i]);
                if (_var != MultiLayerMap.NOT_EXIST && filterOutFun(_var, keys[i])) {
                    logger.debug('remove access to variable ', keys[i]);
                    this.variables.delete(keys[i]);
                    count++;
                }
            }
            logger.info('End cleaning data access records:', count + ' records are removed.');
        }
    }

    VariableIndexing.prototype.keys = function() {
        return this.variables.keyArray(2);
    }

    function DataAccessRecordManager() {
        this.varIndexing = new VariableIndexing();
        this.records = {};
        this.size = 0;
    }

    DataAccessRecordManager.prototype.add = function(rcd) {
        var key;
        if (rcd instanceof DataAccessRecord){
            key = [rcd.ref, rcd.name];
        }else if(rcd instanceof FileAccessRecord){
            key = ['file', rcd.resource];
        }else{
            return this;
        }
        this.size++;
        this.varIndexing.addDataAccess(key, rcd);
        this.records[rcd.lineno] = rcd;
        return this;
    }

    DataAccessRecordManager.prototype.isAccessedBySameCallback = function(id1, id2) {
        return this.records[id1].eid == this.records[id2].eid;
    }

    /*Should not do the 'filterOut' any more, that may introduce trouble for debugging.*/
    DataAccessRecordManager.prototype.ready = function() {
        if (false) {
            //@jie do nothing if it is in debug mode.
            return this;
        } else {
            this.varIndexing.filterOut(function(listOfRecords, key) {
                if (!listOfRecords){
		    return true;
		}
                if(listOfRecords.length < 3){
                    return true;
                }
                var oneW;
                var etps = {};
                var res = [];
                for(var i=0; i<listOfRecords.length; i++){
                    if(listOfRecords[i].accessType == 'W' || listOfRecords[i].accessType == 'C' || listOfRecords[i].accessType == 'D'){
                        oneW = listOfRecords[i];
                        break;
                    }
                }
                if(!oneW){
			return true;
		}
                for(var i=0; i<listOfRecords.length; i++){
                    etps[listOfRecords[i].etp] = (etps[listOfRecords[i].etp]||0)+1;
                    if(etps[listOfRecords[i].etp] <=10)
                        res.push(listOfRecords[i]);
                }
                if(res.indexOf(oneW)<0)
                    res.push(oneW);
                listOfRecords.splice(0, listOfRecords.length);
                Array.prototype.push.apply(listOfRecords,res);
            });
            return this;
        }
    }

    var ResourcePriority = {
        /*
        FSEVENTWRAP, FSREQWRAP, GETADDRINFOREQWRAP, GETNAMEINFOREQWRAP, HTTPPARSER,
        JSSTREAM, PIPECONNECTWRAP, PIPEWRAP, PROCESSWRAP, QUERYWRAP, SHUTDOWNWRAP,
        SIGNALWRAP, STATWATCHER, TCPCONNECTWRAP, TCPWRAP, TIMERWRAP, TTYWRAP,
        UDPSENDWRAP, UDPWRAP, WRITEWRAP, ZLIB, SSLCONNECTION, PBKDF2REQUEST,
        RANDOMBYTESREQUEST, TLSWRAP, Timeout, Immediate, TickObject      
        */
        TickObject: 1,
        Timeout: 2,
        Immediate: 2,
        Other: 3
    }
    ResourcePriority.getPriority = function(resourceType) {
        if (ResourcePriority.hasOwnProperty(resourceType)) {
            return ResourcePriority[resourceType];
        } else
            return ResourcePriority['Other'];

    }

    function HappenBeforeRecord(lineno, asyncId, prior, causal_type, resourceType) {
        this.lineno = lineno;
        this.asyncId = asyncId;
        this.links = {};
        if (prior != undefined)
            this.link(prior, causal_type);
        if (resourceType != undefined) {
            this.resourceType = resourceType;
            this.priority = ResourcePriority.getPriority(resourceType);
        }
    }
    HappenBeforeRecord.linksCount = {}

    HappenBeforeRecord.prototype.link = function(prior, causal_type) {
        this.links[causal_type] = this.links[causal_type] || [];
        if (this.links[causal_type].indexOf(prior) < 0){
            this.links[causal_type].push(prior);
            HappenBeforeRecord.linksCount[this.asyncId] = HappenBeforeRecord.linksCount[this.asyncId] || {}
            HappenBeforeRecord.linksCount[this.asyncId].out_edges = (HappenBeforeRecord.linksCount[this.asyncId].out_edges ||0)+1;
            HappenBeforeRecord.linksCount[prior] = HappenBeforeRecord.linksCount[prior] || {};
            HappenBeforeRecord.linksCount[prior].in_edges = (HappenBeforeRecord.linksCount[prior].in_edges||0)+1;
        }
    };
    HappenBeforeRecord.prototype.toString = function() {
        return printObj(this, ['lineno', 'asyncId', 'links', 'resourceType', 'priority']);
    }

    HappenBeforeRecord.isEmptyRecord = function(rcd) {
        return rcd.lineno < 0 && rcd.asyncId < 0;
    }


    HappenBeforeRecord.CAUSAL_TYPE = {
        REGISTEREDBY: 1,
        RESOLVEDBY: 2,
        INFERIOR: 3
    }

    var leafRecord = -1;
    var emptyRecordUUId = -2;
    HappenBeforeRecord.emptyRecord = function() {
        return new HappenBeforeRecord(emptyRecordUUId--, emptyRecordUUId--);
    }

    function HappenBeforeGraph() {
        this.registeringCount = {};
        this.resolvedByMap = {};
        this.groupbyPriority = new MultiLayerMap();
        this.callbackChainEntries;
        this.records = {};
        this._hbCache = new MultiLayerMap();
    }

    HappenBeforeGraph.prototype.add = function(rcd) {
        if (!rcd instanceof HappenBeforeRecord)
            return;
        if (rcd.links.hasOwnProperty(HappenBeforeRecord.CAUSAL_TYPE.REGISTEREDBY)) {
            this.records[rcd.asyncId] = rcd;
            var prior = rcd.links[HappenBeforeRecord.CAUSAL_TYPE.REGISTEREDBY][0];
            this.registeringCount[prior] = (this.registeringCount[prior] || 0) + 1;
            var list = this.groupbyPriority.get([prior, rcd.priority]);
            if (list == MultiLayerMap.NOT_EXIST)
                list = [];
            if (list.indexOf(rcd.asyncId) < 0)
                list.push(rcd.asyncId);
            this.groupbyPriority.set([prior, rcd.priority], list);
        } else if (rcd.links.hasOwnProperty(HappenBeforeRecord.CAUSAL_TYPE.RESOLVEDBY)) {
            this.resolvedByMap[rcd.asyncId] = rcd.links[HappenBeforeRecord.CAUSAL_TYPE.RESOLVEDBY][0];
        }
    }
    HappenBeforeGraph.prototype.setLoc = function(aid, loc){
        if(this.records[aid]){
            this.records[aid].location = loc;
        }
    }
    //check if it is reachabe from asyncid1 to asyncid2
    //we impliment it by recursion because we also want to get a path for asyncid1 to asyncid2
    function _reachable(records, asyncid1, asyncid2, path, visited, filterLinkType) {
        path.push(asyncid1);
        visited[asyncid1] = true;

        if (asyncid1 == asyncid2)
            return true;

        var next = [];
        if (records.hasOwnProperty(asyncid1)) {
            var rcd = records[asyncid1];
            for (var causal_type in rcd.links) {
                if(filterLinkType && typeof filterLinkType == 'function' && !filterLinkType(causal_type))
                    continue;
                Array.prototype.push.apply(next, rcd.links[causal_type]);
            }
            for (var i = 0; i < next.length; i++) {
                if (!visited.hasOwnProperty(next[i])) {
                    if (_reachable(records, next[i], asyncid2, path, visited))
                        return true;
                }
            }
        }
        path.pop();
        return false;
    }
    
    function _reachable_new(records, asyncid1, asyncid2, path, filterLinkType) {
        function getOnePath(pathMap, start, end, path ){ //start never equals end
            var aid = start;
            while(pathMap.hasOwnProperty(aid)){
                path.push(aid);
                aid = pathMap[aid];
                if(aid == end){
                    path.push(aid);
                    return path; // a path is found
                }
            }
            return path; //no path found
        }
        if(asyncid1 == asyncid2){
            path.push(asyncid1);
            return true;
        }
        
        var queue = [asyncid1];
        var visited = {};
        var pathMap = {};
        var _count;
        while (queue.length>0){
            var curAsyncId = queue.shift();
            _count++;
            if(_count>10)
                return false;
            visited[curAsyncId] = true;
            if (records.hasOwnProperty(curAsyncId)) {
                var rcd = records[curAsyncId];
                var next = [];
                for (var causal_type in rcd.links) {
                    if(filterLinkType && typeof filterLinkType == 'function' && !filterLinkType(causal_type))
                        continue;
                    Array.prototype.push.apply(next, rcd.links[causal_type]);
                }
                for(var i=0; i<next.length;i++){
                    var aid = next[i];
                    if(!pathMap.hasOwnProperty(aid))
                        pathMap[aid] = curAsyncId;
                    if(aid == asyncid2){
                        getOnePath(pathMap, asyncid2, asyncid1, path);
                        return true;
                    }
                    if(!visited[aid]){
                        queue.push(aid);
                    }
                }
            }
        }
        return false;
    }

    /**
     * happenBefore: return if rcd1 happens before rcd2
     *
     * @param rcd1: data access record
     * @param rcd2: data access record
     * @param path: optional, if rcd1 happens before rcd2, path is an array of asyncId that from rcd2 to rcd1
     * @returns {undefined}
     */
    HappenBeforeGraph.prototype.happenBefore = function(rcd1, rcd2) {
        var eid1 = rcd1.cid? rcd1.cid:rcd1.eid, eid2 = rcd2.eid;
        var _hb = this._hbCache.get([eid1, eid2]);
        if (_hb == MultiLayerMap.NOT_EXIST) {
            var path = [];
            _hb = _reachable_new(this.records, eid2, eid1, path, {});
            this._hbCache.set([eid1, eid2], [_hb, path]);
            logger.debug('check if asyncid "' + eid1 + '" happen before "' + eid2 + '":', _hb, _hb ? ', chain:' + path.join(' -> ') : '');
            return _hb;
        }
        logger.debug('check if asyncid "' + eid1 + '" happen before "' + eid2 + '":', _hb[0], _hb[0] ? ', chain:' + _hb[1].reverse().join(' -> ') : '');
        return _hb[0];
    };
    HappenBeforeGraph.prototype.getPath = function(rcd1, rcd2){
        this.happenBefore(rcd1, rcd2);
        return this._hbCache.get([rcd1.cid?rcd1.cid:rcd1.eid, rcd2.eid]); 
    };
    HappenBeforeGraph.prototype.ordered = function(rcd1, rcd2) {
        var ol = rcd1.lineno < rcd2.lineno ? [rcd1, rcd2] : [rcd2, rcd1];

        if (this.happenBefore(ol[0], ol[1])) {
            return ol;
        }
        if (this.happenBefore(ol[1], ol[0])) {
            return ol.reverse();
        }
        return false;
    }

    HappenBeforeGraph.prototype.printRecords = function() {
        var res = '';
        for (var asyncId in this.records) {
            var rcd = this.records[asyncId];
            res += 'lineno:' + rcd.lineno + ', asyncId: ' + asyncId + ', resourceType:' + rcd.resourceType + ',';

            for (var i in rcd.links) {
                res += ' links[' + i + ']:' + rcd.links[i] + ',';
            }
            res += ' priority: ' + rcd.priority;
            res += '\n';

        }
        console.log(res);
    }


    HappenBeforeGraph.prototype.ready = function() {
        //find callback chain entries acording to registration relationship
        
        logger.info('start to build happen before graph...');
        logger.debug('add resolved links according to resolvedby relation');
        for (var asyncId in this.resolvedByMap) {
            if (this.records.hasOwnProperty(asyncId))
                this.records[asyncId].link(this.resolvedByMap[asyncId], HappenBeforeRecord.CAUSAL_TYPE.RESOLVEDBY);
        }

        logger.debug('sort sibling events accordting to event loop priority order...');
        var toSort = {};
        var toSort_head = {};
        var keys = this.groupbyPriority.keyArray(1);
        for (var it = 0; it < keys.length; it++) {
            logger.debug('loop: ' + it + '. the children with same priority are put into the same list');
            var toSort = this.groupbyPriority.get(keys[it])
            for (var priority in toSort) {
                var list = toSort[priority];
                if (list && list.length > 0) {
                    for (var i = 0; i < list.length - 1; i++) {
                        for (var j = i + 1; j < list.length; j++) {
                            var rcd1 = this.records[list[i]];
                            var rcd2 = this.records[list[j]];
                            //if rcd1 and rcd2 have the same resourceType and they are process.nextick or promise, 
                            //then they are ordered by their rigstering order
                            if (rcd1.resourceType == rcd2.resourceType && rcd1.priority <= 1) {
                                if (rcd1.lineno < rcd2.lineno) {
                                    rcd2.link(rcd1.asyncId, HappenBeforeRecord.CAUSAL_TYPE.INFERIOR);
                                } else if (rcd1.lineno > rcd2.lineno) {
                                    rcd1.link(rcd2.asyncId, HappenBeforeRecord.CAUSAL_TYPE.INFERIOR);
                                }
                            }

                        }
                    }

                }
            }

            logger.debug('sort siblings accross different priorities');
            var priorEmptyRcd = HappenBeforeRecord.emptyRecord();
            this.records[priorEmptyRcd.asyncId] = priorEmptyRcd;
            for (var priority in toSort) {
                var list = toSort[priority];
                var nextEmptyRcd = HappenBeforeRecord.emptyRecord();
                this.records[nextEmptyRcd.asyncId] = nextEmptyRcd;
                if (list && list.length > 0) {
                    for (var i = 0; i < list.length; i++) {
                        var rcd = this.records[list[i]];
                        nextEmptyRcd.link(rcd.asyncId, HappenBeforeRecord.CAUSAL_TYPE.INFERIOR);
                        rcd.link(priorEmptyRcd.asyncId, HappenBeforeRecord.CAUSAL_TYPE.INFERIOR);
                    }
                }
                priorEmptyRcd = nextEmptyRcd;
            }
        }
        /*
        console.log('----links count', HappenBeforeRecord.linksCount);
        var entries = new Set();
        for(var aid in HappenBeforeRecord.linksCount){
            var edge = HappenBeforeRecord.linksCount[aid];
            if(!edge.in_edges){
                entries.add(aid);
            }
        } 
        
        //calculate all paths for the records in entries
        
        this.walkPaths(entries, function(entry, path){
            console.log('----------all path:'); 
        })
        */
        return this;
    }
    HappenBeforeGraph.prototype.walkPaths = function(entries, eachPath){
        console.log(entries);
        entries.forEach(function(k){
            console.log('---get path start from v:',k);
        }) 
    }
    HappenBeforeGraph.prototype._precedingsOf = function(eid) {
        
    }
    HappenBeforeGraph.prototype.precedingsOf = function(eid) {
        return this._precedingsOf(eid);
    }
    //TODO: @jie, the implimentatioon of subgraph is not correct any more since the function _reachable is changed
    HappenBeforeGraph.prototype.subgraph = function(rcds) {
        var eid, res = [];
        var _visited = {};
        
        for(var i=0; i<rcds.length; i++){
            eid = rcds[i].eid;
            if(!res.hasOwnProperty(eid) && !_visited[eid]){
                _reachable(this.records, eid, leafRecord, [], _visited);
            }
        }
        for(var i in _visited){
            res.push(this.records[i]);
        }
        return res;
    }
    
    HappenBeforeGraph.prototype.toString = function() {
        return 'this is a happen before graph';
    }

    exports.TraceParser = TraceParser;

    //The following data structure are exported for testing:
    //exports.HappenBeforeRecord = HappenBeforeRecord;
    //exports.VariableIndexing = VariableIndexing;
    exports.DataAccessRecord = DataAccessRecord;
    exports.FileAccessRecord = FileAccessRecord;
    exports.DataAccessRecordManager = DataAccessRecordManager;
})()
