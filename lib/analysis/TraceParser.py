import json
import os
import sys
import pprint
import time
import z3Scheduler
import Logging

logger=Logging.logger

def printDict (dict):
	'''print dict <dict> for debug'''
	#customize indent=4
	pp=pprint.PrettyPrinter(indent=4)
	pp.pprint(dict)
	pass

def printObj (obj):
	'''print object <Object> for debug'''
	print '========object: ', obj
	print 'details: ',  obj.__dict__
	#print 'items: 	', ','.join(['%s:%s' % item for item in obj.__dict__.items()])
	pass

def print_obj_bak (obj, fieldlist):
	#@param obj <instance>
	#@param fieldList <list>: each element in this list is <str>, representing a property of obj

	res=list()
	if obj and fieldlist:
		for i in range(0, len(fieldlist)):
			field=fieldlist[i]
			if hasattr(obj, field):
				res.append(field+':'+obj.field)
		return '{'+', '.join(res)+'}'
	pass

def print_obj (obj, fieldList):

	res=list()
	for prop in obj.__dict__:
		if prop not in fieldList:
			continue
		#print  'prop is: %s (type: %s), obj.__dict__[prop] is: %s (type: %s)' %(prop, type(prop), obj.__dict__[prop], type(obj.__dict__[prop]))
		res.append(str(prop)+':'+str(obj.__dict__[prop]))
	return '{'+', '.join(res)+'}'
	pass

LogEntryType={
	"DECLARE":0,
	"WRITE":1,
	"PUTFIELD":2,
	"READ":10,
	"GETFIELD":11,
	"FUNCTION_ENTER":13,
	"FUNCTION_EXIT":14,
	"ASYNC_INIT":20,
	"ASYNC_BEFORE":21,
	"ASYNC_AFTER":22,
	"ASYNC_PROMISERESOLVE":23,
	"SCRIPT_ENTER":32,
	"SCRIPT_EXIT":33,
	"SOURCE_MAPPING":35,
	"FS_OPEN": 40,
	"FS_READ": 41,
	"FS_WRITE": 42,
	"FS_CLOSE": 43,
	"FS_DELETE": 44,
	"FS_CREATE": 45,
	"FS_STAT": 46,
	0:"DECLARE",
	1:"WRITE",
	2:"PUTFIELD",
	10:"READ",
	11:"GETFIELD",
	13:"FUNCTION_ENTER",
	14:"FUNCTION_EXIT",
	20:"ASYNC_INIT",
	21:"ASYNC_BEFORE",
	22:"ASYNC_AFTER",
	23:"PROMISERESOLVE",
	32:"SCRIPT_ENTER",
	33:"SCRIPT_EXIT",
	35:"SOURCE_MAPPING",
	40: "FS_OPEN",
	41:"FS_READ",
	42: "FS_WRITE",
	43: "FS_CLOSE",
	44: "FS_DELETE",
	45: "FS_CREATE",
	46: "FS_STAT"
}

VarAccessType = {
	"READ":"R",
	"GETFIELD":"R",
	"WRITE":"W",
	"PUTFIELD":"W"
}

FileAccessType = {
	"FS_CREATE": "C",
	"FS_DELETE": "D",
	"FS_READ": "R",
	"FS_WRITE": "W",
	"FS_OPEN": "O",
	"FS_CLOSE": "X",
	"FS_STAT": "S"
}

_fsPattern = {
	"C": ["D", "R", "O", "S"],
	"D": ["C", "R", "W", "O", "X", "S"],
	"R": ["C", "D", "W"],
	"W": ["D", "R"],
	"O": ["C", "D", "X"],
	"X": ["D", "O"],
	"S": ["C", "D"]
}

def isFsRace (rcd1, rcd2):
	'''
	@param <DataAccessRecord>
	@return <Boolean>: to check whether rcd1 and rcd2 form an event race pair
	'''
	if rcd2.accessType in _fsPattern[rcd1.accessType]:
		return True
	else:
		return False
	pass

ResourcePriority_bak={
	#TODO: priority seems insuitable.
	#FSEVENTWRAP, FSREQWRAP, GETADDRINFOREQWRAP, GETNAMEINFOREQWRAP, HTTPPARSER, JSSTREAM, PIPECONNECTWRAP, PIPEWRAP, PROCESSWRAP, QUERYWRAP, SHUTDOWNWRAP, 
	#SIGNALWRAP, STATWATCHER, TCPCONNECTWRAP, TCPWRAP, TIMERWRAP, TTYWRAP, UDPSENDWRAP, UDPWRAP, WRITEWRAP, ZLIB, SSLCONNECTION, PBKDF2REQUEST, RANDOMBYTESREQUEST, 
	#TLSWRAP, Timeout, Immediate, TickObject
	'TickObject':1,
	'Timeout':2,
	'Immediate':2,
	'Other':3
}

