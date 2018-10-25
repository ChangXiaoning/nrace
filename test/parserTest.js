var TraceParser = require('../lib/analysis/TraceParser.js').TraceParser;
var AVDetector = require('../lib/analysis/Detector.js').AVDetector;
var logger = require('../lib/analysis/logger.js').logger;

var exec = require('../lib/analysis/driver.js').exec;
var expect = require('expect.js');

function _matchAll(line, ptns) {
    for (var i = 0; i < ptns.length; i++) {
        if (!line.match(ptns[i])) {
            return false;
        }
    }
    return true;
}

function _matchAny(line, ptns) {
    for (var i = 0; i < ptns.length; i++) {
        if (line.match(ptns[i])) {
            return true;
        }
    }
    return false;
}

function _getLines(content, match, ptns) {
    var lines = content.split('\n');
    var res = [];
    for (var i = 0; i < lines.length; i++) {
        if (match(lines[i], ptns))
            res.push(lines[i]);
    }
    return res;
}

function getLinesContainsAll(content, ptns) {
    return _getLines(content, _matchAll, ptns);
}

function getLinesContainsAny(content, ptns) {
    return _getLines(content, _matchAny, ptns);
}
describe("TraceCollector", function() {
   /*
    it("TraceCollector: should instrument promise", function() {
        exec(['nodeinstrun', './test/sources/promise.js'], function(){
          expect(fs.existsSync('./test/sources/promise_jalangi_.js')).to.be(true);
        
        });
    });
    */
    it.skip("TraceCollector: should instrument a real application (a server website example) and run the tracer", function() {
        exec(['instrument', '../envaluation/example/', '--outputDir', '../envaluation/jalangi-instrumented', '--debug', 'true'], function() {
            expect(fs.existsSync('../envaluation/jalangi-instrumented')).to.be(true);
        });
    });

    it("TraceCollector: should correctly model data access to EventEmitter", function() {
        exec(['nodeinstrun', './test/sources/EventEmitter.js'], function(res) {
            exec(['inspect', res, '-n', 'foo'], function(res) {
                expect(res.length).to.be(3);
            });
        });
    });



    it("TraceCollector: should correctly model data access to filesystem", function() {
        exec(['nodeinstrun', './test/sources/file.js'], function(res) {
            expect(getLinesContainsAll(res, ['^40,', 'writeFile']).length > 0).to.be(true);
            expect(getLinesContainsAll(res, ['^40,', 'data.txt']) > 0).to.be(true);
            expect(getLinesContainsAll(res, ['^41,', 'data.txt']) > 0).to.be(true);
            expect(getLinesContainsAll(res, ['^40,', 'output.txt']) > 0).to.be(true);
            expect(getLinesContainsAll(res, ['^41,', 'output.txt']) > 0).to.be(true);
        });
    });
});

