NodeRacer is a dynamic tool to detect event races and atomicity violations for event-driven Node.js applications.   

# Prerequisite
- Node.js 8.6 and above
- Python 2.7  

# Setup

## Configure git and download NodeRacer  

```
$ ssh-keygen -t rsa -C "youremail@example.com"
$ cat id_rsa.pub | xclip	//add the public key into your gitlab account
$ git config --global user.name "bob"
$ git config --global user.email bob@...
$ git clone git@gitlab.com:xnChang94/nodeav.git NodeRacer
```
## Build NodeRacer
```
$ cd avdetector
$ npm install
```

## Find Your Node.js  
```
$ whereis nodejs
```  

## Configure the Command of NodeRacer
```
$ cd evaluation
$ vim avd	//modify the path of NODEJS and CMD
```

# Inspect Your Code  
```
$ cd evaluation 
$ mkdir dataset	//put your code to be tested in directory dataset
$ ./avd instrument --outputDir ./jalangi ./dataset/your application
$ cd jalangi/your application/
$ node test.js	//to collect trace and ascii-trace.log is produced in the root of jalangi/your application
$ cd ../../
$ ./avd inspect ./jalangi/your application/ -r	//detect atomicity violations
$ ./avd detect ./jalangi/your application -r [-race]	//detect event races
```  

# Command
- instrument
- noderun
- inspect 
- detect
-	-race
- 	-chain

# Implementation

TraceParser.py: Parse trace into objects ->
z3Scheduler.py: Build and solve constraints, print out reporters

## Data Structure  

### DataAccessRecord <class> (self, lineno, entryType, accessType, ref, name, eid, iid)
+ count
+ records <dict>: indexed by iid, storing the instance of data access record
- lineno
- entryType
- accessType
- ref
- name
- eid
- iid
- rcdsByScopeName <list>: indexed by the identifier of a variable (by the method getId), storing the data access record that accesses to this variable
- getId <method>: return ref+'@'+name  

### StartandEndRecord <class> (self, asyncId, insType, lineno)
- asyncId
- type
- lineno

### Callback <class> (self, asyncId, prior, resourceType, hbType, lineno)
- asyncId
- prior
- resourceType
- priority
- hbType
- register
- records <list>: store data access records
- postCbs <dict> [optional]: indexed by priority, each value corresponding to a priority is a list, storing the asyncId of post callbacks. If a callback does not have any post callback, it will not have this property.
- instructions <list>: store start, end and data access records
- start
- end
- location

### CbStack <dict>
- stack <list>
- cbs <dict>: indexed by asyncId, storing the callback
- records <dict>: indexed by lineno, storing the start, end of callbacks and
- vars <dict>: indexed by the identifier of variables, each value corresponding to an identifier is a dict. Each dict contains 2 lists indexed by 'W' and 'R', storing the lineno of data access record.

### FunStack <dict>
- stack <list>
- counts <dict>: store the times of each iid (function) is entered, i.e., counts[iid]
- vars <dict>: store the variables of each iid (function), i.e., vars[iid-times][name]=true/false

### parsedResult <dict>
- cbs <dict>: same with the cbs property of CbStack
- records <dict>: stores the collection of records (start/end, data access, register/resolve)  
- vars <dict>: same with the vars property of CbStack

### Report <class>
For atomicity violation detection.
- pattern <str>
- triple <list>
- footprint <str>
- equivalent <list>
- ref <str>
- name <str>

### Race <class>
For event race detection.
- pattern <str>
- duple <list>
- footprint <str>
- ref <str>
- name <str>

### TraceParser.processTraceFile (traceFile)
- @param traceFile <str>: the trace file to be parsed
- @return result <dict>: parsedResult  

### z3Scheduler.startDebug(parsedResult, isRace)

## **Scheducler**  
i.e., for build and constraints

### Property  

- solver <Solver>
- grid <dict>: indexed by the lineno of instruction, storing the order variable of each instruction for constraint building
- cbs <dict>
- records <dict>
- variables <dict>
- reports <list>
- races <list> 

### Method  

#### filterCbs ()
To decrease the size of memory space by removing callbacks that will not join constraints
- Stardard 1: The idle callback.
- Standard 2: If the callback list under a priority in prior.postCbs is empty, remove it. 
- Standard 3: Remove the empty postCallback list (i.e., postCbs).

#### createOrderVariables ()
To create an order variable for each instruction
In addition, create a constraint: **each order variable > 0**.

#### addDistinctConstraint ()
To create a constraint that **Distinct**  

#### addProgramAtomicityConstraint ()
To create **a constraint among instructions in the same callback.**

#### addRegisterandResolveConstraint ()
Constraint: **If a callback *a* registers another callback *b*, then *a* must happen before *b***.
Implementation: a.register < b.start.

#### addPriorityConstraint ()  
Same priority.
- Constraint 1: **If the priority of two callback *a* and *b* are same, they are not I/O and TIMEOUT, and they are registered by the same callback, then *a* must happen before *b*.**
- Constraint 2: **Given 4 callback *a*, *b*, *c* and *d*, *a* registers *c*, *b* registers *d*, *c* and *d* are of same priority, *c* and *d* are not I/O and TIMEOUT, if *a* happens before *b*, then *c* must happen before *d*.**  

Different priority.
- Constraint 3: **If the priority of two callback *a* and *b* are different, the priority of *a* is 0, both are registered by the same callback, then *a* must happen before *b* .**
- Constraint 4: **If the priority of two callback *a* and *b* are different, the priority of *a* is 0, *a* and *b* is registered by *c* and *d*, respectively, and *c* happens before *d*, then *a* must happen before *b*.**  

#### addsetTimeoutPriority ()
TODO

#### addIOConstraint ()
TODO

#### cbHappensBefore (cb1, cb2)
To determin whether cb1 happens before cb2
- @return True: only when the Z3 returns *yes* on the condition that other constraints plus the constraint "cb1.start < cb2.start" and Z3 returns *no* on the the conditon that other constraints plus the constraint "cb1.start > cb2.start".  

#### reorder (lineno1, lineno2)
To reorder two data access records.
- @return <str>/<list>: 'Concurrent'. <list>: the first element is prior
Only exist one happens before another, it is happens-before relation. Otherwise, it is concurrency relation.

#### isConcurrent_new_1 (lineno1, lineno2)  
To determine whether two data access records are concurrent.
- @return True: only when the Z3 returns "yes" under the condition that "lineno1 < lineno2" and returns "yes" under the condition that "lineno1 > lineno 2". 
#### addPatternConstraint ()
To detect atomicity violations.

#### addW_W_RPattern_new_2 ()

#### addR_W_RPattern ()

#### addW_R_WPattern ()

#### addR_W_WPattern ()

#### detectRace ()

#### check ()
To get the result of Z3.

#### printScheduleResult ()
To print the solution provided by Z3 for debug.

#### printReports ()
To print the bug report for atomicity violation detection.

#### searchCbChain (lienno)
Return the callback chain that happens before the given data access record (represented by lineno)
TODO: After implementation, I found it is impossible to find the callback chain that involve a race.
It should be implemented from the registration relation between callbacks.
Further, attemp to bind the location of W/R that the most near the INIT operation to the registration, to approximate the location of a callbck. (This is not urgent)

#### printRaces ()
To print the bug report for event race detection.

## Approach  

### Step 1: Parse Trace  



### Step 2: Build and Solve Constraints

### Step 3: Yield Bug Report
Simple bug report can be produced.
TODO: Further more information, such as function chain, will be provided for debugging.
