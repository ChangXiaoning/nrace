const asyncLog = require('./asyncLog.js')
const fs = require('fs')

fs.writeSync(1, 'File operations start...\n');

fs.writeSync(1, 'File operation 1 start...\n');
fs.writeFile('data.txt', '***this is file content***\n', function () {
  fs.writeSync(1, 'File operation callback 1 is invoked!\n');
});

fs.writeSync(1, 'File operation 2 start...\n');
fs.writeFile('data.txt', '***this is file content***\n', function () {
  fs.writeSync(1, 'File operation callback 2 is invoked!\n');
});

fs.writeSync(1, 'File operation end...\n');