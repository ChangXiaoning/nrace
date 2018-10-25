//To run this example:
//  cd AVDetector_project_dir
//  jasmine test/example.js

var exec = require('../lib/analysis/driver.js').exec;

describe("tracer", function() {
  beforeEach(function() {
  });

  it("source1: should instrument and run the tracer", function() {
      exec(['nodeinstrun', './test/source1/main.js']);
  });

});
