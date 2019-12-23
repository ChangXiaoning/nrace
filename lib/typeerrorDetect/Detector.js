function Detector () {

};

Detector.prototype.detect = function (result, done) {
    console.log('this is detect');
    if (typeof done == 'function') done();
};

exports.Detector = Detector;