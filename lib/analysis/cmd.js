var driver = require('./driver.js');
var logger = require('./logger.js').logger;

try{
    var args = process.argv.slice(2);
    logger.info('Running command:', args.join(' '));
    if (args.length === 0) {
        console.error("Must provide a command: instrument, run, noderun, nodeinstrun, proxy, or inspect. Current command is:", process.argv);
        process.exit(1);
    }   
    driver.exec(args);
}catch(e){
    console.log(e);
}

