var shell = require('shelljs');

var config = null;

var start_time, end_time, run_time;
//#1: louischatriot/nedb
config = {
    cmd: 'node xiaoning_2.js',
    dir: '/Users/xiaoningchang/Code/evaluation/app/nedb'
};

/*shell.cd(`${config.dir}`);

start_time = new Date().getTime();
shell.exec(`${config.cmd}`);
end_time = new Date().getTime();

run_time = (end_time - start_time) / 1000.0;
console.log('Runtime: ', run_time);

config.dir = '/Users/xiaoningchang/Code/jalangi-app/nedb';
console.log(config.dir);
shell.cd(`${config.dir}`);

start_time = new Date().getTime();
shell.exec(`${config.cmd}`);
end_time = new Date().getTime();

run_time = (end_time - start_time) / 1000.0;
console.log('Runtime: ', run_time);*/

//#2: node-party/node-http-proxy
config = {
    cmd: 'node https_xiaoning.js',
    dir: '/Users/xiaoningchang/Code/evaluation/app/node-http-proxy'
};

/*shell.cd(`${config.dir}`);

start_time = new Date().getTime();
shell.exec(`${config.cmd}`);
end_time = new Date().getTime();

run_time = (end_time - start_time) / 1000.0;
console.log('Runtime: ', run_time);

config.dir = '/Users/xiaoningchang/Code/jalangi-app/node-http-proxy';
console.log(config.dir);
shell.cd(`${config.dir}`);

start_time = new Date().getTime();
shell.exec(`${config.cmd}`);
end_time = new Date().getTime();

run_time = (end_time - start_time) / 1000.0;
console.log('Runtime: ', run_time);*/

//# 3. simplecrawler/simplecrawler
/*config = {
    cmd: 'npm test',
    dir: '/Users/xiaoningchang/Code/evaluation/app/simplecrawler'
};

shell.cd(`${config.dir}`);

start_time = new Date().getTime();
shell.exec(`${config.cmd}`);
end_time = new Date().getTime();

run_time = (end_time - start_time) / 1000.0;
console.log('Runtime: ', run_time);

config.dir = '/Users/xiaoningchang/Code/jalangi-app/simplecrawler';
console.log(config.dir);
shell.cd(`${config.dir}`);

start_time = new Date().getTime();
shell.exec(`${config.cmd}`);
end_time = new Date().getTime();

run_time = (end_time - start_time) / 1000.0;
console.log('Runtime: ', run_time);*/

//#4. expressjs/serve-static
/*config = {
    cmd: 'npm test',
    dir: '/Users/xiaoningchang/Code/evaluation/app/serve-static'
};

shell.cd(`${config.dir}`);

start_time = new Date().getTime();
shell.exec(`${config.cmd}`);
end_time = new Date().getTime();

run_time = (end_time - start_time) / 1000.0;
console.log('Runtime: ', run_time);

config.dir = '/Users/xiaoningchang/Code/jalangi-app/serve-static';
console.log(config.dir);
shell.cd(`${config.dir}`);

start_time = new Date().getTime();
shell.exec(`${config.cmd}`);
end_time = new Date().getTime();

run_time = (end_time - start_time) / 1000.0;
console.log('Runtime: ', run_time);*/

//#5. jprichardson/node-jsonfile
/*config = {
    cmd: 'node xiaoning.js',
    dir: '/Users/xiaoningchang/Code/evaluation/app/node-jsonfile'
};

shell.cd(`${config.dir}`);

start_time = new Date().getTime();
shell.exec(`${config.cmd}`);
end_time = new Date().getTime();

run_time = (end_time - start_time) / 1000.0;
console.log('Runtime: ', run_time);

config.dir = '/Users/xiaoningchang/Code/jalangi-app/node-jsonfile';
console.log(config.dir);
shell.cd(`${config.dir}`);

start_time = new Date().getTime();
shell.exec(`${config.cmd}`);
end_time = new Date().getTime();

run_time = (end_time - start_time) / 1000.0;
console.log('Runtime: ', run_time);*/

