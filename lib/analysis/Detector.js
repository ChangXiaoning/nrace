var TraceParser = require('./TraceParser.js').TraceParser;
var DataAccessRecord = require('./TraceParser.js').DataAccessRecord;
var FileAccessRecord = require('./TraceParser.js').FileAccessRecord;
var logger = require('./logger.js').logger;
var MultiLayerMap = require('./MultiLayerMap.js').MultiLayerMap;

function AVDetector(traceParser){
    this.varRecordFilter = defaultVarRecordFilter;
    this.fileRecordFilter = defaultFileRecordFilter;
    
    this.variableAtomicityViolationPatterns = VAR_AV_PATTERNS; 
    this.fileAtomicityViolationPatterns = FS_AV_PATTERNS; 
    if(traceParser)
        this.parser = traceParser;
}

function _simpleCheck(triple){
    if(!triple || triple.length<3){
        return false;
    }
    return true;
}
function _getTripleIids(triple){
    return [triple[0].location||triple[0].iid, triple[1].location||triple[1].iid, triple[2].location||triple[2].iid];
}
function _copyConflicts(pair, which){
    var triple = pair.slice(0);
    triple.push(pair[which]);
    var key = _getTripleIids(triple);
    key[2]= key[2]+'_cp'+which;
    return [key, triple];
}

AVDetector.prototype.certainTimePassed = function(){
    if(!this._time_tmp){
        this._time_tmp = this.time_detect_begin;
        return false;
    }else if((new Date().getTime()-this._time_tmp)/1000.0>20){
        this._time_tmp = new Date().getTime();
        return true;
    }
    return false;
}
/**
 * prepareInput: returns triples of data accesses, so that we can check atomicity violations that happen between 3 callbacks.
 * 
 * @param varIndexings: a map in format of (variable pointer -> variable access record)
 * @param graph:
 * @param filters:
 * @param patterns:
 * @returns triples: returns an array of triples. A triple stores 3 records that access to the same variable, happens in differrent callbacks, and triple[0] and triple[1] are succesively accessed.
 */
