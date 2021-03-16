var shell = require('shelljs');

var config = null;

var start_time, end_time, run_time;
//#1: agentkeepalive
config = {
    cmd: 'node fuzz_test/triggerRace.js',
    dir: '/Users/xiaoningchang/Code/jalangi-noderacer-known-bugs/agentkeepalive-23'
};

shell.cd(`${config.dir}`);

start_time = new Date().getTime();
shell.exec(`${config.cmd}`);
end_time = new Date().getTime();

//#2: fiware-pep-steelskin
/*config = {
    cmd: 'node _known_bug.js',
    dir: '/Users/xiaoningchang/Code/jalangi-app/fiware-pep-steelskin-i269'
};

console.log(config.dir);
shell.cd(`${config.dir}`);

start_time = new Date().getTime();
shell.exec(`${config.cmd}`);
end_time = new Date().getTime();

run_time = (end_time - start_time) / 1000.0;
console.log('Runtime: ', run_time);

//# 3. ghost
config = {
    cmd: 'node fuzz_test/add_mock.js',
    dir: '/Users/xiaoningchang/Code/jalangi-noderacer-known-bugs/WhiteboxGhost'
};

shell.cd(`${config.dir}`);

start_time = new Date().getTime();
shell.exec(`${config.cmd}`);
end_time = new Date().getTime();

run_time = (end_time - start_time) / 1000.0;
console.log('Runtime: ', run_time);

//#4. node-mkdirp
config = {
    cmd: 'node fuzz_test/race_subtle.js',
    dir: '/Users/xiaoningchang/Code/jalangi-noderacer-known-bugs/node-mkdirp'
};

shell.cd(`${config.dir}`);

start_time = new Date().getTime();
shell.exec(`${config.cmd}`);
end_time = new Date().getTime();

run_time = (end_time - start_time) / 1000.0;
console.log('Runtime: ', run_time);

//#5. nes
config = {
    cmd: 'node xiaoning.js',
    dir: '/Users/xiaoningchang/Code/jalangi-app/nes-i18'
};

shell.cd(`${config.dir}`);

start_time = new Date().getTime();
shell.exec(`${config.cmd}`);
end_time = new Date().getTime();

run_time = (end_time - start_time) / 1000.0;
console.log('Runtime: ', run_time);

//#6. node-logger-file-i1
config = {
    cmd: 'npm test',
    dir: '/Users/xiaoningchang/Code/jalangi-app/node-logger-file-i1'
};

shell.cd(`${config.dir}`);

start_time = new Date().getTime();
shell.exec(`${config.cmd}`);
end_time = new Date().getTime();

run_time = (end_time - start_time) / 1000.0;
console.log('Runtime: ', run_time);

//#7. socket.io
config = {
    cmd: 'node triggerRace.js',
    dir: '/Users/xiaoningchang/Code/evaluation/app/socket.io-client-i1862'
};

shell.cd(`${config.dir}`);

start_time = new Date().getTime();
shell.exec(`${config.cmd}`);
end_time = new Date().getTime();

run_time = (end_time - start_time) / 1000.0;
console.log('Runtime: ', run_time);

//#8. del
config = {
    cmd: 'node issue43.js',
    dir: '/Users/xiaoningchang/Code/jalangi-noderacer-known-bugs/del'
};

shell.cd(`${config.dir}`);

start_time = new Date().getTime();
shell.exec(`${config.cmd}`);
end_time = new Date().getTime();

run_time = (end_time - start_time) / 1000.0;
console.log('Runtime: ', run_time);

//#9. simplecrawler
config = {
    cmd: 'npm test',
    dir: '/Users/xiaoningchang/Code/jalangi-app/node-simplecrawler-i298'
};

shell.cd(`${config.dir}`);

start_time = new Date().getTime();
shell.exec(`${config.cmd}`);
end_time = new Date().getTime();

run_time = (end_time - start_time) / 1000.0;
console.log('Runtime: ', run_time);

//#10. xlsx-extract
config = {
    cmd: 'node xiaoning/xiaoning.js',
    dir: '/Users/xiaoningchang/Code/jalangi-app/xlsx-extract-i7'
};

shell.cd(`${config.dir}`);

start_time = new Date().getTime();
shell.exec(`${config.cmd}`);
end_time = new Date().getTime();

run_time = (end_time - start_time) / 1000.0;
console.log('Runtime: ', run_time);*/