//#6. sitegui/nodejs-websocket
/*config = {
    cmd: 'node xiaoning.js',
    dir: '/Users/xiaoningchang/Code/evaluation/app/nodejs-websocket'
};

shell.cd(`${config.dir}`);

start_time = new Date().getTime();
shell.exec(`${config.cmd}`);
end_time = new Date().getTime();

run_time = (end_time - start_time) / 1000.0;
console.log('Runtime: ', run_time);

config.dir = '/Users/xiaoningchang/Code/jalangi-app/nodejs-websocket';
console.log(config.dir);
shell.cd(`${config.dir}`);

start_time = new Date().getTime();
shell.exec(`${config.cmd}`);
end_time = new Date().getTime();

run_time = (end_time - start_time) / 1000.0;
console.log('Runtime: ', run_time);*/

//#7. AvianFlu/ncp
/*config = {
    cmd: 'node test/xiaoning.js',
    dir: '/Users/xiaoningchang/Code/evaluation/app/ncp'
};

shell.cd(`${config.dir}`);

start_time = new Date().getTime();
shell.exec(`${config.cmd}`);
end_time = new Date().getTime();

run_time = (end_time - start_time) / 1000.0;
console.log('Runtime: ', run_time);

config.dir = '/Users/xiaoningchang/Code/jalangi-app/ncp';
console.log(config.dir);
shell.cd(`${config.dir}`);

start_time = new Date().getTime();
shell.exec(`${config.cmd}`);
end_time = new Date().getTime();

run_time = (end_time - start_time) / 1000.0;
console.log('Runtime: ', run_time);*/

//#8. nickewing/line-reader
/*config = {
    cmd: 'node xiaoning_open.js',
    dir: '/Users/xiaoningchang/Code/evaluation/app/line-reader'
};

shell.cd(`${config.dir}`);

start_time = new Date().getTime();
shell.exec(`${config.cmd}`);
end_time = new Date().getTime();

run_time = (end_time - start_time) / 1000.0;
console.log('Runtime: ', run_time);

config.dir = '/Users/xiaoningchang/Code/jalangi-app/line-reader';
console.log(config.dir);
shell.cd(`${config.dir}`);

start_time = new Date().getTime();
shell.exec(`${config.cmd}`);
end_time = new Date().getTime();

run_time = (end_time - start_time) / 1000.0;
console.log('Runtime: ', run_time);*/

//#9. flosse/json-file-store
/*config = {
    cmd: 'node xiaoning.js',
    dir: '/Users/xiaoningchang/Code/evaluation/app/json-file-store'
};

shell.cd(`${config.dir}`);

start_time = new Date().getTime();
shell.exec(`${config.cmd}`);
end_time = new Date().getTime();

run_time = (end_time - start_time) / 1000.0;
console.log('Runtime: ', run_time);

config.dir = '/Users/xiaoningchang/Code/jalangi-app/json-file-store';
console.log(config.dir);
shell.cd(`${config.dir}`);

start_time = new Date().getTime();
shell.exec(`${config.cmd}`);
end_time = new Date().getTime();

run_time = (end_time - start_time) / 1000.0;
console.log('Runtime: ', run_time);*/

//#10. telefonicaid/fiware-pep-steelskin
/*config = {
    cmd: 'npm test',
    dir: '/Users/xiaoningchang/Code/evaluation/app/fiware-pep-steelskin'
};

shell.cd(`${config.dir}`);

start_time = new Date().getTime();
shell.exec(`${config.cmd}`);
end_time = new Date().getTime();

run_time = (end_time - start_time) / 1000.0;
console.log('Runtime: ', run_time);

config.dir = '/Users/xiaoningchang/Code/jalangi-app/fiware-pep-steelskin';
console.log(config.dir);
shell.cd(`${config.dir}`);

start_time = new Date().getTime();
shell.exec(`${config.cmd}`);
end_time = new Date().getTime();

run_time = (end_time - start_time) / 1000.0;
console.log('Runtime: ', run_time);*/

//#11. Yomguithereal/baobab
config = {
    cmd: 'node xiaoning.js',
    dir: '/Users/xiaoningchang/Code/evaluation/app/baobab'
};

shell.cd(`${config.dir}`);

start_time = new Date().getTime();
shell.exec(`${config.cmd}`);
end_time = new Date().getTime();

run_time = (end_time - start_time) / 1000.0;
console.log('Runtime: ', run_time);

config.dir = '/Users/xiaoningchang/Code/jalangi-app/baobab';
console.log(config.dir);
shell.cd(`${config.dir}`);

start_time = new Date().getTime();
shell.exec(`${config.cmd}`);
end_time = new Date().getTime();

run_time = (end_time - start_time) / 1000.0;
console.log('Runtime: ', run_time);