ResourcePriority={

	#corresponding to the paper <sementics of asynchronous javascript>
	#TODO: promise
	'TickObject':0,
	'Immediate':1,
	'Timeout':2,
	'Other':3
}

def getPriority(resourceType):
	if(ResourcePriority.has_key(resourceType)):
		return ResourcePriority[resourceType]
	else:
		return ResourcePriority['Other']
	pass

class Callback:

	def __init__ (self, asyncId, prior, resourceType, hbType, lineno):
		self.asyncId=asyncId
		self.prior=prior
		self.resourceType=resourceType
		self.priority=getPriority(resourceType)
		self.hbType=hbType
		self.register=lineno
		self.records=list()
		self.postCbs=dict()
		#store the lineno of start, data accesses, registers, end
		self.instructions=list()
		pass

	'''
	def __init__ (self, start, end, register, prior, hbType, resourceType):
		self.start=start
		self.end=end
		self.register=register
		self.records=list()
		self.prior=prior
		self.hbType=hbType
		self.resourceType=resourceType
		self.priority=ResourcePriority.getPriority(resourceType)
		pass
	'''
	def addStart (self, lineno):
		self.start=lineno
		self.addInstruction(lineno)
		pass

	def addEnd (self, lineno):
		self.end=lineno
		self.addInstruction(lineno)
		pass

	def addRecord (self, rcd):
		self.records.append(rcd.lineno)
		if len(self.records)==1:
			self.location=rcd.location
		self.addInstruction(rcd.lineno)
		pass

	def getCbLoc (self):
		if hasattr(self, 'location'):
			return self.location
		else:
			return 0
		pass

	def addPostCb (self, postCb):
		if postCb.priority not in self.postCbs:
			self.postCbs[postCb.priority]=list()
		#self.postCbs.append(postCb.asyncId)
		self.postCbs[postCb.priority].append(postCb.asyncId)
		pass

	def addInstruction (self, lineno):
		self.instructions.append(lineno)
		pass
		
class CbStack:

	def __init__ (self):
		self.stack=list()
		self.cbs=dict()
		#all data access records are stored in self.records property, indexed by lineno
		self.records=dict()
		self.vars=dict()
		#all file access records are stored in self.files property, indexed by file
		self.files = dict()
		#save callback in initialized order
		self.cbForFile = list()
		pass

	def top (self):
		return self.stack[len(self.stack)-1]
		pass

	def enter (self, cbAsyncId, lineno):
		self.stack.append(cbAsyncId)
		#print 'self.cbs is:'
		#print self.cbs
		if cbAsyncId in self.cbs:
			self.cbs[cbAsyncId].addStart(lineno)
		instruction=StartandEndRecord(cbAsyncId, 'start', lineno)
		self.addDARecord(instruction)
		pass

	def exit (self, asyncId, lineno):
		pop=self.stack.pop()
		if pop == asyncId and asyncId in self.cbs:
			self.cbs[asyncId].addEnd(lineno)
		instruction=StartandEndRecord(asyncId, 'end', lineno)
		self.addDARecord(instruction)
		pass

	def addCb (self, cb):
		#1.save the param cb in self.cbs
		self.cbs[cb.asyncId]=cb
		#2.save the cb.asyncId into its prior cb
		if cb.prior != None and cb.prior in self.cbs:
			self.cbs[cb.prior].addPostCb(cb)
			#note: it is possible for the global script to register callbacks after the script exit
			if not hasattr(self.cbs[cb.prior], 'end'):
				self.cbs[cb.prior].addInstruction(cb.register)
		#3.save cb in initialized order to associate file operation with its cb
		self.cbForFile.append(cb.asyncId)
		pass
	
	def getNewestCb (self):
		# return the asyncId of last initialized callback
		return self.cbForFile[len(self.cbForFile)-1]
		pass
	def addDARecord (self, rcd):
		self.records[rcd.lineno]=rcd
		if isinstance(rcd, DataAccessRecord):
			self.addInVars_new(rcd)
		pass

	def addFileRecord (self, rcd):
		fileId = rcd.getId()
		if not self.files.has_key(fileId):
			self.files[fileId] = list()
		self.files[fileId].append(rcd)
		pass

	def addInVars (self, daRcd):
		#if the variable is accessed by the global script, we ignore it and do not save it
		#if rcd.eid == '1':
			#return

		varId=daRcd.getId()
		if not self.vars.has_key(varId):
			self.vars[varId]={'R': [], 'W': []}
		if 'R'==daRcd.accessType and daRcd.eid not in self.vars[varId]['R']:
			self.vars[varId]['R'].append(daRcd.eid)
		elif 'W'==daRcd.accessType and daRcd.eid not in self.vars[varId]['W']:
			self.vars[varId]['W'].append(daRcd.eid)
		pass

	def addInVars_new (self, daRcd):
		#the new addInVars is to add the lineno of the daRcd into self.vars instead of cb

		varId=daRcd.getId()
		if not self.vars.has_key(varId):
			self.vars[varId]=dict()
			self.vars[varId]['W']=list()
			self.vars[varId]['R']=list()
		if 'R'==daRcd.accessType and daRcd.lineno not in self.vars[varId]['R']:
			self.vars[varId]['R'].append(daRcd.lineno)
		elif 'W'==daRcd.accessType and daRcd.lineno not in self.vars[varId]['W']:
			self.vars[varId]['W'].append(daRcd.lineno)
		pass

