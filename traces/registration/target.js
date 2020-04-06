function f (a, b) {
    a = 1;
    return;
};

var o1 = {'p1': 'f1'},
    o2 = {'p2': 'f2'},
    output = 1;

setImmediate(function () {
    output = f(o1, o2);
});

setTimeout(function () {
    output += 1;
});