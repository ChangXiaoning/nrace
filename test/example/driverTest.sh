#To run this file:
#   cd AVDetector_project_dir
#   sh test/example.sh


#!/bin/bash
#node-debug --web-host 192.168.33.17 ./lib/analysis/detector.js nodeinstrun t4.js 
#node ./lib/analysis/detector.js instrument t4.js 
#node ./lib/analysis/detector.js noderun t4_jalangi_.js 
node ./lib/analysis/cmd.js nodeinstrun ./test/source1/main.js