class FunStack:
	
	def __init__(self):
		"""
			@stack <list>: store the iid of each function instruction
			@counts <dict>: store the times of each iid (function) is entered, i.e., counts[iid]
			@vars <dict>: store the variables of each iid (function), i.e., vars[iid-times][name]=true/false
		"""
		#set the first element in the self.stack to 0: assume the global script as a function with iid 0
		#self.stack=['0']
		self.stack=[]
		#set the time that the global script is entered is 1
		#self.counts={'0':1}
		self.counts={}
		self.vars={}
		pass
	
	def top(self):
		return self.stack[len(self.stack)-1]
		pass

	def enter(self, iid):
		self.stack.append(iid)
		if not self.counts.has_key(iid):
			self.counts[iid]=0
		self.counts[iid]+=1
		if not self.vars.has_key(self.getId()):
			self.vars[self.getId()]={}
		pass

	def exit(self):
		self.stack.pop()	
		pass

	def getId(self):
		topFunc=self.top()
		return topFunc+'-'+str(self.counts[topFunc])
		pass

	def declare(self, name):
		if not self.vars.has_key(self.getId()):
			return
		if type(name)=='str':
			self.vars[self.getId()][name]=true
		pass

	def isDeclaredLocal(self, name):
		if not self.vars.has_key(self.getId()):
			return False
		return self.vars[self.getId()].has_key(name)
		pass

'''
class CbStack:
	
	@stack <list>: stores the eid of each callback
	@cbs <dict>: cbs[eid]=location, stores the location first record of each execution of a callback, which is used as the location of callback, indexed by eid
	@curCtx <dict>: the object maintaining a dictionary for each eid curCtx[eid] that contains variables curCtx[eid][var] <dir> and records curCtx[eid][rcds] <list>
	@vars <dict>: the dictionary stores variables that callback accesses to, indexed by variable id. For vars[variableId] is also a dictionary, indexed by W & R. vars[variableId][W] is a list, storing cb ids
	
	def __init__(self):
		#set the first element in self.stack to 0 to assume the global script as a callback
		#self.stack=['0']
		self.stack=[]
		self.cbs={}
		#self.curCtx={}
		self.vars={}
		pass

	def top (self):
		#print 'Now the cbCtx.stack is: %s' %(self.stack) 
		return self.stack[len(self.stack)-1]
		pass

	def enter (self, eid):
		self.stack.append(eid)
		self.curCtx[eid]={}
		self.curCtx[eid][var]={}
		self.curCtx[eid][rcds]=[]
		pass

	def exit (self):
		topEid=self.top()
		if not curCtx.has_key(topEid):
			return
		else:
			del curCtx[topEid]
			self.stack.pop()
		self.stack.pop()
		pass
	
	def access (self, rcd):
		if not self.cbs.has_key(rcd.eid):
			self.cbs[eid]=rcd.location
		pass
	
	def getCbLoc (self, rcd):
		if ( rcd != None and self.cbs.has_key(rcd.eid)):
			return self.cbs[rcd.eid]
		pass

	def saveDA (self, dataAccessRcd):
		#if the variable is accessed by the global script, we ignore it and do not save it
		if dataAccessRcd.eid=='0':
			return
		varId=dataAccessRcd.getId()
		if not self.vars.has_key(varId):
			self.vars[varId]={'R':[], 'W':[]}
		if 'R'==dataAccessRcd.accessType and dataAccessRcd.eid not in self.vars[varId]['R']:
			self.vars[varId]['R'].append(dataAccessRcd.eid)
		elif 'W'==dataAccessRcd.accessType and dataAccessRcd.eid not in self.vars[varId]['W']:
			self.vars[varId]['W'].append(dataAccessRcd.eid)
		pass
'''
	