AVDetector.prototype.prepareInput = function(varIndexings, graph, filters, patterns){
    var triples = new MultiLayerMap();
    var keys = varIndexings.keys();    
    var v1, v2, v3, list, i, j, k, h, res, redeclared, x, y, filter;
    
    logger.info('Preparing tripples for detecting AV bugs...');
    logger.debug(keys.length+' vars need to be taken care of...');
    
    //FP policy-1: the data access pairs should be successive
    //FP policy-2: the data should be declared at most once in a triple
    printMemoryUsage();
    for(i=0; i<keys.length; i++){
        list = varIndexings.variables.get(keys[i]);
        logger.debug('Process [ i:0/'+keys.length+', j:0/'+list.length+', k:0/'+list.length+', h:0/'+list.length+', time elapsed:'+(new Date().getTime()-this.time_detect_begin)/1000.0+'s ]');
        logger.debug('['+i+'] start to prepare for var:'+ keys[i],', len:', list.length);
        redeclared = 0;
        for(j=0; j<list.length-1; j++){
           //console.log('----var:', keys[i], list[j]);
           //continue;
           if(!this._isSuccessive(list[j], undefined, varIndexings, graph))
               continue;
           redeclared = redeclared + (list[j].isDeclaredLocal?1:0);
           for(k=j+1; k<list.length; k++){
               v1 = list[j];
               v2 = list[k];
               if(v1.etp == 'TickObject' && v2.etp == 'TickObject')
                   continue;
               redeclared = redeclared + (list[k].isDeclaredLocal?1:0);
               if(redeclared>=2)
                   continue;
               if(!this._isSuccessive(list[j], list[k], varIndexings, graph))
                   continue;
               if(v1.eid == v2.eid)
                   continue;
               res = graph.ordered(v1, v2, true);
               if(res){
                   for(h=0; h<list.length; h++){
                        
                        if(this.certainTimePassed()){
                            logger.debug('Process [ i:'+i+'/'+keys.length+', j:'+j+'/'+list.length+', k:'+k+'/'+list.length+', h:'+h+'/'+list.length+', time elapsed:'+(new Date().getTime()-this.time_detect_begin)/1000.0+'s ]', v1.toString(), v2.toString());
                            printMemoryUsage();
                        }
                       if(list[h].eid == v1.eid || list[h].eid == v2.eid)
                           continue;
                       redeclared = redeclared + (list[h].isDeclaredLocal?1:0);
                       if(redeclared>=2)
                           continue;
                       if(!this._isSuccessive(list[j], list[h], varIndexings, graph) 
                           || !this._isSuccessive(list[h], list[k], varIndexings, graph))
                           continue;
                       for(x=0; x<filters.length; x++){
                           filter = filters[x];
                           if(filter(keys[i], list[j]) && filter(keys[i], list[k]) && filter(keys[i], list[h])){
                           
                               if(!graph.ordered(v1, list[h]) || !graph.ordered(v2, list[h])){
                                    var triple = res.slice(0);
                                    triple.push(list[h]);
                                    var __tripleIids = _getTripleIids(triple);
                                    if(_simpleCheck(triple)){
                                        if(!triples.set(__tripleIids, triple))
                                            continue;
                                        //clean triples to save memory
                                        if(triples.size()>=10000){
                                            triples.clean();
                                        }

                                        //check timeout and return;
                                        if(this.timeLimit && new Date().getTime() - this.time_detect_begin >= this.timeLimit * 1000){
                                             logger.info('Time is out! should be finished in '+this.timeLimit+' seconds!');
                                             return;
                                        }
                                        
                                        //console.log('set value:', [triple[0].eid, triple[1].eid, triple[2].eid], triple.length);
                                        logger.debug('add triple:', __tripleIids);
                                        var _patternMap = patterns[x];
                                        for(y in _patternMap){
                                            if(_patternMap[y].apply(null,triple)){
                                                var report = new AVReport(y, triple);
                                                this.reports.push(report);
                                                logger.info('find an AV bug:', report.toString());
                                                break;
                                            }
                                           
                                        }
                                    }
                                }
                           }

                       }
                       
                  }
                   /* [TODO] for server request, we may suppose a request being executed twice and concurrently,
                    * in this case, we may add the folloing two posible conflicts.
                   var conflict = _copyConflicts(res, 0);
                   triples.set(conflict[0], conflict[1]);
                   conflict = _copyConflicts(res, 1); 
                   triples.set(conflict[0], conflict[1]);
                   */
               }
               
           }
        }
    } 
}
function printMemoryUsage(){
    var info = process.memoryUsage();
    logger.info('Memory usage {rss: '+(info.rss>>=20)+'MB, heapTotal: '+(info.heapTotal>>=20)+'MB, heapUsed: '+(info.heapUsed>>=20)+'MB}');
}
var defaultVarRecordFilter = function(key, record){
    if(record instanceof DataAccessRecord){
        return true;
    }
    return false;
}
var defaultFileRecordFilter = function(key, record){
    if(record instanceof FileAccessRecord){
        return true;
    }
    return false;
}
AVDetector.prototype.detect = function (trace, timeLimit, done){
    //logger.info('trace.numberOfEvent is: '+trace.numberOfEvents);
    function onParsed(that, trace, done){
        that.prepareInput(trace.manager.varIndexing, trace.graph, [that.varRecordFilter,that.fileRecordFilter], [that.variableAtomicityViolationPatterns, that.fileAtomicityViolationPatterns]);
        that.reports = that.filterOutFalsePositives(trace);
        if(typeof done == 'function')
            done(that.reports);
    }
    var that = this;
    if(timeLimit){
        this.timeLimit = timeLimit;
    }

    this.time_detect_begin = new Date().getTime();
    this.reports = [];
    this._ssCache = new MultiLayerMap();
    that._time = {};
    this.numberOfEvents=trace.numberOfEvents;
    if(!this.parser)
        this.parser = new TraceParser();
    this.parser.parse(trace, function(res){
        onParsed(that, res, done);
        that.time_detect = (that.time_detect||0) + (new Date().getTime() - that.time_detect_begin) / 1000.0;
        that.timeLimit = undefined;
        that.printReports();
    });
}

function AVReport(ptn, triple){
    this.pattern = ptn;
    this.footprint = triple[0].cbLoc +'->'+triple[1].cbLoc +'|' + triple[2].cbLoc;
    //this.footprint = ptn +':'+ triple[0].eid+ '->'+ triple[1].eid+'|'+triple[2].eid;
    this.triple = triple;
    this.equivalent = [];
    this.ref = triple[0].ref;
    this.name = triple[0].name;
    this.equals = function(other){
        if(!other)
            return false;
        if(this.footprint == other.footprint)
            return true;
        return this._isTripleEqual(this.triple, other.triple);
    }
    this.toString = function(d){ //param {d}: whether output details
        var res =  this.footprint+':'+this.pattern+'\n';
        res += this.triple.join('\n'); 
        if(this.equivalent.length>0){
            if(d==true){
                for(var i=0; i<this.equivalent.length; i++){
                    res += '\nequivalent violation ['+(i+1)+']:\n';
                    res += this.equivalent[i].join('\n');
                }
            }
        }
        return res;
    }
}
//returns if there are at least one record that are accessed by the same type and in the same source location.
//this implies that they are operating the same variable
AVReport.prototype._isTripleEqual = function(t1, t2){
    if(t1[0].ref == t2[0].ref && t1[0].name == t2[0].name)
        return true;
    for(var i=0;i<3;i++){
        for(var j=0; j<3;j++){
            if(t1[i].location ==  t2[j].location && t1[i].logEntryType == t2[j].logEntryType)
                return true;
        }
    }
    return false;
}
AVDetector.prototype._isTripleValid = function(triple, varIndexing, graph){
    logger.info('checking if a triple is valid...');
    var first = triple[0], second=triple[1], third=triple[2];
    return this._isSuccessive(first, second, varIndexing, graph) &&
        this._isSuccessive(first, third, varIndexing, graph) &&
        this._isSuccessive(third, second, varIndexing, graph);
}

