import sys
import os
import re
import TraceParser
import Logging
import pprint
import time

logger=Logging.logger
#print_obj = TraceParser.print_obj

rootPath=os.path.dirname(os.path.realpath(__file__))
z3path=rootPath+'/z3py/bin/python/z3'
print z3path
sys.path.append(z3path)

import __builtin__
__builtin__.Z3_LIB_DIRS=[rootPath+'/z3py/bin']

import z3

def print_obj (obj, fieldList):
	res=list()
	for prop in obj.__dict__:
		if prop not in fieldList:
			continue
		res.append(str(prop)+':'+str(obj.__dict__[prop]))
	return '{'+', '.join(res)+'}'
	pass

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

class Report:

	def __init__ (self, pattern, daRcd1, daRcd2, daRcd3):
		#daRcd1, daRcd2 are consecutively executed

		self.pattern=pattern
		self.triple=[daRcd1, daRcd2, daRcd3]
		self.footprint=self.triple[0].cbLoc+'->'+self.triple[1].cbLoc+'->'+self.triple[2].cbLoc
		self.equivalent=list()
		self.ref=daRcd1.ref
		self.name=daRcd1.name
		pass

	def isEqual (self, otherReport):
		if not otherReport:
			return False
		return self.footprint==otherReport.footprint

	def toString (self, detail=False):
		res=self.footprint+':'+self.pattern+'\n'
		#res+='\n'.join(self.triple)
		for i in range(0,3):
			res+='\n'+self.triple[i].toString()
		#if detail:
		return res

	def printout (self):
		print '*******************This Triple object is:'
		print 'rcd1: '
		printObj(self.rcd1)
		print 'rcd2: '
		printObj(self.rcd2)
		print 'rcd3: '
		printObj(self.rcd3)
		#wensheng: There are some syntax errors here.
		pass

class Race:

	#def __init__ (self, pattern, rcd1, rcd2''', chain1, chain2'''):
	def __init__ (self, pattern, rcd1, rcd2):
		self.pattern=pattern
		self.tuple=[rcd1, rcd2]
		self.footprint=self.tuple[0].cbLoc+' vs. '+self.tuple[1].cbLoc
		self.location=self.tuple[0].location+' vs. '+self.tuple[1].location
		if isinstance(rcd1, TraceParser.DataAccessRecord):
			self.ref=rcd1.ref
			self.name=rcd1.name
		if isinstance(rcd1, TraceParser.FileAccessRecord):
			self.ref = 'file'
			self.name = rcd1.resource
		#self.chain1 = chain1
		#self.chain2 = chain2
		pass

	def isEqual_bak (self, otherRace):
		if not otherRace:
			return False
		#if self.footprint == otherRace.footprint:
			#return True
		if (self.tuple[0].lineno == otherRace.tuple[1].lineno and self.tuple[1].lineno == otherRace[0].lineno) or (self.tuple[0].lineno == otherRace.tuple[0].lineno and self.tuple[1].lineno == otherRace[1].lineno):
			return True
		return False

	def toString (self, detail=False):

		res=self.footprint+':'+self.pattern+'\n'
		for i in range(0, 2):
			res+='\n'+self.tuple[i].toString()
		return res
	
	#wensheng: Syntax errors in this function.
	def chainToString (self):
		print self.chain1
		res = '======chain[1]=====\n'
		for item in self.chain1:
			res += item + ' -> '
		res += '\n'

		res += '======chain[2]=====\n'
		for item in self.chain1:
			res += item + ' -> '
		res += '\n'
		return res

_fsPattern = {
	"C": ["C", "D", "R", "W","O", "S"],
	"D": ["C", "R", "W", "O", "X", "S"],
	"R": ["C", "D", "W"],
	"W": ["D", "R", "X", "C"],
	"O": ["C", "D", "X"],
	"X": ["D", "O", "X"],
	"S": ["C", "D"] 
}