class DataAccessRecord:

	count=0
	#@records <dict> stores all the data accessing records, indexed by iid
	records={}
	#rcdsByScopeName <dict> stores all data accessing records, indexed by identifier scope-name. Each rcdsByScopeName['scope-name']=<list>
	#rcdsByScopeName={}

	def __init__ (self, lineno, entryType, accessType, ref, name, eid, iid):
		self.lineno=lineno
		self.entryType=entryType
		self.accessType=accessType
		self.ref=ref
		self.name=name
		self.eid=eid
		self.iid=iid
		DataAccessRecord.count+=1
		DataAccessRecord.records[iid]=self
		#self.classifyRcd()
		pass

	def getId (self):
		#input: a data accessing record
		#return: the string 'scope@name'
		return self.ref+'@'+self.name

	def classifyRcd (self):
		identifier=self.getId()
		if not DataAccessRecord.rcdsByScopeName.has_key(identifier):
			DataAccessRecord.rcdsByScopeName[identifier]=[] 
		DataAccessRecord.rcdsByScopeName[identifier].append(self)
		pass

	def toString (self):
		return print_obj(self, ['lineno', 'location', 'cbLoc', 'iid', 'accessType', 'logEntryType', 'ref', 'name', 'eid', 'etp'])
		pass

class FileAccessRecord:

	def __init__ (self, lineno, entryType, accessType, resource, ref, name, eid, location, isAsync):
		self.lineno = lineno
		self.entryType = entryType
		self.accessType = accessType
		self.resource = resource
		self.ref = ref
		self.name = name
		self.eid = eid
		self.location = location
		self.isAsync = isAsync
		pass

	def getId (self):
		return self.resource
		pass

	def toString (self):
		return print_obj(self, ['lineno', 'entryType', 'accessType', 'resource', 'ref', 'name', 'eid', 'location', 'isAsync'])
		pass

class StartandEndRecord:

	def __init__ (self, asyncId, insType, lineno):
		self.asyncId=asyncId
		self.type=insType
		self.lineno=lineno
		pass

class FileCbStack:

	def __init__ (self):
		self.stack = list()
		pass

	def push (self, fileOp):
		print "Before push self.stack is: "
		print self.stack
		self.stack.append()
		print "After push self.stack is: "
		print self.stack
		pass

	def pop (self):
		print "Before pop self.stack is: "
		print self.stack
		return self.stack.pop()
		pass

	def top (self):
		print "In top self.stack is: "
		print self.stack
		return self.stack[len(self.stack)-1] 
		pass