function _hasSideEffects(accesstype){
    if(typeof accesstype != 'string')
        return false; 
    return accesstype.match('W|C|D');
}
AVDetector.prototype._isSuccessive = function(rcd1, rcd2, varIndexing, graph){
    return true;
    var cachedV = this._ssCache.get([rcd1?rcd1.lineno:-1, rcd2?rcd2.lineno:-1]);
    if(cachedV !== MultiLayerMap.NOT_EXIST){
        return cachedV;
    }

    //be sure that there is no record rcd3 between rcd1 and rcd2 that 
    //(condition-1) rcd3.accessType == rcd1.accessType || rcd3.accessType == rcd1.accessType
    //(condition-2) and if both rcd1 and rcd2 do not have side effects, then the rcd3 should not have side effects
    var eid, key, rcds, curi, _path, flag;
    
    if(rcd1 && rcd2){
        _path = graph.getPath(rcd1, rcd2)[1];
        if(_path.length == 0)
            _path = [rcd1.eid, rcd2.eid];
        key = [rcd1.ref, rcd1.name];
        flag = !_hasSideEffects(rcd1.accessType) && !_hasSideEffects(rcd2.accessType);
    }else if(rcd1){
        _path = [rcd1.eid]; 
        key = [rcd1.ref, rcd1.name];
    }else if(rcd2){
        _path = [rcd2.eid];
        key = [rcd2.ref, rcd2.name];
    }
    
    rcds = varIndexing.variables.get(key);
    
    logger.info('begin checking if two records are successive. path: '+ _path +'\n'+ rcd1+'\n'+ rcd2);
    for( var i=0; i<rcds.length; i++){
        cur = rcds[i];
        if(_path.indexOf(cur.eid)>=0){
            if(cur.eid == rcd1.eid){
                if(cur.lineno > rcd1.lineno && cur.accessType == rcd1.accessType){
                    logger.debug('has repeating operation in the first event:'+cur);
                    this._ssCache.set([rcd1?rcd1.lineno:-1, rcd2?rcd2.lineno:-1], false);
                    return false;
                }
            }else if(cur.eid == rcd2.eid){
                if(cur.lineno < rcd2.lineno && cur.accessType == rcd2.accessType){
                    logger.debug('has repeating operation in the second event:'+cur);
                    this._ssCache.set([rcd1?rcd1.lineno:-1, rcd2?rcd2.lineno:-1], false);
                    return false;
                }
            }else if(cur.accessType == rcd1.accessType || cur.accessType == rcd2.accessType){
                logger.debug('has repeating operation between the atomic pair of events:'+ cur);
                this._ssCache.set([rcd1?rcd1.lineno:-1, rcd2?rcd2.lineno:-1], false);
                return false;
            }
            if(flag && _hasSideEffects(cur.accessType)){
                logger.debug('has side effects between two reads:'+cur);
                this._ssCache.set([rcd1?rcd1.lineno:-1, rcd2?rcd2.lineno:-1], false);
                return false;
            }
        }
    }
    logger.info('result checking if two records are successive. path: '+ _path +'\n'+ rcd1+'\n'+ rcd2, true);
    this._ssCache.set([rcd1?rcd1.lineno:-1, rcd2?rcd2.lineno:-1], true);
    return true;
}
AVDetector.prototype.filterOutFalsePositives = function(parsed){
    logger.info('Start to filter out false positives');
    var varIndexing = parsed.manager.varIndexing
    var reports = this.reports;
   
    var res = [];

    for(var i=0; i<reports.length;i++){
        var report = reports[i];
        var saved = undefined;
        for(var j=0;j<res.length;j++){
            var _rpt = res[j];
            if(_rpt.equals(report)){
                saved = _rpt;
                break;
            }
        }
        if(saved){
            saved.equivalent.push(report.triple);
        }else{
            res.push(report);
        }
    }
    this.reports = res;
    /*
    //FP policty-3:
    //merge reports that have the same footprint
    var res = new MultiLayerMap();
    for(var i=0; i<reports.length;i++){
        var report = reports[i];
        if(res.get([report.footprint])== MultiLayerMap.NOT_EXIST)
            res.set([report.footprint], report);
        else{
            res.get([report.footprint]).equivalent.push(report.triple);
            logger.info('remove equivalent report by footprint '+report.footprint+':' + report);
        }
    }
    //FP policy4:
    //merge reports that have the same identification
    reports = res.valueArray(1);
    res = new MultiLayerMap();
    for(var i=0; i<reports.length; i++){
        var report = reports[i];
        if(res.get([report.ref, report.name]) == MultiLayerMap.NOT_EXIST){
            res.set([report.ref, report.name], report);
        }else{
            res.get([report.ref, report.name]).equivalent.push(report.triple);
            logger.info('remove equivalent report by name ('+report.ref+','+report.name+')' + report);
        }
    }

    this.reports = res.valueArray(2); 
    */
    logger.info('Totalling', this.reports.length - this.reports.length, 'false positive are removed.');

    return this.reports;
}
//param d: default value is false, whether output equivalent details
AVDetector.prototype.printReports = function(d){
    //print log
    var info = '*** BUG REPORTS GENERATED BY AVDETECTOR ***\n';
    info += 'Count of AV bugs found: '+ this.reports.length +'\n';
    for(var i=0; i<this.reports.length; i++){
        info+= '['+(i+1)+'] '+ this.reports[i].toString(d)+'\n\n';
    }

    info += 'Time cost:\n';
    info += '    parse:' + this.parser.time_parse + ' seconds\n';
    info += '    detect:' + this.time_detect + ' seconds\n';
    info += '    total:' + (this.parser.time_parse+ this.time_detect)+ ' seconds\n';
    info += '	 event:'+ this.numberOfEvents + 'items\n';
    logger.warn(info);
}