class Scheduler:

	def __init__ (self, parsedResult):
		print("Hello")
		self.solver=z3.Solver()
		self.solver.set('timeout', 5000)
		self.grid=dict()
		self.cbs=parsedResult['cbs']
		#print("debug-new scheduler: %s" %(print_obj(self.cbs['39'], ['records'])))
		self.records=parsedResult['records']
		self.variables=parsedResult['vars']
		self.files = parsedResult['files']
		self.testsuit = parsedResult['testsuit']
		self.reports=list()
		#self.candidates = list()
		self.races=list()
		self.racy_event_pair_cache = list()
		self.racy_location_cache = dict()
		self.test_file_name = list()
		self.test_file_name.append("Store.spec_orig_.js")
		self.consNumber = 0
		print("Op number: %s" %(len(self.records)))
		print("Event num: %s" %(len(self.cbs)))
		pass
	
	def empty_constraints (self):
		#self.solver.reset()
		self.solver = None
		self.solver = z3.Solver()
		self.solver.set('timeout', 5000)
		pass
		
	def filterCbs (self):
		cbs=self.cbs
		#print cbs
		'''
		for cb in cbs.values():
			print cb.asyncId
			printObj(cb)
		'''
		#To capture the callback chain for file operations, we cannot remove callbacks that have no records
		#remove cb that has not start
		'''	
		for cb in cbs.values():
			#if len(cb.records)>0:
				#continue
			
			if hasattr(cb, 'start'):
				continue
			print("debug-filter: %s" %(print_obj(cb, ['asyncId', 'prior', 'register'])))
			print(cb.records)	
			if cb.prior and cb.prior in cbs and cbs[cb.prior]:
				#1. remove it in its prior cb 's postCbs
				for cbList in cbs[cb.prior].postCbs.values():
					if cb.asyncId in cbList:
						cbList.remove(cb.asyncId)
						break
				#2. remove it in its register in prior cb 's instructions 
				print("cb.prior.records: %s" %(cbs[cb.prior].records))
				
				register = str(cb.register) + 'r'
				resolve = register + 'r'
				print("register: %s" %(register))
				print('\n')
				cbs[cb.prior].records.remove(register)
				cbs[cb.prior].records.remove(resolve)
				#if cb.register in cbs[cb.prior].instructions:
					#cbs[cb.prior].instructions.remove(cb.register)
			#3. remove it in cbs
			del cbs[cb.asyncId]
		'''
		#if a callback list in prior.postCbs is empty, remove it
		for cb in cbs.values():
			for priority in cb.postCbs.keys():
				if len(cb.postCbs[priority])==0:
					del cb.postCbs[priority]
		#if the postCbs in its prior is empty, remove it
		for cb in cbs.values():
			if not cb.postCbs:
				del cb.postCbs
		self.cbs=cbs
	
		self.event_num = len(self.cbs)
		print("^^^^^^^^^SIZE^^^^^^^^^^^:\nEvent number: %s\n" %(self.event_num))
		pass

	def createOrderVariables (self):
		print('^^^^^^CREATE ORDER VARIABLE^^^^^^')
		count = 0
		#print("debug-create: 346 %s" %('346' in self.cbs))	
		#print(print_obj(self.cbs['346'], ['register', 'start', 'end']))
		for cb in self.cbs.values():	
			if hasattr(cb, 'start'):	
				self.grid[cb.start]=z3.Int('Instruction_for_%s' %(cb.start))
				count += 1
				#self.solver.add(self.grid[cb.start]>0)
			if hasattr(cb, 'end'):	
				self.grid[cb.end]=z3.Int('Instruction_for_%s' %(cb.end))
				count += 1
				#self.solver.add(self.grid[cb.end]>0)
			#create order variable for register op
			self.grid[str(cb.register) + 'r'] = z3.Int('Instruction_for_%s' %(str(cb.register) + 'r'))
			#create order variable for resolve op
			self.grid[str(cb.register) + 'rr'] = z3.Int('Instruction_for_%s' %(str(cb.register) + 'rr'))
			#self.grid[cb.register]=z3.Int('Instruction_for_%s' %(cb.register)) 
		'''
			#print("^^^debug: %s" %('39' in self.cbs))
			#if cb.asyncId == '39':
				#print("debug: %s" %(print_obj(cb, ['records'])))
			for lineno in cb.records:
				self.grid[lineno]=z3.Int('Instruction_for_%s' %(lineno))
				count += 1
				#self.solver.add(self.grid[lineno]>0)
		'''
		#create order variable for resource accessing op
		#print("debug-create: %s" %(len(self.records)))
		for rcdLineno in self.records:
			#skip register and resolve op because we have already create them above
			if isinstance(self.records[rcdLineno], TraceParser.Reg_or_Resolve_Op):
				continue
			self.grid[rcdLineno] = z3.Int('Instruction_for_%s' %(rcdLineno))
			count += 1
			#self.solver.add(self.grid[rcdLineno] > 0)
		self.order_variable_num = count

		print("Variable number: %s\n" %(self.order_variable_num))
		print("after create: %s" %(self.check()))
		pass

	def addDistinctConstraint (self):
		self.solver.add(z3.Distinct(self.grid.values()))	
		print("after distinct: %s" %(self.check()))
		pass
	
	def rm_sync_access_op (self):
		'''
		for rcd in self.records.values():
			print("[%s]: var: %s, file: %s" (rcd.lineno, isinstance(rcd, TraceParser.DataAccessRecord), isinstance(rcd, TraceParser.FileAccessRecord)))
		'''	
		print("^^^^^^^^^^^remove^^^^^^^^^^^^^")	
		for cb in self.cbs.values():
			#if cb.asyncId == '39':
				#print("debug-rm: %s" %(print_obj(cb, ['records'])))
			if len(cb.records) == 0:
				continue	
			#print(print_obj(cb, ['start', 'end', 'records']))
			#print('--------Before remove sync rcdList is:')
			#print(cb.records)
			#print('\n')
			rcdList = cb.records
			sync_op = [x for x in rcdList if isinstance(self.records[x], TraceParser.DataAccessRecord)]
			sync_op_index = [rcdList.index(x) for x in rcdList if isinstance(self.records[x], TraceParser.DataAccessRecord)]
			print("1. sync_op: %s" %(sync_op))
			print("1. sync_op_index: %s" %(sync_op_index))
			
			for i in range(0, len(sync_op_index) - 1):
				print("i: %s" %(i))
				if sync_op_index[i] == sync_op_index[i + 1] - 1:
					continue
				else:
					del sync_op[i]
			
			if len(sync_op) > 0:
				if isinstance(self.records[sync_op[-1]], TraceParser.DataAccessRecord):
					sync_op.pop()
			
			print("2. sync_op: %s" %(sync_op))
			print("2. sync_op_index: %s" %(sync_op_index))
			for i in range(len(rcdList) - 1, -1, -1):
				if rcdList[i] in sync_op:
					rcdList.pop(i)

			cb.records = rcdList
			#print('--------After remove sync rcdList is:')
			#print(cb.records)
			#print('\n')
		pass
	
	def add_atomicity_constraint (self, consider = None):
		count = 0
		start = time.time()
		for cb in self.cbs.values():
			#deal with a single test case
			if consider != None and cb.asyncId not in consider:
				continue
			if not hasattr(cb, 'start'):
				continue
			if len(cb.records) == 0:
				continue
			#print("\n-----cb.records: %s" %(print_obj(cb, ['start', 'asyncId'])))
			#print(cb.records)
			#print("=====debug-ato: asyncId %s" %(cb.asyncId))
			#print(cb.records)
			#1st atomicity cons: every callback cannot be interrupted
			i = 0
			j = i + 1
			self.solver.add(self.grid[cb.start] == self.grid[cb.records[i]] - 1)
			count += 1
			#print("1. Atomicity: %s == %s - 1" %(cb.start, cb.records[i]))
			while i < len(cb.records) - 1 and j < len(cb.records):
				#skip async file op and resolve op and var access (because we do not use the rm_sync_op function)
				if isinstance(self.records[cb.records[j]], TraceParser.FileAccessRecord) and self.records[cb.records[j]].isAsync == True or type(cb.records[j]) == str and re.search('rr', cb.records[j]) or isinstance(self.records[cb.records[j]], TraceParser.DataAccessRecord):
					j += 1
				else:
					#print("debug-ato: i %s" %(cb.records[i] in self.grid))
					#print("debug-ato: j %s" %(cb.records[j] in self.grid))
					self.solver.add(self.grid[cb.records[i]] == self.grid[cb.records[j]] - 1)
					count += 1
					#print("2. Atomicity: %s == %s - 1" %(cb.records[i], cb.records[j]))
					i = j
					j += 1
			if not hasattr(cb, 'end'):
				continue
			last = None
			for i in range(len(cb.records)-1, -1, -1):
				if isinstance(self.records[cb.records[i]], TraceParser.Reg_or_Resolve_Op) and re.search('rr', cb.records[i]) or isinstance(self.records[cb.records[i]], TraceParser.FileAccessRecord) and self.records[cb.records[i]].isAsync == True:
					continue
				else:
					last = i
					break
			self.solver.add(self.grid[cb.records[last]] == self.grid[cb.end] - 1)
			count += 1
			#print("3. Atomicity: %s == %s - 1" %(cb.records[last], cb.end))
		#count = 0
		#print("debug-ato: cbs num %s " %(len(self.cbs)))
		print("after atomicity: %s, num: %s" %(self.check(), count))	
		#2nd atomicity constraint
	
		asyncIds = self.cbs.keys()
		cb_num = len(asyncIds)
		for i in range(0, cb_num - 1):
			#count += 1
			#print("debug-ato: cbi num %s" %(count))
			#deal with a single test case 
			if consider != None and asyncIds[i] not in consider:
				continue
			cbi = self.cbs[asyncIds[i]]
			if not hasattr(cbi, 'start') or not hasattr(cbi, 'end'):
				continue
			for j in range(i + 1, cb_num):
				#deal with a single test case 
				if consider != None and asyncIds[j] not in consider:
					continue
				if i == j:
					continue
				cbj = self.cbs[asyncIds[j]]
				if not hasattr(cbj, 'start') or not hasattr(cbj, 'end'):
					continue
				self.solver.add(z3.Or(self.grid[cbi.end] < self.grid[cbj.start], self.grid[cbi.start] > self.grid[cbj.end]))
				count += 1
				#print("debug-ato: %s" %(count))
				#print("4. Atomicity: %s < %s or %s > %s" %(cbi.end, cbj.start, cbi.start, cbj.end))
		end = time.time()
		interval = str(round(end - start))
		print("after atomicity: %s, num: %s, time: %s" %(self.check(), count, interval))
		pass
	
	def printConstraint (self, consName, lineno_1, lineno_2):
		print consName.upper() + ': ' + str(lineno_1) + ' < ' + str(lineno_2)
		pass

	def printCbCons (self, consName, cb_1, cb_2):
		print consName.upper() + ': ' + str(cb_1) + ' < ' + str(cb_2)
		pass		

	def add_reg_and_resolve_constraint (self, consider = None):
		start = time.time()
		count = 0
		for cb in self.cbs.values():
			#deal with a single test case 
			if consider != None and cb.asyncId not in consider:
				continue
			if not hasattr(cb, 'start'):
				continue
			registerLine = str(cb.register) + 'r'
			resolveLine = registerLine + 'r'
			start = cb.start
			#1st cons: register = resolve - 1  for nextTick, immediate, promise event. 'RESOLVE' is the promise event
			if cb.resourceType in ['TickObject', 'RESOLVE', 'Immediate']:
				self.solver.add(self.grid[registerLine] == self.grid[resolveLine] - 1)
				count += 1
			else:
				self.solver.add(self.grid[registerLine] < self.grid[resolveLine])
				count += 1
			#2nd cons: resolve < start
			self.solver.add(self.grid[resolveLine] < self.grid[start])
			count += 1
		end = time.time()
		interval = str(round(end - start))
		print("after r&r: %s, num: %s, time: %s" %(self.check(), count, interval))
		pass
	
	def add_file_constraint (self, consider = None):
		start = time.time()
		count = 0
		async_fs_num = 0
		for cb in self.cbs.values():
			#deal with a single test case 
			if consider != None and cb.asyncId not in consider:
				continue
			rcdLinenos = cb.records
			for lineno in rcdLinenos:
				rcd = self.records[lineno]
				if isinstance(rcd, TraceParser.FileAccessRecord) and rcd.isAsync == True:	
					print('\n')
					print(print_obj(rcd, ['lineno', 'isAsync', 'register', 'resolve', 'cb']))
					#constraint 1: asynchronous file operation happens after the register of cb
					#print("register: %s"  %(rcd.register))
					#print(rcd.register in self.grid)
					async_fs_num += 1
					resolve = rcd.resolve
					register = resolve[:-1]
					self.solver.add(self.grid[register] < self.grid[rcd.lineno])
					count += 1
					#print("1. file: %s < %s" %(rcd.register, rcd.lineno))	
					#constraint 2: asynchronous file operation happens before the resolve of callback
					self.solver.add(self.grid[rcd.lineno] < self.grid[resolve])
					count += 1
					#print("2. file: %s < %s" %(rcd.lineno, rcd.resolve))	
		end = time.time()
		interval = str(round(end - start))
		print("after file_cons: %s cons_num: %s async_fs_num: %s, time: %s" %(self.check(), count, async_fs_num, interval))
		pass
	
	def fifo (self, consider = None):
		start = time.time()
		count = 0	
		cb_num = len(self.cbs)
		asyncIds = self.cbs.keys()
		for i in range(0, cb_num - 1):
			cbi = self.cbs[asyncIds[i]]
			#deal with a single test case 
			if consider != None and cbi.asyncId not in consider:
				continue
			if not hasattr(cbi, 'start'):
				continue
			triggeri = str(cbi.register) + 'rr'
			for j in range(i+1, cb_num):
				cbj = self.cbs[asyncIds[j]]
				#deal with a single test case 
				if consider != None and cbj.asyncId not in consider:
					continue
				if cbj.priority != cbi.priority:
					continue
				if not hasattr(cbj, 'start'):
					continue
				triggerj = str(cbj.register) + 'rr'
				self.solver.add(z3.Or(z3.And(self.grid[triggeri] < self.grid[triggerj], self.grid[cbi.start] < self.grid[cbj.start]), z3.And(self.grid[triggeri] > self.grid[triggerj], self.grid[cbi.start] > self.grid[cbj.start])))
				count += 1
		end = time.time()
		interval = str(round(end - start))
		print("after fifo: %s num: %s, time: %s" %(self.check(), count, interval))
		pass

	def diffQ (self, consider = None):
		start = time.time()
		count = 0
		cb_num = len(self.cbs)
		asyncIds = self.cbs.keys()	
		for i in range(0, cb_num - 1):
			cbi = self.cbs[asyncIds[i]]
			#deal with a single test case 
			if consider != None and cbi.asyncId not in consider:
				continue	
			if cbi.priority != 1:
				continue
			if not hasattr(cbi, 'start'):
				continue
			triggeri = str(cbi.register) + 'rr'
			starti = cbi.start
			for j in range(i+1, cb_num):
				cbj = self.cbs[asyncIds[j]]
				#deal with a single test case 
				if consider != None and cbj.asyncId not in consider:
					continue
				if cbj.priority == 1:
					continue
				if not hasattr(cbj, 'start'):
					continue
				triggerj = str(cbj.register) + 'rr'
				startj = cbj.start
				count += 1
				self.solver.add(z3.Implies(self.grid[triggeri] < self.grid[startj], self.grid[starti] < self.grid[startj]))	
		end = time.time()
		interval = str(round(end - start))
		print("after diffQ: %s num: %s, time: %s" %(self.check(), count, interval))
		pass

		'''
	def reorder (self, lineno1, lineno2):
		# only exist one happens before another, it is happens-before relation. Otherwise, it is concurrency relation.
		#@param daRcd: the lineno that represents the data access record
		#@return <str>/<list>: 'Concurrent'. <list>: the first element is prior.

		res=None
		self.solver.push()
		self.solver.add(self.grid[lineno1]<self.grid[lineno2])
		if self.check():
			self.solver.pop()
			self.solver.add(self.grid[lineno1]>self.grid[lineno2])
			if self.check():
				#rcd1<rcd2 and rcd2<rcd1: concurrent
				res='Concurrent'
			else:
				#rcd1<rcd2 but rcd2!<rcd1: rcd1 happens before rcd2
				res=[lineno1, lineno2]
			self.solver.pop()
		else:
			self.solver.pop()
			self.solver.add(self.grid[lineno1]>self.grid[lineno2])
			if self.check():
				res=[lineno2, lineno1]
			self.solver.pop()
		return res
		pass

	def isConcurrent (self, lineno1, lineno2):
		return isinstance(reorder(lineno1, lineno2), str)
		pass
   
		'''
	def happensBefore (self, lineno1, lineno2):
		
		#print '^^^^^^^^^^in happensBefore: %s, %s' %(lineno1, lineno2)
		if self.records[lineno1].eid==self.records[lineno2].eid:
			return False
		self.solver.push()
		self.solver.add(self.grid[lineno1]<self.grid[lineno2])
		res=self.check()
		self.solver.pop()
		print '1. res is: %s' %(res)
		if not res:
			return False
		self.solver.push()
		self.solver.add(self.grid[lineno2]<self.grid[lineno1])
		res=self.check()
		print '2. res is: %s' %(res)
		self.solver.pop()
		if res:
			return False
		else: 
			return True
		pass

	def cbHappensBefore (self, cb1, cb2):
		if cb1 == None or cb2 == None or cb1 == cb2:
			return False
		
		earlier = cb1 if cb1.start < cb2.start else cb2
		later = cb2 if cb1.start < cb2.start else cb1

		self.solver.push()
		self.solver.add(self.grid[earlier.start] > self.grid[later.start])
		res = self.check()
		self.solver.pop()
		if res:
			return False
		else:
			return True
		pass

	def isConcurrent_new__1_bak (self, lineno1, lineno2):	
		#print("before all: %s" %(self.check()))
		
		self.solver.push()
		self.solver.add(self.grid[lineno1]<self.grid[lineno2])
		res=self.check()
		#print("%s<%s: %s" %(lineno1, lineno2, res))
		self.solver.pop()
		if not res:
			#print("NOT 1<2")
			return False
		self.solver.push()
		self.solver.add(self.grid[lineno2]<self.grid[lineno1])
		res=self.check()
		#print("%s>%s: %s" %(lineno1, lineno2, res))
		self.solver.pop()
		if not res:
			#print("NOT 1>2")
			return False
		else:
			return True
		pass	

	def isConcurrent_new_1 (self, lineno1, lineno2):
		#print("before all: %s" %(self.check()))
		earlier = lineno1 if lineno1 < lineno2 else lineno2
		later = lineno2 if lineno1 < lineno2 else lineno1
		
		#print("already know %s happens before %s" %(earlier, later))
		self.solver.push()
		self.solver.add(self.grid[earlier] > self.grid[later])
		#self.addDistinctConstraint()
		res = self.check()
		#print("solver: %s happens before %s is %s" %(later, earlier, res))
		self.solver.pop()
		if res:
			return True
		else:
			return False
		pass

	def addW_W_RPattern (self):

		#/TODO: it is possible in the trace w2 happens before w1, but in infered execution w2 can happen before w1?
		for var in self.variables:
			RList=self.variables[var]['R']
			WList=self.variables[var]['W']
			if len(RList)+len(WList)<3:
				continue
			for i in range(0, len(WList)-1):
				print '*******************current var is: %s' %(var)
				self.solver.push()
				self.solver.add(self.grid[WList[i]]<self.grid[WList[i+1]])
				self.solver.push()
				for j in range(0, len(RList)):
					self.solver.add(self.grid[WList[i+1]]<self.grid[RList[j]])
					res=self.check()
					print '*******************res is: %s' %(res)
					if res:
						triple=Triple(self.records[WList[i]], self.records[RList[j]], self.records[WList[i+1]])
						self.reports.append(triple)
					self.solver.pop()
				self.solver.pop()
		pass

	def addW_W_RPattern_new (self):

		for var in self.variables:
			RList=self.variables[var]['R']
			WList=self.variables[var]['W']
			if len(RList)+len(WList)<3 or len(RList)==0 or len(WList)==0:
				continue
			print '*****************current var is: %s' %(var)
			for i in range(0, len(WList)):
				for j in range(0, len(WList)):
					if i==j:
						continue
					self.solver.push()
					self.solver.add(self.grid[WList[i]]<self.grid[WList[j]])
					for k in range(0, len(RList)):
						self.solver.push()
						self.solver.add(self.grid[WList[j]]<self.grid[RList[k]])
						res=self.check()
						print '*****************res is: %s' %(res)
						if res:
							triple=Triple(self.records[WList[i]], self.records[RList[k]], self.records[WList[j]])
							self.reports.append(triple)
							print '*****************solver is: %s' %(self.solver)
							triple.printout()
							print '*************A schedule:\n'
							self.printScheduleResult()
						self.solver.pop()
					self.solver.pop()
		pass

	def addW_W_RPattern_new_2 (self):

		for var in self.variables:
			RList=self.variables[var]['R']
			WList=self.variables[var]['W']
			if len(RList)==0 or len(WList)==0 or len(RList)+len(WList)<3:
				continue
			#print '*******************current var is: %s' %(var)
			for i in range(0, len(WList)):
				for j in range(0, len(RList)):
					#print '**********1. W: %s, R: %s' %(WList[i], RList[j])
					#print 'i happens before j??? %s' %(self.happensBefore(WList[i], RList[j]))
					if not self.happensBefore(WList[i], RList[j]):
						continue
					#Now, WList[i] happens before RList[j]. Find another W access, which is concurrent with WList[i] or RList[j]
					#print  '**************Find a W and R happens before! W: %s, R: %s' %(WList[i], RList[j])
					for k in range(0, len(WList)):
						if k==i:
							continue
						#print '**************isConcurrent_new(WList[i], WList[k]) is: %s' %(self.isConcurrent_new_1(WList[i], WList[k]))
						#print '**************isConcurrent_new(WList[k], RList[j]) is: %s' %(self.isConcurrent_new_1(WList[k], RList[j]))
						if self.isConcurrent_new_1(WList[i], WList[k]) or self.isConcurrent_new_1(WList[k], RList[j]):
							#print 'create a triple'
							#triple=Triple(self.records[WList[i]], self.records[RList[j]], self.records[WList[k]])
							report=Report('W_R_W', self.records[WList[i]], self.records[RList[j]], self.records[WList[k]])
							self.reports.append(report)
		pass

	def addR_W_RPattern (self):

		for var in self.variables:
			RList=self.variables[var]['R']
			WList=self.variables[var]['W']
			if len(RList)+len(WList)<3:
				continue
			for i in range(0, len(RList)):
				for j in range(0, len(RList)):
					if i==j or not self.happensBefore(RList[i], RList[j]):
						continue
					#Find a R happens before another R
					for k in range(0, len(WList)):
						if self.isConcurrent_new_1(RList[i], WList[k]) or self.isConcurrent_new_1(WList[k], RList[j]):
							#print 'Add a report: i: %s, j: %s, k: %s' %(i, j, k)
							report=Report('R_R_W', self.records[RList[i]], self.records[RList[j]], self.records[WList[k]])
							self.reports.append(report)
		pass

	def addW_R_WPattern (self):

		for var in self.variables:
			RList=self.variables[var]['R']
			WList=self.variables[var]['W']
			if len(RList)+len(WList)<3:
				continue
			for i in range(0, len(WList)):
				for j in range(0, len(WList)):
					if i==j or not self.happensBefore(WList[i], WList[j]):
						continue
					for k in range(0, len(RList)):
						if self.isConcurrent_new_1(WList[i], RList[k]) or self.isConcurrent_new_1(RList[k], WList[j]):
							report=Report('W_W_R', self.records[WList[i]], self.records[WList[j]], self.records[RList[k]])
							self.reports.append(report)
		pass

	def addR_W_WPattern (self):

		for var in self.variables:
			RList=self.variables[var]['R']
			WList=self.variables[var]['W']
			if len(RList)+len(WList)<3:
				continue
			for i in range(0, len(RList)):
				for j in range(0, len(WList)):
					if not self.happensBefore(RList[i], WList[j]):
						continue
					for k in range(0, len(WList)):
						if k==j or not self.isConcurrent_new_1(RList[i], WList[k]) or not self.isConcurrent_new_1(WList[k], WList[j]):
							continue
						report=Report('R_W_W', self.records[RList[i]], self.records[WList[j]], self.records[WList[k]])
						self.reports.append(report)
		pass
	
	def addPatternConstraint (self):
		self.addW_W_RPattern_new_2()
		self.addR_W_RPattern()
		self.addW_R_WPattern()
		self.addR_W_WPattern()
		'''
		print '*******************after W_W_R reports is:'
		for triple in self.reports:
			triple.printout()
		'''
		pass
	
	def isConcurrent_for_var (self, lineno1, lineno2):
		#print("before isConcurrent for var: %s" %(self.check()))
		earlier = lineno1 if lineno1 < lineno2 else lineno2
		later = lineno2 if lineno1 < lineno2 else lineno1
		
		#print("already know %s happens before %s" %(earlier, later))
		self.solver.push()
		self.solver.add(self.grid[self.cbs[self.records[earlier].eid].start] == self.grid[earlier] - 1)
		self.solver.add(self.grid[self.cbs[self.records[later].eid].start] == self.grid[later] - 1)

		self.solver.add(self.grid[earlier] > self.grid[later])
		res = self.check()
		#print("solver: %s happens before %s is %s" %(later, earlier, res))
		self.solver.pop()
		if res:
			return True
		else:
			return False
		pass

	def detect_var_race (self, consider = None):
		start = time.time()	
		print("^^^^^^START DETECT RACE^^^^^^\n")
		#print("size: %s" %(len(self.variables)))
		#cache stores the result of two events, i.e., isConcurrent_new_1(), True denotes concurrent
		count = 0
		cache = dict()
		ignore_key = list()
		ignore_key.append('self')
		ignore_key.append('before')
		ignore_key.append('after')
		ignore_key.append('fs')
		ignore_key.append('async')
		ignore_key.append('random')
		ignore_key.append('util')
		ignore_key.append('compareString')
		ignore_key.append('ropts')
		ignore_key.append('last')
		ignore_key.append('encoding')
		ignore_key.append('_cache')
		ignore_key.append('_dir')
		ignore_key.append('GoodBye')
		#print(ignore_key)
		length = 24
		bottom = 24
		countR = 0
		fp_var_list = list()
		
		for var in self.variables:
			RList=self.variables[var]['R']
			WList=self.variables[var]['W']
			if len(WList)==0 or len(RList)+len(WList)<2:
				continue

			#if the length of WList is 1, it is more likely to inialize the var/function/object first and then read it, we ignore it
			if len(WList) < 2:
				continue

			#if the length of variable name is 1, it is more likely a iterator, we ignore it
			s = var.split('@')	
			if len(s[1]) < 2:
				continue

			#ignore before after self etc
			ignore_flag = False
			for key in ignore_key:	
				if re.search(key, var, re.I):	
					ignore_flag = True
					break
			if ignore_flag:
				continue
			
				
			#print (var)
			#print('RList: %s' %(len(RList)))
			#print('WList: %s\n\n' %(len(WList)))
			
				
			count += 1
			'''
			if count == 24:
				print(var)
				print('RList: %s' %(len(RList)))
				print('WList: %s\n\n' %(len(WList)))
				
			if count < bottom:
				continue
			if count > length:
				continue
			'''	
			#detect W race with W
			for i in range(0, len(WList) - 1):
				iEid = self.records[WList[i]].eid
				#deal with a single test case
				if consider != None and iEid not in consider:
					continue
				if not iEid in self.cbs:
					continue
				if self.cbs[iEid].resourceType == 'GLOBALCB':
					continue
				if not hasattr(self.cbs[iEid], 'start'):
					continue
				for j in range(i+1, len(WList)):
									
					#print("i:")
					#printObj(self.records[WList[i]])
					#print("j:")
					#printObj(self.records[WList[j]])
					#print("i & j concurrent: %s" %(self.isConcurrent_new_1(WList[i], WList[j])))
						
					if self.records[WList[i]].isDeclaredLocal or self.records[WList[j]].isDeclaredLocal:
						continue
						'''
						if var not in fp_var_list:
							fp_var_list.append(var)
							continue
						'''
					jEid = self.records[WList[j]].eid
					#deal with a single test case
					if consider != None and jEid not in consider:
						continue
					if not jEid in self.cbs:
						continue
					if self.cbs[jEid].resourceType == 'GLOBALCB':
						continue
					if not hasattr(self.cbs[jEid], 'start'):
						continue
	
					res = None
					tpl = [iEid, jEid]
					tpl.sort()
					smalle = tpl[0]
					bige = tpl[1]
					key = smalle + '-' + bige
					if key in cache:
						res = cache[key]
					else:
						starti = self.cbs[iEid].start
						startj = self.cbs[jEid].start
						res = self.isConcurrent_new_1(starti, startj)
						cache[key] = res

					if res:
						race = Race('W_W', self.records[WList[i]], self.records[WList[j]])
						
						if race.footprint not in self.racy_event_pair_cache:
							self.races.append(race)
							self.racy_event_pair_cache.append(race.footprint)
							if race.location not in self.racy_location_cache:
								self.racy_location_cache[race.location] = False
			rCheckcount = 0	
			#detect W race with R
			for i in range(0, len(WList)):
				iEid = self.records[WList[i]].eid
				#deal with a single test case
				if consider != None and iEid not in consider:
					continue
				if not iEid in self.cbs:
					continue
				if self.cbs[iEid].resourceType == 'GLOBALCB':
					continue 
				if not hasattr(self.cbs[iEid], 'start'):
					continue
				if not self.records[WList[i]].eid in self.cbs:
					continue
				if not hasattr(self.cbs[self.records[WList[i]].eid], 'start'):
					continue
				for j in range(0, len(RList)):
					
					#print("i:")
					#printObj(self.records[WList[i]])
					#print("j:")
					#printObj(self.records[RList[j]])
					#print("i & j concurrent: %s" %(self.isConcurrent_new_1(WList[i], RList[j])))
						
					if self.records[WList[i]].isDeclaredLocal or self.records[RList[j]].isDeclaredLocal:
						continue
						'''
						if var not in fp_var_list:
							fp_var_list.append(var)
							continue
						'''
					
					jEid = self.records[RList[j]].eid
					if self.cbs[jEid].resourceType == 'GLOBALCB':
						continue
					#deal with a single test case
					if consider != None and jEid not in consider:
						continue
					if not jEid in self.cbs:
						continue
					if not hasattr(self.cbs[jEid], 'start'):
						continue
					res = None
					countR += 1	
					
					tpl = [iEid, jEid]
					tpl.sort()
					smalle = tpl[0]
					bige = tpl[1]
					key = smalle + '-' + bige
					if key in cache:
						res = cache[key]
					
					else:
						starti = self.cbs[iEid].start
						startj = self.cbs[jEid].start
						rCheckcount += 1
						res = self.isConcurrent_new_1(starti, startj)
						cache[key] = res
					
					if res:
						race = Race('W_R', self.records[WList[i]], self.records[RList[j]])
						if race.footprint not in self.racy_event_pair_cache:
							self.races.append(race)
							self.racy_event_pair_cache.append(race.footprint)
							if race.location not in self.racy_location_cache:
								self.racy_location_cache[race.location] = False	
		end = time.time()
		interval = str(round(end - start))
		print("countR: %s, rCheckcount: %s" %(countR, rCheckcount))
		print("Detect variable race in %s vars, time: %s \n" %(count - len(fp_var_list), interval))			
		pass
	
	def filter_fp (self):
		self.fp = 0
		for race in self.races:
			race.isFilter = False
			rcd1 = race.tuple[0]
			rcd2 = race.tuple[1]
			redeclared = 0
			if rcd1.isDeclaredLocal:
				redeclared += 1
			elif rcd2.isDeclaredLocal:
				redeclared += 1

			if redeclared > 0:
				race.isFilter = True
				#self.fp += 1
		
		for i in range(len(self.races) - 1, -1, -1):
			if self.races[i].isFilter:
				self.races.pop(i)
		#print("++++++Complete filter local variables+++++++")
		#print("%s couple of FP" %(self.fp))
		pass


	def pass_candidate(self):
		if len(self.races) == 0:
			return

		self.addPriorityConstraint()
		self.diff_prior_same_priority()
		self.diff_prior_diff_priority()

		cache = dict()
		asynIds=map(lambda x: int(x), self.cbs.keys())	
		m = n  = max(asynIds) + 1
		pass_matrix = [[None for i in range(0, m)] for j in range(n)]

		for candidate in self.races:
			rcd1 = candidate.tuple[0]	
			rcd2 = candidate.tuple[1]
			res = None
			'''
			if isinstance(rcd1, TraceParser.DataAccessRecord):
				if rcd1.eid + '-' + rcd2.eid in cache:
					res = cache[rcd1.eid + '-' + rcd2.eid]
				elif rcd2.eid + '-' + rcd1.eid in cache:
					res = cache[rcd2.eid + '-' + rcd1.eid]
				else:
					res = self.isConcurrent_new_1(self.cbs[rcd1.eid].start, self.cbs[rcd2.eid].start)
					cache[rcd1.eid + '-' + rcd2.eid] = res
			elif isinstance(rcd1, TraceParser.FileAccessRecord) and rcd1.isAsync == False:
				res = self.cbHappensBefore(self.cbs[rcd1.eid], self.cbs[rcd2.eid])
			elif isinstance(rcd2, TraceParser.FileAccessRecord) and rcd2.isAsync == True:
				res = self.isConcurrent_new_1(rcd1.lineno, rcd2.lineno)
			'''

			if isinstance(rcd1, TraceParser.DataAccessRecord) or isinstance(rcd1, TraceParser.FileAccessRecord) and rcd1.isAsync == False:
				current = self.get_from_matrix(rcd1.eid, rcd2.eid)
				if current == 1 or current == -1:
					candidate.isConcurrent = False
				elif pass_matrix[int(rcd1.eid)][int(rcd2.eid)] == 0:
					candidate.isConcurrent = True
				else:
					res = self.isConcurrent_new_1(self.cbs[rcd1.eid].start, self.cbs[rcd2.eid].start)
					candidate.isConcurrent = res
					if res == True:
						pass_matrix[int(rcd1.eid)][int(rcd2.eid)] = 0	
			
			elif isinstance(rcd2, TraceParser.FileAccessRecord) and rcd2.isAsync == True:
				res = self.isConcurrent_new_1(rcd1.lineno, rcd2.lineno)
				candidate.isConcurrent = res

		for i in range(len(self.races) - 1, -1, -1):
			if self.races[i].isConcurrent == False:
				self.races.pop(i)
				
		pass

	def matchFileRacePattern (self, rcd1, rcd2):
		# @return <Boolean>
		return rcd2.accessType in _fsPattern[rcd1.accessType]
		pass

	def detect_file_race (self, consider = None):
		
		#print('=======Detect FS Race======')
		#print("before detect file: %s" %(self.check()))
		count = 0
		'''
		for f in self.files:
			print 'file %s' %(f)
			#print type(self.files[f])
			print(len(self.files[f]))
			#for i in range(0, len(self.files[f])):
				#print type(self.files[f][i])
				#printObj(self.records[self.files[f][i]])
		'''
		for f in self.files:
			accessList = self.files[f]
			access_num = len(accessList)
			if access_num < 2:
				continue
			#print 'file %s: ' %(f)
			for i in range(0, access_num - 1):
				rcdi = self.records[accessList[i]]
				eventi = rcdi.eid
				#deal with a single test case
				if consider != None and eventi not in consider:
					continue
				for j in range(i + 1, access_num):
					rcdj = self.records[accessList[j]]
					eventj = rcdj.eid
					#print '~~~~~~~~~~~~~~accessList[%s] is:~~~~~~~~~~~~~~' %(i)
					#printObj(accessList[i])
					#print '~~~~~~~~~~~~~~accessList[%s] is:~~~~~~~~~~~~~~' %(j)
					#printObj(accessList[j])
					
					#deal with a single test case
					if consider != None and eventj not in consider:
						continue
						
					if not self.matchFileRacePattern(rcdi, rcdj):
						#print 'NOT MATCH'
						continue

					if self.isConcurrent_new_1(rcdi.lineno, rcdj.lineno):
						pattern = rcdi.accessType + '_' + rcdj.accessType
						race = Race(pattern, rcdi, rcdj)
						self.races.append(race)		
						if race.location not in self.racy_location_cache:
							self.racy_location_cache[race.location] = False	
			
		#print("Detect file race in %s files: \n" %(file_count))	
		pass

	def check (self):
	#@return <boolean> whether there is a solution
		
		if self.solver.check()!=z3.sat:
			#print 'Error in z3!'
			return False
		else:
			#print 'ojbk'
			#de-model
			'''
			model=self.solver.model()
			
			for instruction in self.grid:
				print 'instruction_for_%s is: %s' %(instruction, model[self.grid[instruction]])
			'''
			return True
		pass

	def printScheduleResult (self):
		
		print("======Schedule Result======")
		model=self.solver.model()
		for instruction in self.grid:
			print 'instruction_for_%s is: %s' %(instruction, model[self.grid[instruction]])
		pass

	def printReports (self):

		info='***** BUGS REPORTS GENERATED BY NODERACER*****\n'
		info+='Number of AV bugs found: %s\n' %(len(self.reports))
		for i in range(0, len(self.reports)):
			info+='['+str(i+1)+'] '+self.reports[i].toString()+'\n\n'
		print info
		pass

	def searchCbChain (self, lineno):
		
		'''
		@ lineno <number>
		@ return <list>: The callback list that each callback (represented by asyncId) must happen before lieno
		'''
		
		chain = list()
		model = self.solver.model()
		self.printScheduleResult()
		rcd = model[self.grid[lineno]].as_long()
		#print('lineno is: ', lineno)
		#print('rcd is: %d', rcd)
		'''	
		startToCb = dict()
		for asyncId in self.cbs:
			startToCb[self.cbs[asyncId].start] = asyncId 
		'''
		#print self.cbs
		for cb in self.cbs.values():
			#print cb
			#print('cb.start: ', cb.start)
			#print('model[self.grid[cb.start]].as_long(): ', model[self.grid[cb.start]].as_long())
			if model[self.grid[cb.start]].as_long() < rcd:
				chain.append(cb.asyncId)
				#print chain
		chain.sort()
		#print('After search, chain is: ', chain)
		return chain

		pass

	def printRaces (self, isChain):

		info='*****RACE REPORTS GENERATED BY NODERACER*****\n'
		info+='Number of races found: %s\n' %(len(self.races))
		for i in range(0, len(self.races)):
			info+='['+str(i+1)+']'+self.races[i].toString()+'\n\n'
			if (isChain):
				#print self.races[i]
				#print self.races[i].chainToString()
				info += self.races[i].chainToString() + '\n' 
		print info
		pass
	
	def mergeRace (self):
		self.ids = list()

		for race in self.races:
			#race.isMerged = False
			if self.racy_location_cache[race.location] == True:
				race.isMerged = True
			else:
				race.isMerged = False
				self.racy_location_cache[race.location] = True	
			
			for filename in self.test_file_name:
				if re.search(filename, race.location):
					race.isMerged = True	

		for i in range(len(self.races) - 1, -1, -1):
			if self.races[i].isMerged:
				#print("MERGE")
				self.races.pop(i)
		pass