def processLine (line):

	#@param line <str>: each line in the trace file
	
	#print "content: %s" %(line)
	global lineno
	global sourceMap
	global currentSourceFile
	global funCtx
	global cbCtx
	#global records

	lineno+=1
	record=None
	if line:
		#print '======line is: %s\n' %(line)
		item=line.split(",");
		itemEntryType=item[0]
		#print '     lineno is: %d\n     itemEntryType is: %s\n     ' %(lineno, itemEntryType)
		if type(itemEntryType)!="int":
			itemEntryType=int(itemEntryType)
		if not LogEntryType.has_key(itemEntryType):
			return
		itemEntryTypeName=LogEntryType[itemEntryType]
		if VarAccessType.has_key(itemEntryTypeName):
			#print '=====lineno is: %d' % lineno
			record=DataAccessRecord(lineno, itemEntryTypeName, VarAccessType[itemEntryTypeName], item[2], item[3], cbCtx.top(), item[1])
			#logger.debug('record.eid is: %s' %(record.eid))
			#cbCtx.saveDA(record)
			#cbCtx.cbs[cbCtx.top()].addRecord(record)
			#cbCtx.addDARecord(record)
		elif FileAccessType.has_key(itemEntryTypeName):
			#To reduce the size of trace file, isAsync is recorded as 1 or 0
			if item[6] == 1:
				isAsync = True
			else:
				isAsync = False
			record = FileAccessRecord(lineno, itemEntryTypeName, FileAccessType[itemEntryTypeName], item[1], item[2], item[3], cbCtx.top(), item[5], isAsync)
			#print print_obj(record,['isAsync'])
			#associate asynchronous file operation with its callback
			#print record.isAsync
			if record.isAsync == True:
				#fileCtx.push(record)
				#associate asynchronous file operation with its callback
				record.cb = cbCtx.getNewestCb()	
		elif itemEntryType==LogEntryType["ASYNC_INIT"]:
			#record=HappensBeforeRecord(lineno, item[1], item[3], 'register', item[2])
			#constraints.append(Constraint(item[1], item[3]))
			cb=Callback(item[1], item[3], item[2], 'register', lineno)
			cbCtx.addCb(cb)
		elif itemEntryType==LogEntryType["ASYNC_BEFORE"]:
			#logger.debug('enter the cb-%s' %(item[1]))
			#logger.debug('current cbs is: ')
			#print cbCtx.cbs
			cbCtx.enter(item[1], lineno)
			#cbCtx.cbs[item[1]].addStart(lineno)
			'''
			if item[1] in cbCtx.cbs:
				cbCtx.cbs[item[1]].addStart(lineno)
			instruction=StartandEndRecord(item[1], 'start', lineno)
			cbCtx.addDARecord(instruction)
			'''
		elif itemEntryType==LogEntryType["ASYNC_AFTER"]:
			cbCtx.exit(item[1], lineno)
			#cbCtx.cbs[item[1]].addEnd(lineno)
			'''
			if item[1] in cbCtx.cbs:
				cbCtx.cbs[item[1]].addEnd(lineno)
			instruction=StartandEndRecord(item[1], 'end', lineno)
			cbCtx.addDARecord(instruction)
			'''
		elif itemEntryType==LogEntryType["ASYNC_PROMISERESOLVE"]:
			#record=HappensBeforeRecord(lineno, item[1], item[2], 'resolve','RESOLVE')
			#constraints.append(Constraint(item[1], item[2]))
			cb=Callback(item[1], item[2], 'RESOLVE', 'resolve', lineno)
			cbCtx.addCb(cb)
		elif itemEntryType==LogEntryType["SCRIPT_ENTER"]:
			currentSourceFile=item[3]
			#register: assume asyncId='0', prior=None, hbType='register', resourceType='GLOBALCB' but no constraint
			#note: asyncId is '1' rather than '0' in order to be the same with the prior cb of callbacks the glocal script registers
			#record=HappensBeforeRecord (lineno, '0', None, 'register', 'GLOBALCB')
			cb=Callback('1', None, 'GLOBALCB', 'register', lineno)
			cbCtx.addCb(cb)
			#printObj(cb)
			#before: assume eid='0'
			#cbCtx.enter('0')
			#to make each instruction has a unique lineno
			lineno=lineno+1
			cbCtx.enter(cb.asyncId, lineno)
			#function_enter
			#lineno=lineno+1
			funCtx.enter(item[1])
		elif itemEntryType==LogEntryType["SCRIPT_EXIT"]:
			#cb after
			cbCtx.exit('1', lineno)
			#TODO: add function exit
		elif itemEntryType==LogEntryType["SOURCE_MAPPING"]:
			lst=[currentSourceFile]
			#lst.append(item[2:6])
			sourceMap[item[1]]=lst+item[2:6]
		elif itemEntryType==LogEntryType["FUNCTION_ENTER"]:
			funCtx.enter(item[1])
		elif itemEntryType==LogEntryType["FUNCTION_EXIT"]:
			funCtx.exit()
		elif itemEntryType==LogEntryType["DECLARE"]:
			#print 'DECLARE item[3] is: %s' %(item[3])
			funCtx.declare(item[3])

	#add following information for each data accessing record: location, isDeclaredLocal, etp and cbLoc
	if isinstance(record, DataAccessRecord) or isinstance(record, FileAccessRecord):
		#location
		conj='#'
		#print 'sourceMap[record.%s] is: %s\n' %(record.iid, sourceMap[record.iid])
		if not hasattr(record, 'location'):
			record.location=conj.join(sourceMap[record.iid])
		#isDeclaredLocal
		record.isDeclaredLocal=funCtx.isDeclaredLocal(record.name)
		#etp/TODO
		#env=RegisterRecord.records[record.eid] if RegisterRecord.records.has_key(record.eid) else ResolveRecord.records[record.eid]
		#env=HappensBeforeRecord.records[record.eid] if HappensBeforeRecord.records.has_key(record.eid) else None
		#print 'record.eid is: %s' %(record.eid)
		env=cbCtx.cbs[record.eid]
		#print 'env is:'
		#printObj(env)
		record.etp=env.resourceType if env else None
		#cbLoc
		cbLoc=env.getCbLoc()
		record.cbLoc=cbLoc if cbLoc else record.location
		#record.cbLoc=cbCtx.cbs[cbCtx.top()].getCbLoc()
	
		if isinstance(record, DataAccessRecord):
			cbCtx.addDARecord(record)
			cbCtx.cbs[cbCtx.top()].addRecord(record)
		else:
			cbCtx.addFileRecord(record)
			cbCtx.cbs[cbCtx.top()].addRecord(record)
	pass