describe("DriverTest", function() {
    it("Inspector-1: should filter out data according to given conditions", function() {
        var trace = '20,1,any,0\n' //1, async init
            + '20,2,any,1\n' //2, async init
            + '20,3,any,0\n' //3, async init
            + '21,0\n' //4, async before
            + '21,1\n' //5, async before
            + '32,any,any,script1\n' //6. functionEnter
            + '35,1,1,any,1,any\n' //7. sourcemapping
            + '35,2,2,any,2,any\n' //8.sourcemapping
            + '1,1,0,v1,any\n' //9, write
            + '10,2,0,v2,any\n' //10, read
            + '32,any,any,script2\n' //11.functionEnter
            + '35,3,3,any,3,any\n' //12. sourcemapping
            + '36,4,4,any,4,any\n' //13. sourcemapping
            + '22,1\n' //14, async after
            + '21,2\n' //15, async after
            + '10,3,0,v1,any\n' //16, read
            + '10,4,0,v3,any\n' //17, read
            + '32,any,any,script3\n' //18.functionEnter
            + '35,5,5,any,5,any\n' //19.sourcemapping
            + '36,6,6,any,6,any\n' //20.sourcemapping
            + '22,2\n' //21, async after
            + '21,3\n' //22, async before
            + '1,5,0,v1,any\n' //23, write
            + '10,6,0,v4,any\n' //24, read
            + '22,3'; //25, async after

        exec(['inspect', trace, '-n', 'v1'], function(res) {
            expect(res.length).to.be(3);
        });
        exec(['inspect', trace, '-e', '2'], function(res) {
            expect(res.length).to.be(2);
        });
        exec(['inspect', trace, '-et', 'WRITE'], function(res) {
            expect(res.length).to.be(2);
        });
        exec(['inspect', trace, '-et', 'READ'], function(res) {
            expect(res.length).to.be(4);
        });
        exec(['inspect', trace, '-l', 'script1#1#1'], function(res) {
            expect(res.length).to.be(1);
        });
        exec(['inspect', trace, '-l', 'script1#1#1', '-et', 'READ'], function(res) {
            expect(res.length).to.be(0);
        });
        exec(['inspect', trace, '-r'], function(res) {
            expect(res.length).to.be(1);
        });

    });

});
/* remove this case
describe("ParserTest", function() {
  it("ParserTest-1: should parse the trace file 'source2/ascii-trace.log'", function() {
      var paser = new TraceParser();
      try{
          paser.parse('./test/source2/ascii-trace.log', function(res){
            //do something
          });

      }catch(e){
        console.log(e);
      }
  });

});
*/
describe("DetectorTest.js", function() {
    it("DetectorTest-0: build happens before graph", function() {
        //The access to (0, v1) in callback 1 and 2 should be atomic, and should not be abrupted by callback 3.
        var trace = '20,1,any,0\n' //1, async init
            + '20,2,any,1\n' //2, async init
            + '20,3,any,2\n' //3, async init
            + '20,4,any,3'
            + '20,5,any,0';
        var detector = new AVDetector();
        detector.detect(trace);
        var g = detector.parser.result.graph;
        
    });
    it("DetectorTest-1: should violate pattern DEFAULT_AV_PATTERN_REMOTEREAD", function() {
        //The access to (0, v1) in callback 1 and 2 should be atomic, and should not be abrupted by callback 3.
        var trace = '20,1,any,0\n' //1, async init
            + '20,2,any,1\n' //2, async init
            + '20,3,any,0\n' //3, async init
            + '21,0\n' //4, async before
            + '21,1\n' //5, async before
            + '1,any,0,v1,any\n' //6, write
            + '10,any,0,v2,any\n' //7, read
            + '22,1\n' //8, async after
            + '21,2\n' //9, async after
            + '10,any,0,v1,any\n' //10, read
            + '10,any,0,v3,any\n' //11, read
            + '22,2\n' //12, async after
            + '21,3\n' //13, async before
            + '1,any,0,v1,any\n' //14, write +
            '10,any,0,v4,any\n' //15, read
            + '22,3'; //16, async after

        var detector = new AVDetector();
        detector.detect(trace);
        var vars = detector.parser.result.manager.varIndexing.variables;
        expect(vars.get([0, 'v1']).length).to.be(3);
        expect(detector.reports.length).to.be(1);
    });
    it("DetectorTest-2: should NOT violate pattern DEFAULT_AV_PATTERN_REMOTEREAD", function() {
        //The differrence between this case and DetectorTest-1 is the asynchronous resource type lies in line 1 and line 3
        //There is no AV bug since the order between callback 1, 2 and 3 is determined, 3<-2<-1
        var trace = '20,1,Timeout,0\n' //1, async init
            + '20,2,any,1\n' //2, async init
            + '20,3,TickObject,0\n' //3, async init
            + '21,0\n' //4, async before
            + '21,1\n' //5, async before
            + '1,any,0,v1,any\n' //6, write
            + '10,any,0,v2,any\n' //7, read
            + '22,1\n' //8, async after
            + '21,2\n' //9, async after
            + '10,any,0,v1,any\n' //10, read
            + '10,any,0,v3,any\n' //11, read
            + '22,2\n' //12, async after
            + '21,3\n' //13, async before
            + '1,any,0,v1,any\n' //14, write
            + '10,any,0,v4,any\n' //15, read
            + '22,3'; //16, async after

        var detector = new AVDetector();
        detector.detect(trace);
        var vars = detector.parser.result.manager.varIndexing.variables;
        expect(vars.get([0, 'v1']).length).to.be(3);
        expect(detector.reports.length).to.be(0);
    });
    it("DetectorTest-3: should violates file AV pattern", function() {
        exec(['nodeinstrun', './test/sources/file_non_atomic_write.js'], function(res) {
            var trace = res; 
            exec(['inspect', trace, '-et', 'FS_'], function(res) {
                expect(res.length).to.be(6);
            });
            exec(['inspect', trace, '-et', 'FS_STAT'], function(res) {
                expect(res.length).to.be(1);
            });
            exec(['inspect', trace, '-et', 'FS_DELETE'], function(res) {
                expect(res.length).to.be(1);
            });
            exec(['inspect', trace, '-et', 'FS_OPEN'], function(res) {
                expect(res.length).to.be(1);
            });
            exec(['inspect', trace, '-et', 'FS_READ'], function(res) {
                expect(res.length).to.be(1);
            });
            exec(['inspect', trace, '-et', 'FS_WRITE'], function(res) {
                expect(res.length).to.be(2);
            });
            var detector = new AVDetector();
            detector.detect(trace);
            expect(detector.reports.length).to.be(1);
        });

    });

    it("DetectorTest-4: should filter out false positives", function(){
        exec(['nodeinstrun', './test/sources/fp.js'], function(res){
            var detector = new AVDetector();
            detector.detect(res);
            expect(detector.reports.length).to.be(1);
        })
    });
});