var VAR_AV_PATTERNS = {};
function VAR_AV_REMOTE_READ(first, second, third){
    if (first.accessType == 'W' && second.accessType == 'R' && third.accessType == 'W'){
        return true;
    }
    return false;
}
VAR_AV_PATTERNS.VAR_AV_WRW = VAR_AV_REMOTE_READ; 
function VAR_AV_FOLLOWER_READ(first, second, third){
    if (first.accessType == 'R' && second.accessType == 'R' && third.accessType == 'W'){
        return true;
    }
    return false;
}
VAR_AV_PATTERNS.VAR_AV_RRW = VAR_AV_FOLLOWER_READ;
function VAR_AV_LEAK_INTERMEDIATE(first, second, third){
    if(first.accessType == 'W' && second.accessType == 'W' && third.accessType == 'R'){
        return true;
    }
    return false;
}
VAR_AV_PATTERNS.VAR_AV_WWR = VAR_AV_LEAK_INTERMEDIATE; 
function VAR_AV_STALE_DATA(first, second, third){
    if(first.accessType == 'R' && second.accessType == 'W' && third.accessType == 'W')
        return true;
    return false;
}
VAR_AV_PATTERNS.VAR_AV_RWW = VAR_AV_STALE_DATA; 

var FS_AV_PATTERNS = {};
FS_AV_PATTERNS.FS_AV_$W = function FS_AV_NONATOMIC_WRITE(first, second, third){
   if(first.accessType == 'O' && second.accessType == 'W' && third.accessType == 'R'){
        return true;   
   } 
   return false;
}
FS_AV_PATTERNS.FS_AV_SC = function FS_AV_SC(first, second, third){
    if(first.accessType=='S' && second.accessType == 'C' && third.accessType.match('C|R|W'))
        return true;
    return false;
}
FS_AV_PATTERNS.FS_AV_SR = function FS_AV_SR(first, second, third){
    if(first.accessType=='S' && second.accessType == 'R' && third.accessType.match('D|C'))
        return true;
    return false;
}
FS_AV_PATTERNS.FS_AV_SD = function FS_AV_SD(first, second, third){
    if(first.accessType=='S' && second.accessType == 'D' && third.accessType.match('D|C'))
        return true;
    return false;
}
FS_AV_PATTERNS.FS_AV_WR = function FS_AV_WR(first, second, third){
    return VAR_AV_REMOTE_READ(first, second, third) || VAR_AV_FOLLOWER_READ(first, second, third) 
        || VAR_AV_LEAK_INTERMEDIATE(first, second, third) || VAR_AV_STALE_DATA(first, second, third); 
}
FS_AV_PATTERNS.FS_AV_RD = function FS_AV_RD(first, second, third){
    if(first.accessType=='R' && second.accessType == 'D' && third.accessType.match('C|D|W'))
        return true;
    return false;
}
FS_AV_PATTERNS.FS_AV_WD = function FS_AV_WD(first, second, third){
    if(first.accessType=='W' && second.accessType == 'D' && third.accessType.match('C|W|D'))
        return true;
    return false;
}
exports.AVDetector = AVDetector;