def processTraceFile (traceFile):

	'''
	@param traceFile <str>: the trace file to be parsed
	@return result <dict>: stores the collection of records (start/end, data access, register/resolve) <dict> indexed by lineno, cbs <dict> indexed by asyncId, cbsByPriority <dict> indexed by priorAsyncId
	'''
	#TODO: add python stdout 
	print "======Begin to parse the trace file %s" %(traceFile)

	with open(traceFile) as f:
		line=f.readline()
		while line:
			processLine(line.strip())
			line=f.readline()

	'''
	with open(traceFile) as f:
		lines=f.readline()
		for line in lines:
			#remove the blank at the begin and end of each line
			line=line.strip()
			processLine(line)
	'''

	result=dict()
	#result['dataAccessRecord']=DataAccessRecord.rcdsByScopeName
	#allRecords['registerRecord']=RegisterRecord.records
	#allRecords['resolveRecord']=ResolveRecord.records
	#result['HappensBeforeRecord']=HappensBeforeRecord.records
	#result['constraints']=constraints
	#result['cbs']=cbCtx.vars
	result['cbs']=cbCtx.cbs
	result['records']=cbCtx.records
	result['vars']=cbCtx.vars
	result['files'] = cbCtx.files
	return result
	pass

def main():
	traceFile=sys.argv[1]
	if sys.argv[2] == 't':
		isRace=True 
	else:
		isRace=False
	if sys.argv[3] == 't':
		isChain = True
	else:
		isChain = False
	#step 1: parse record into object
	parsedResult=processTraceFile(traceFile)
	#print parsedResult
	#remove the variable that accessed by less than 3 callbacks
	'''
	for varId in parsedResult['cbs'].keys():
		#print '===process the variable %s' % varId
		#print 'len(parsedResult[\'cbs\'][varId][\'R\']) is: %d' %len(parsedResult['cbs'][varId]['R'])
		#print 'len(parsedResult[\'cbs\'][varId][\'W\']) is: %d' %len(parsedResult['cbs'][varId]['W'])
		if len(parsedResult['cbs'][varId]['R'])+len(parsedResult['cbs'][varId]['W'])<3:
			del parsedResult['cbs'][varId]
	'''
	#logger.debug("Here are parsed cbs:")
	'''
	print 'Here are parsed cbs:'
	for cb in parsedResult['cbs'].values():
		printObj(cb)
	'''
	'''
	#logger.debug("Here are parsed records:")
	print 'Here are parsed records:'
	for daRcd in parsedResult['records'].values():
		printObj(daRcd)
	'''
	'''
	print 'Here are parsed variables:'
	for var in parsedResult['vars'].keys():
		print '<%s>:\nW:%s\nR:%s\n' %(var, parsedResult['vars'][var]['W'], parsedResult['vars'][var]['R'])
	'''
	#step 2: find the nearest happens-before relation among callbacks
	#z3Scheduler.buildConstraints (parsedResult)
	#z3Scheduler.startDebug(parsedResult)
	z3Scheduler.startDebug(parsedResult, isRace, isChain)
	pass

lineno=-1
sourceMap={}
currentSourceFile=None
funCtx=FunStack()
cbCtx=CbStack()
#records=dict()
fileCtx = FileCbStack()

if __name__=="__main__":
	main()
	pass
