const log4js = require('log4js');
var fileloc = require('path').resolve(__dirname, '../../application.log');

log4js.configure({
    appenders: {
        out: { type: 'stdout' },
        app: { type: 'file', filename: 'application.log' }
    },
    categories: { default: { appenders: ['out','app'], level: 'info' } }
});

exports.logger = log4js.getLogger();
