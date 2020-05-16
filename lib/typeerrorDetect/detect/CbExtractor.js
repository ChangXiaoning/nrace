const path = require('path');
const fs = require('fs');
const lineReader = require('line-reader');

const graphUtil = require('../hb/util');

class CbExtractor {
    constructor (appPath) {
        this.appPath = appPath;
        this.hbfile = path.resolve(appPath, './ascii-trace.hb.json');
        this.recordfile = path.resolve(appPath, './ascii-trace.access-records.json');
        this.cbInfoFile = path.resolve(appPath, './cbinfo.json');

        /*if(fs.existsSync(this.cbInfoFile)){
            let newname = this.cbInfoFile.replace('.json', '-bak-'+new Date().toString()+'.json')
            fs.renameSync(this.cbInfoFile, newname);
        }*/

        let info = graphUtil.read(this.hbfile, this.recordfile);
        //this.rg = info.relations;
        //this.records = info.records;
        this.asyncObjects = info.asyncObjects;

        //map from location to content
        this.cbContent = {};
    }

    extract (cb) {
        let events = this.asyncObjects.getAll();
        events.forEach(event => {
            //event with id 1 is special, which has no callback property
            if (event.id == '1') {
                let location = event.loc;
                let file = location.split('#')[0];
                let filename = path.resolve(this.appPath, file);
                let code = fs.readFileSync(filename, 'utf-8');
                this.cbContent[event.loc] = code;
                
                fs.appendFileSync(this.cbInfoFile, JSON.stringify({location: location, code: code}, null, 4), 'utf-8');
            } else {
                let location = event.callback.location;
                if (!this.cbContent[location]) {
                    let metadata = location.split('#');
                    let file = metadata[0];
                    let filename = path.resolve(this.appPath, file);
                    let startRow = parseInt(metadata[1]);
                    let startCol = parseInt(metadata[2]);
                    let endRow = parseInt(metadata[3]);
                    let endCol = parseInt(metadata[4]);
                    //Fix: dfatool cannot deal with the callback
                    //function, so we only extract the callback body
                    //TODO: maybe have bugs
                    startRow = startRow + 1;
                    endRow = endRow - 1;
                    //read file
                    let count = 0;
                    let content = [];
                    let self = this;
                    lineReader.eachLine(filename, function (line, last) {
                        count++;
                        if (count >=startRow && count <= endRow) {
                            content.push(line);
                        }
                        if (last) {
                            //process the content[0] and content[content.length-1];
                            /*let start = content[0].slice(startCol)
                            content[0] = start;
                            let end = content[content.length - 1].slice(endCol);
                            content[content.length - 1] = end;*/

                            //merge the callback function code into a string
                            let code = content.join(' ');
                            self.cbContent[location] = code;
                            //there is a race so we append result to file
                            fs.appendFileSync(self.cbInfoFile, JSON.stringify({location: location, code: code}, null, 4), 'utf-8');
                        }
                    });
                }
            }
        });
    }

    print2File () {
        //write callback info to file
        if(fs.existsSync(this.cbInfoFile)){
            let newname = this.cbInfoFile.replace('.json', '-bak-'+new Date().toString()+'.json')
            fs.renameSync(this.cbInfoFile, newname);
        }
        fs.writeFileSync(this.cbInfoFile, JSON.stringify({info: this.cbContent}, null, 4), 'utf-8');
    }
}

module.exports = CbExtractor;