NRace is a dynamic tool to detect event races and atomicity violations for event-driven Node.js applications.   

# Prerequisite
- Node.js 8.6 and above 

# Setup

## Build NRace
```
$ cd nrace
$ npm install
```

## Find Your Node.js  
```
$ whereis nodejs
```  

## Configure the Command of NRace
```
$ cd /bin
$ vim nrace	//modify the path of NODEJS and CMD
```
# Usage
If correctly installed, you can run NRace in the terminal using the
command `nrace` configured above:
```
$ nrace --help
```

This will show the options available to configure NRace, The entry
point for CLI is coded in `driver/cmd.js`

## Trace collection
To instrument a Node.js application:
```
$ nrace instrument --outputDir /path/to/instrumented/app /path/to/target/path
```
Then, go to the path of instrumented application and run it, an
execution trace will be collected. The trace is recorded in the file `ascii-trace.log`.
## Happens-before graph construction
A happens-before graph is built for the collected trace:
`ascii-trace.log`:
```
$ nrace parse /path/to/instrumented/app
```
A file named `ascii-trace-hb*` is generated. It represents the
happens-before graph and consists of information of nodes and edges.
We also support graph visualization. Users can add `-g` at the end of
the graph generation command and a `.png` file will generate.
## Race detection
NRace detects possible races based on the trace `ascii-trace.log` and
happens-before graph `ascii-trace-hb*`:
```
$ nrace dfanalyze /path/to/instrumented/app
```
The bug report contains two parts: detected harmful races and
identified commutative races. The bug report is output in the
terminal. We also save the bug report as a json file under the path `/path/to/instrumented/app`.