NodeRacer is a dynamic tool to detect event races and atomicity violations for event-driven Node.js applications.
#Setup
##Configure git and download NodeRacer
```
$ ssh-keygen -t rsa -C "youremail@example.com"
$ cat id_rsa.pub | xclip	//add the public key into your gitlab account
$ git config --global user.name "bob"
$ git config --global user.email bob@...
$ git clone git@gitlab.com:xnChang94/nodeav.git NodeRacer
```
##Build NodeRacer
```
$ cd avdetector
$ npm install
```

##Find your Node.js
`$ whereis nodejs`

##Find your Python
`$ whereis python`

## Configure the command of NodeRacer
```
$ cd evaluation
$ vim avd	//modify the path of NODEJS and CMD
```

##Inspect your code
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