def startDebug(parsedResult, isRace, isChain):
	pairTest = False
	startDebugTime = time.time()
	scheduler=Scheduler(parsedResult)
	
	scheduler.filterCbs()
	scheduler.createOrderVariables()
	#scheduler.rm_sync_access_op()
	if pairTest == False:
		testcase_count = 0
		print("TEST CASE NUM: %s" %(len(scheduler.testsuit)))
		for testcase in scheduler.testsuit.values():
			testcase_count += 1
			#if testcase_count != 2:
				#continue
			testcaseStart = time.time()
			print("DEAL WITH TEST CASE:")
			print(testcase)
			print("Event num: %s" %(len(testcase)))
			consider = testcase
			scheduler.add_atomicity_constraint(consider)
			
			scheduler.add_reg_and_resolve_constraint(consider)
			scheduler.add_file_constraint(consider)
		
			scheduler.fifo(consider)
			scheduler.diffQ(consider)
			scheduler.detect_var_race(consider)
			scheduler.detect_file_race(consider)
		
			testcaseEnd = time.time()
			interval = str(round(testcaseEnd - testcaseStart))
			print("COMPELTE THE TEST CASE TIME: %s\n\n" %(interval))
			scheduler.empty_constraints()
	
	else:
		print("///////////PAIR TEST//////////")
		testcase_count = 0
		tnum = len(scheduler.testsuit)
		tsc = scheduler.testsuit.keys()
		print("TEST CASE NUM: %s" %(len(scheduler.testsuit)))
		for i in range(0, tnum - 1):
			testcasei = scheduler.testsuit[tsc[i]]
			
			print("DEAL WITH TEST CASE:")
			print(testcasei)
			print("Event num: %s" %(len(testcasei)))

			consider = testcasei
			scheduler.add_atomicity_constraint(consider)
			
			scheduler.add_reg_and_resolve_constraint(consider)
			scheduler.add_file_constraint(consider)
		
			scheduler.fifo(consider)
			scheduler.diffQ(consider)
			for j in range(i+1, tnum):
				testcasej = scheduler.testsuit[tsc[j]]			

				print("DEAL WITH TEST CASE:")
				print(testcasej)
				print("Event num: %s" %(len(testcasej)))

				consider = testcasej
				scheduler.add_atomicity_constraint(consider)
			
				scheduler.add_reg_and_resolve_constraint(consider)
				scheduler.add_file_constraint(consider)
		
				scheduler.fifo(consider)
				scheduler.diffQ(consider)	
		
				scheduler.detect_var_race()
				scheduler.detect_file_race()	
				
				scheduler.empty_constraints()
	
	if not isRace:
		scheduler.addPatternConstraint()
		scheduler.check()
		scheduler.printReports()	
	else:
		#scheduler.filter_fp()
		#scheduler.detectFileRace()
		scheduler.mergeRace()
		#scheduler.pass_candidate()
		endDebugTime = time.time()
		interval = str(round(endDebugTime - startDebugTime))
		scheduler.printRaces(isChain)	
		print("Detect time: %s" %(interval))			
	print '*******END DEBUG*******'
	pass
