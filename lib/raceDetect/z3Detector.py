from __future__ import print_function
import sys
import os
import TraceParser
import Logging

logger=Logging.logger

rootPath=os.path.dirname(os.path.realpath(__file__))
z3path=rootPath+'/z3py/bin/python/z3'
#print z3path
sys.path.append(z3path)

import __builtin__
__builtin__.Z3_LIB_DIRS=[rootPath+'/z3py/bin']

import z3

def printDict (dict):
	'''print dict <dict> for debug'''
	#customize indent=4
	pp=pprint.PrettyPrinter(indent=4)
	pp.pprint(dict)
	pass

def printObj (obj):
	'''print object <Object> for debug'''
	#print '========object: ', obj
	#print 'details: ',  obj.__dict__
	#print 'items: 	', ','.join(['%s:%s' % item for item in obj.__dict__.items()])
	pass

class Race:

	#def __init__ (self, pattern, rcd1, rcd2''', chain1, chain2'''):
	def __init__ (self, pattern, rcd1, rcd2):

		self.pattern=pattern
		self.tuple=[rcd1, rcd2]
		self.footprint=self.tuple[0].cbLoc+' vs. '+self.tuple[1].cbLoc
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
		pass

	def toString (self, detail=False):

		res=self.footprint+':'+self.pattern+'\n'
		for i in range(0, 2):
			res+='\n'+self.tuple[i].toString()
		return res
		pass
	
	def chainToString (self):
	
		#print self.chain1
		res = '======chain[1]=====\n'
		for item in self.chain1:
			res += item + ' -> '
		res += '\n'

		res += '======chain[2]=====\n'
		for item in self.chain1:
			res += item + ' -> '
		res += '\n'
		return res
		pass

class Detector:

	def __init__ (self, parsed_result):
		self.solver = z3.Solver()
		self.grid = dict()
		self.cbs = parsed_result['cbs']
		self.records = parsed_result['records']
		self.variables = parsed_result['vars']
		self.files = parsed_result['files']
		self.races = list()
		self.cb_stack = list()
		#self.filterCbs()
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
		'''
		for cb in cbs.values():
			if len(cb.records)>0:
				continue
		
			if cb.prior and cb.prior in cbs and cbs[cb.prior]:
				#1. remove it in its prior cb 's postCbs
				for cbList in cbs[cb.prior].postCbs.values():
					if cb.asyncId in cbList:
						cbList.remove(cb.asyncId)
						break
				#2. remove it in its register in prior cb 's instructions 
				if cb.register in cbs[cb.prior].instructions:
					cbs[cb.prior].instructions.remove(cb.register)
			#3. remove it in cbs
			del cbs[cb.asyncId]
		'''
		#if a callback list in prior.postCbs is empty, remove it
		for cb in cbs.values():
			printObj(cb)
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
	
	def addDistinctConstraint (self):
		self.solver.add(z3.Distinct(self.grid.values()))	
		pass

	def search_cb_chain (self, eid):
		self.cb_stack = []
		seed = eid
		self.cb_stack.append(seed)
		while seed != '1':
			self.cb_stack.append(self.cbs[seed].prior)
			seed = self.cbs[seed].prior
		self.cb_stack.reverse()
		pass
	
	def search_and_create_z3_variable (self, lineno):
		#global z3_num
		if not lineno in self.grid.keys():
			self.grid[lineno] = z3.Int('Instruction_for_%s' %(lineno))
			#z3_num += 1
			#print(z3_num, end='\r')
		return self.grid[lineno]
		pass

	def add_register_cons (self, cb_list):
		global call_reg_num 
		call_reg_num += 1
		for i in range(len(cb_list) - 1):
			left = self.search_and_create_z3_variable(self.cbs[cb_list[i]].start)
			right = self.search_and_create_z3_variable(self.cbs[cb_list[i + 1]].start)
			self.solver.add(left < right)

		#print('[%s]after register check is: %s' %(call_reg_num, self.check()))
		pass

	def add_fs_cons (self, lineno):
		#print("^^^^^^FS CONSTRAINT^^^^^^")
		consName = 'fsConstraint'

		file_op_z3 = self.search_and_create_z3_variable(lineno)
		file_eid_z3 = self.search_and_create_z3_variable(self.cbs[self.records[lineno].eid].start)

		if self.records[lineno].isAsync == True:
			self.solver.add(file_eid_z3 < file_op_z3)
			file_cb_z3 = self.search_and_create_z3_variable(self.cbs[self.records[lineno].cb].start)
			self.solver.add(file_op_z3 < file_cb_z3)
		else:
			self.solver.add(file_eid_z3 == file_op_z3 - 1)
		#print("after file constraint: %s" %(self.check()))
		pass

	def check (self):
	#@return <boolean> whether there is a solution
		self.addDistinctConstraint()	
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

	def isConcurrent_for_var (self, lineno1, lineno2):
		#print("before isConcurrent for var: %s" %(self.check()))
		earlier = lineno1 if lineno1 < lineno2 else lineno2
		later = lineno2 if lineno1 < lineno2 else lineno1
		#print("already know %s happens before %s" %(earlier, later))	
		
		earlier_z3_var = self.search_and_create_z3_variable(earlier)
		ear_eid_z3_var = self.search_and_create_z3_variable(self.cbs[self.records[earlier].eid].start)
		later_z3_var = self.search_and_create_z3_variable(later)
		lat_eid_z3_var = self.search_and_create_z3_variable(self.cbs[self.records[later].eid].start)

		self.solver.push()
		self.solver.add(ear_eid_z3_var == earlier_z3_var - 1)
		self.solver.add(lat_eid_z3_var == later_z3_var - 1)
		self.solver.add(earlier_z3_var > later_z3_var)	
		res = self.check()
		#print("solver: %s happens before %s is %s" %(later, earlier, res))
		self.solver.pop()
		if res:
			return True
		else:
			return False
		pass
	
	def isConcurrent (self, lineno1, lineno2):
		earlier = lineno1 if lineno1 < lineno2 else lineno2
		later = lineno2 if lineno1 < lineno2 else lineno1
		#print("already know %s happens before %s" %(earlier, later))	
		
		earlier_z3_var = self.search_and_create_z3_variable(earlier)	
		later_z3_var = self.search_and_create_z3_variable(later)	

		self.solver.push()
		self.solver.add(earlier_z3_var > later_z3_var)	
		res = self.check()
		#print("solver: %s happens before %s is %s" %(later, earlier, res))
		self.solver.pop()
		if res:
			return True
		else:
			return False	
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

def printRaces ():
	global races

	info='*****RACE REPORTS GENERATED BY NODERACER*****\n'
	info+='Number of races found: %s\n' %(len(races))
	for i in range(0, len(races)):
		info+='['+str(i+1)+']'+races[i].toString()+'\n\n' 
	print(info)
	pass

def detect_var_race (parsed_result):
	#print("^^^^^^START DETECT VAR RACE^^^^^^\n")
	count = 0
	variables = parsed_result['vars']
	global races

	for var in variables:
		RList = variables[var]['R']
		WList = variables[var]['W']

		if var == '4@randomString':
			continue
			
		if len(WList)==0 or len(WList) + len(RList) < 2 or len(RList) +  len(WList) > 20:
			continue

		print (var)
		print('RList: %s' %(RList))
		print('WList: %s\n\n' %(WList))
		
		#detect W race with W
		for i in range(0, len(WList)-1):
			for j in range(i+1, len(WList)):
				
				#count += 1
				#print(count, end='\r')
				#print("i: %s" %(i))
				#printObj(self.records[WList[i]])
				#print("j: %s+\n" %(j))
				#printObj(self.records[WList[j]])
				#print("i & j concurrent: %s" %(self.isConcurrent_new_1(WList[i], WList[j])))	
				
				detector = Detector(parsed_result)

				detector.search_cb_chain(detector.records[WList[i]].eid)
				chainI = detector.cb_stack
				detector.add_register_cons(chainI)
				
				detector.search_cb_chain(detector.records[WList[j]].eid)
				chainJ = detector.cb_stack
				detector.add_register_cons(chainJ)
					
				if detector.isConcurrent_for_var(WList[i], WList[j]):
					race=Race('W_W', detector.records[WList[i]], detector.records[WList[j]])
					races.append(race)

				del detector
				
		'''	
		#detect W race with R
		for i in range(0, len(WList)):
			for j in range(0, len(RList)):
					
				detector = Detector(parsed_result)

				detector.search_cb_chain(detector.records[WList[i]].eid)
				chainI = detector.cb_stack
				detector.add_register_cons(chainI)

				detector.search_cb_chain(detector.records[RList[j]].eid)
				chainJ = detector.cb_stack
				detector.add_register_cons(chainJ)

				if detector.isConcurrent_for_var(WList[i], RList[j]):
					race=Race('W_R', detector.records[WList[i]], detector.records[RList[j]])
					races.append(race)

				del detector
		'''
	pass

def matchFileRacePattern (rcd1, rcd2):
	# @return <Boolean>
	return rcd2.accessType in _fsPattern[rcd1.accessType]
	pass

def detect_file_race(parsed_result):
	global races

	print('=======Detect FS Race======')

	'''
	for f in parsed_result['files']:
		print 'file %s' %(f)
		for i in range(0, len(parsed_result['files'][f])):
			printObj(parsed_result['records'][parsed_result['files'][f][i]])
	'''
	
	for accessList in parsed_result['files'].values():
		
		if len(accessList) < 2:
			continue
		#print 'file %s: ' %(f)
		for i in range(0, len(accessList) - 1):
			for j in range(i + 1, len(accessList)):
				'''
				print '~~~~~~~~~~~~~~accessList[%s] is:~~~~~~~~~~~~~~' %(i)
				#printObj(accessList[i])
				print '~~~~~~~~~~~~~~accessList[%s] is:~~~~~~~~~~~~~~' %(j)
				#printObj(accessList[j])
				'''
				
				detector = Detector(parsed_result)
				
				detector.search_cb_chain(detector.records[accessList[i]].eid)
				chainI = detector.cb_stack
				detector.add_register_cons(chainI)
					
				detector.search_cb_chain(detector.records[accessList[j]].eid)
				chainJ = detector.cb_stack
				detector.add_register_cons(chainJ)

				detector.add_fs_cons(accessList[i])
				detector.add_fs_cons(accessList[j])

				if parsed_result['records'][accessList[i]].isAsync != parsed_result['records'][accessList[j]].isAsync:
					#print 'THEY HAVE DIFFERENT ASYNC'
					continue	
				elif not matchFileRacePattern(parsed_result['records'][accessList[i]], parsed_result['records'][accessList[j]]):
					#print 'NOT MATCH'
					continue
				elif parsed_result['records'][accessList[i]].isAsync == False:
					if parsed_result['records'][accessList[i]].eid == parsed_result['records'][accessList[j]].eid:
						continue	
					elif not detector.isConcurrent(accssList[i], accssList[j]):
						#print("SYNC AND NOT CONCURRENT")
						continue
					else:
						pattern = parsed_result['records'][accessList[i]].accessType + '_' +parsed_result['records'][accessList[j]].accessType
						race = Race(pattern, parsed_result['records'][accessList[i]], parsed_result['records'][accessList[j]])
						races.append(race)
				elif not detector.isConcurrent(accessList[i], accessList[j]):
						#print 'NOT CONCURRENT'
						continue
				else:
					pattern = parsed_result['records'][accessList[i]].accessType + '_' +parsed_result['records'][accessList[j]].accessType
					race = Race(pattern, parsed_result['records'][accessList[i]], parsed_result['records'][accessList[j]])
					races.append(race)
				
				del detector
pass

_fsPattern = {
	"C": ["D", "R", "O", "S"],
	"D": ["C", "R", "W", "O", "X", "S"],
	"R": ["C", "D", "W"],
	"W": ["D", "R", "X"],
	"O": ["C", "D", "X"],
	"X": ["D", "O", "W"],
	"S": ["C", "D"] 
}

races = list()
#file_races = list()
call_reg_num = 0


def start_detect(parsed_result, isRace, isChain):
	detect_var_race(parsed_result)
	#detect_file_race(parsed_result)
	printRaces()
	print ('*******END DEBUG*******')
	
	pass



########################################

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
		pass

	def toString (self, detail=False):
		res=self.footprint+':'+self.pattern+'\n'
		#res+='\n'.join(self.triple)
		for i in range(0,3):
			res+='\n'+self.triple[i].toString()
		#if detail:
		return res
		pass
	'''
	def printout (self):
		print '*******************This Triple object is:'
		print 'rcd1: '
		printObj(self.rcd1)
		print 'rcd2: '
		printObj(self.rcd2)
		print 'rcd3: '
		printObj(self.rcd3)
		pass
	'''
class Scheduler:

	def __init__ (self, parsedResult):
		self.solver=z3.Solver()
		self.grid=dict()
		self.cbs=parsedResult['cbs']
		self.records=parsedResult['records']
		self.variables=parsedResult['vars']
		self.files = parsedResult['files']
		self.reports=list()
		self.races=list()
		self.consNumber = 0
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
		'''
		for cb in cbs.values():
			if len(cb.records)>0:
				continue
		
			if cb.prior and cb.prior in cbs and cbs[cb.prior]:
				#1. remove it in its prior cb 's postCbs
				for cbList in cbs[cb.prior].postCbs.values():
					if cb.asyncId in cbList:
						cbList.remove(cb.asyncId)
						break
				#2. remove it in its register in prior cb 's instructions 
				if cb.register in cbs[cb.prior].instructions:
					cbs[cb.prior].instructions.remove(cb.register)
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

		for cb in self.cbs.values():
			if hasattr(cb, 'start'):
				self.grid[cb.start]=z3.Int('Instruction_for_%s' %(cb.start))
				count += 1
				#self.solver.add(self.grid[cb.start]>0)
			#if cb.asyncId == '1':
				#print("CB HAS END: %s" %(hasattr(cb, 'end')))
			'''
			if hasattr(cb, 'end'):
				self.grid[cb.end]=z3.Int('Instruction_for_%s' %(cb.end))
				self.solver.add(self.grid[cb.end]>0)	
			#self.grid[cb.register]=z3.Int('Instruction_for_%s' %(cb.register)) 
			
			for lineno in cb.records:
				#print 'lineno in cb.records is: %s' %(lineno)
				self.grid[lineno]=z3.Int('Instruction_for_%s' %(lineno))
				self.solver.add(self.grid[lineno]>0)
			'''
		for rcdLineno in self.records:
			self.grid[rcdLineno] = z3.Int('Instruction_for_%s' %(rcdLineno))
			count += 1
			self.solver.add(self.grid[rcdLineno] > 0)
		
		self.order_variable_num = count

		print("Variable number: %s\n" %(self.order_variable_num))
		pass

	def addDistinctConstraint (self):
		self.solver.add(z3.Distinct(self.grid.values()))	
		pass

	def addProgramAtomicityConstraint (self):
		print("^^^^^^PROGRAM ATOMICITY^^^^^^")
		count = 0
		consName = 'Atomicity'	
		for cb in self.cbs.values():
			#print consName + ' for callback ' + cb.asyncId
			#printObj(cb)

			if len(cb.records) == 0:
				'''
				if hasattr(cb, 'start') and hasattr(cb, 'end'):
					self.solver.add(self.grid[cb.start] == self.grid[cb.end] - 1)
				'''
				continue

			#should skip the asynchronous file operations
			i = 0
			j = 0
			while i < len(cb.records): 
				if isinstance(self.records[cb.records[i]], TraceParser.FileAccessRecord) and self.records[cb.records[i]].isAsync ==True:
					i += 1
				else:
					break

			#if there is no file operations in cb, i stop at DataAccessRecord
			#else i stops at FileAccessRecord
			if i == 0:
				self.solver.add(self.grid[cb.start] == self.grid[cb.records[i]] - 1)
				count += 1
				#print("Atomicity: %s == %s -1" %(cb.start, cb.records[i]))
			'''
			else:
				self.solver.add(self.grid[cb.start] < self.grid[cb.records[i]])
				print("Atomicity: %s < %s" %(cb.start, cb.records[i]))
			'''
			j = i + 1	
			#print("1. i: %s, j: %s" %(i, j))
			
			while i < len(cb.records) - 1 and j < len(cb.records):
				#print("2. i: %s, j: %s" %(i, j))
				if isinstance(self.records[cb.records[j]], TraceParser.FileAccessRecord) and self.records[cb.records[j]].isAsync == True:
					j += 1
				else:
					#self.printConstraint(consName, cb.instructions[i], cb.instructions[j])
					#if cb.instructions[i] in self.grid and cb.instructions[j] in self.grid:
					self.solver.add(self.grid[cb.records[i]] == self.grid[cb.records[j]] - 1)
					count += 1
					#print("Atomicity: %s == %s -1" %(cb.records[i], cb.records[j]))
					#self.consNumber += 1
					#self.printConstraint(consName, cb.records[i], cb.records[j])
					i = j
					j += 1
			
			#printObj(self.records[len(cb.records) - 1])
			'''
			if isinstance(self.records[cb.records[len(cb.records) - 1]], TraceParser.DataAccessRecord) or isinstance(self.records[cb.records[len(cb.records) - 1]], TraceParser.FileAccessRecord) and self.records[cb.records[len(cb.records) - 1]].isAsync == False:
				if hasattr(cb, 'end'):
					self.solver.add(self.grid[cb.records[len(cb.records) - 1]] == self.grid[cb.end])
			'''
		#print("after atomicity: %s" %(self.check()))

		self.atomicity_constraint_num = count
		print("Atomicity constraint number: %s\n" %(self.atomicity_constraint_num))
		pass
	
	def printConstraint (self, consName, lineno_1, lineno_2):
		#print consName.upper() + ': ' + str(lineno_1) + ' < ' + str(lineno_2)
		pass

	def printCbCons (self, consName, cb_1, cb_2):
		#print consName.upper() + ': ' + str(cb_1) + ' < ' + str(cb_2)
		pass

	def addRegisterandResolveConstraint_bak (self):
		
		print("^^^^^^REGISTER AND RESOLVE^^^^^^")

		consName = 'RegisterandResolve'
		for cb in self.cbs.values():	
			if hasattr(cb, 'start'):
				self.solver.add(self.grid[cb.register]<self.grid[cb.start])
				#self.printConstraint(consName, cb.register, cb.start)
				self.printCbCons(consName, cb.prior, cb.asyncId)
		pass

	def addRegisterandResolveConstraint (self):
		print("^^^^^REGISTER AND RESOLVE^^^^^^")
		consName = 'Register'
		self.register_number = 0
		'''
		for cb in self.cbs.values():
			print(cb.asyncId)
			printObj(cb)
		'''	
		for cb in self.cbs.values():
			if not hasattr(cb, 'start') or not hasattr(cb, 'postCbs'):
				continue
			for postCbList in cb.postCbs.values():
				for postCb in postCbList:
					if hasattr(self.cbs[postCb], 'start'):
						#print("ADD %s < %s" %(cb.asyncId, self.cbs[postCb].asyncId))
						#self.printConstraint(consName, cb.start, self.cbs[postCb].start)
						self.solver.add(self.grid[cb.start] < self.grid[self.cbs[postCb].start])
						self.register_number += 1
		
		print("Register number: %s\n" %(self.register_number))
		#print("after register: %s" %(self.check()))

		pass

	def addPriorityConstraint (self):
		#TODO: TIMEOUT
		'''	
		for cb in self.cbs.values():
			printObj(cb)
		'''
		print("^^^^^^^PRIORITY^^^^^^")
		self.priority_num = 0

		asynIds=map(lambda x: int(x), self.cbs.keys())
		asynIds.sort()	
		asynIds=map(lambda x: str(x), asynIds)
	
		#not consider the glocal script callback
		for i in range(1, len(asynIds) - 1):
			
			if not hasattr(self.cbs[asynIds[i]], 'start'):
				continue

			for j in range(i+1, len(asynIds)):
				#print "********asyncId[i] is: %s, asyncId[j] is: %s" %(asynIds[i], asynIds[j])
				
				if not hasattr(self.cbs[asynIds[j]], 'start'):
					continue
				
				#same priority && not consider I/O callbacks && not consider setTimeout
				if self.cbs[asynIds[i]].priority==self.cbs[asynIds[j]].priority and self.cbs[asynIds[i]].priority!=3 and self.cbs[asynIds[i]].priority!=2:
					#same prior (father)
					if self.cbs[asynIds[i]].prior==self.cbs[asynIds[j]].prior:
						if self.cbs[asynIds[i]].register < self.cbs[asynIds[j]].register:
							#print "asyncId[i] is: %s, asyncId[j] is: %s" %(asynIds[i], asynIds[j])
							#printObj[self.cbs[asynIds[i]]]
							#printObj[self.cbs[asynIds[j]]]
							self.solver.add(self.grid[self.cbs[asynIds[i]].start]<self.grid[self.cbs[asynIds[j]].start])
							self.priority_num += 1
							#print '1. add a constraint: cb_%s<cb_%s' %(asynIds[i], asynIds[j])
						else:
							self.solver.add(self.grid[self.cbs[asynIds[i]].start]>self.grid[self.cbs[asynIds[j]].start])
							self.priority_num += 1
							#print '2. add a constraint: cb_%s<cb_%s' %(asynIds[j], asynIds[i])
					'''
					#different prior (father)
					#check whether their father have happensBefore relation
					elif self.cbHappensBefore(self.cbs[self.cbs[asynIds[i]].prior], self.cbs[self.cbs[asynIds[j]].prior]):
						self.solver.add(self.grid[self.cbs[asynIds[i]].start]<self.grid[self.cbs[asynIds[j]].start])
						self.priority_num += 1
						#print '3. add a constraint: cb_%s<cb_%s' %(asynIds[i], asynIds[j])
					elif self.cbHappensBefore(self.cbs[self.cbs[asynIds[j]].prior], self.cbs[self.cbs[asynIds[i]].prior]):
						self.solver.add(self.grid[self.cbs[asynIds[j]].start]<self.grid[self.cbs[asynIds[i]].start])
						self.priority_num += 1
						#print '4. add a constraint: cb_%s<cb_%s' %(asynIds[j], asynIds[i])
					'''
				#different priority and one of them is of priority 1
				#change: priority 0
				elif (self.cbs[asynIds[i]].priority!=self.cbs[asynIds[j]].priority and (self.cbs[asynIds[i]].priority=='0' or self.cbs[asynIds[j]].priority=='0')):
					if self.cbs[asynIds[i]].priority=='0':
						ealier=asynIds[i]
						later=asynIds[j]
					else:
						ealier=asynIds[j]
						later=asynIds[i]
					#same prior (father)
					if self.cbs[ealier].prior==self.cbs[later].prior:
						self.solver.add(self.grid[self.cbs[ealier].start]<self.grid[self.cbs[later].start])
						self.priority_num += 1
						#print '5. add a constraint: cb_%s<cb_%s' %(ealier, later)
					'''
					#different prior (father)
					elif self.cbHappensBefore(self.cbs[self.cbs[ealier].prior], self.cbs[self.cbs[later].prior]):
						self.solver.add(self.grid[self.cbs[ealier].start]<self.grid[self.cbs[later].start])
						self.priority_num += 1
						#print '6. add a constraint: cb_%s<cb_%s' %(ealier, later)
					'''
		print("Priority number: %s\n" %(self.priority_num))
		pass

	def addsetTimeoutPriority (self):
		#TODO
		pass

	def addFsConstraint (self):
		#TODO: if refactor, this needs to update
		print("^^^^^^FS CONSTRAINT^^^^^^")
		self.file_constraint_num = 0
		#print '=====addFSconstraint====='
		consName = 'fsConstraint'
		for rcd in self.records.values():
			if isinstance(rcd, TraceParser.FileAccessRecord) and rcd.isAsync == True:	
				#constraint 1: asynchronous file operation happens after the callback that launches it
				self.solver.add(self.grid[self.cbs[rcd.eid].start] < self.grid[rcd.lineno])
				self.file_constraint_num += 1
				#self.printConstraint(consName + '_1', rcd.eid, rcd.lineno)
				#constraint 2: asynchronous file operation happens before the callback which will be executed when the file operation is completed
				self.solver.add(self.grid[rcd.lineno] < self.grid[self.cbs[rcd.cb].start])	
				self.file_constraint_num += 1
				#self.printConstraint(consName + '_2', rcd.lineno, self.cbs[rcd.cb].asyncId)

		#print("after file constraint: %s" %(self.check()))
		print("File number: %s\n" %(self.file_constraint_num))
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
   
	def happensBefore_bak (self, lineno1, lineno2):
		#check whether lineno1 happens before lineno2
		#@return <boolean>: if lineno1 happens before lineno2, return true

		res=False
		print '*********in happensBefore, lineno1 is: %s, lineno2 is: %s' %(lineno1, lineno2)
		print '*****-1. soler is: %s' %(self.solver)
		self.solver.push()
		print '*****0. soler is: %s' %(self.solver)
		self.solver.add(self.grid[lineno1]<self.grid[lineno2])
		print '*****1. soler is: %s' %(self.solver)
		if self.check():
			self.solver.pop()
			print '*****2. soler is: %s' %(self.solver)
			self.solver.add(self.grid[lineno2]<self.grid[lineno1])
			print '*****3. soler is: %s' %(self.solver)
			if not self.check():
				res=True
		print '*****4. soler is: %s' %(self.solver)
		self.solver.pop()
		return res
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
		#print '1. res is: %s' %(res)
		if not res:
			return False
		self.solver.push()
		self.solver.add(self.grid[lineno2]<self.grid[lineno1])
		res=self.check()
		#print '2. res is: %s' %(res)
		self.solver.pop()
		if res:
			return False
		else: 
			return True
		pass

	def cbHappensBefore_bak (self, cb1, cb2):
		
		print("THIS IS cbhappensbefore");
		if cb1==None or cb2==None or cb1==cb2:
			return False
		self.solver.push()
		self.solver.add(self.grid[cb1.start]<self.grid[cb2.start])
		res=self.check()
		self.solver.pop()
		if not res:
			return False
		self.solver.push()
		self.solver.add(self.grid[cb1.start]>self.grid[cb2.start])
		res=self.check()
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

	'''
	def isConcurrent_new (self, lineno1, lineno2):
		print '**********isConcurrent_new: '
		print 'self.happensBefore(%s, %s) is: %s' %(lineno1, lineno2, self.happensBefore(lineno1, lineno2))
		print 'self.happensBefore(%s, %s) is: %s' %(lineno2, lineno1, self.happensBefore(lineno2, lineno1))
		return self.happensBefore(lineno1, lineno2) and self.happensBefore(lineno2, lineno1)
		pass
	'''
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
				#print '*******************current var is: %s' %(var)
				self.solver.push()
				self.solver.add(self.grid[WList[i]]<self.grid[WList[i+1]])
				self.solver.push()
				for j in range(0, len(RList)):
					self.solver.add(self.grid[WList[i+1]]<self.grid[RList[j]])
					res=self.check()
					#print '*******************res is: %s' %(res)
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
			#print '*****************current var is: %s' %(var)
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
						#print '*****************res is: %s' %(res)
						if res:
							triple=Triple(self.records[WList[i]], self.records[RList[k]], self.records[WList[j]])
							self.reports.append(triple)
							#print '*****************solver is: %s' %(self.solver)
							triple.printout()
							#print '*************A schedule:\n'
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

	def detectRace_bak (self):

		for var in self.variables:
			RList=self.variables[var]['R']
			WList=self.variables[var]['W']
			if len(WList)==0 or len(RList)+len(WList)<2:
				continue
			for i in range(0, len(WList)):
				#detect W race with W
				for j in range(0, len(WList)):
					if j==i or not self.isConcurrent_new_1(WList[i], WList[j]):
						continue

					race=Race('W_W', self.records[WList[i]], self.records[WList[j]])
					self.races.append(race)
				#detect W race with R
				for j in range(0, len(RList)):
					#print '~~~~~~~~enter Rlist'
					#print 'isConcurrent_new_1(WList[%s], RList[%s]) is: %s' %(i, j, self.isConcurrent_new_1(WList[i], RList[j]))
					if not self.isConcurrent_new_1(WList[i], RList[j]):
						continue
					race=Race('W_R', self.records[WList[i]], self.records[RList[j]])
					self.races.append(race)
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

	def detectRace (self):
		print("^^^^^^START DETECT RACE^^^^^^\n")
		print("size: %s" %(len(self.variables)))
		for var in self.variables:
			RList=self.variables[var]['R']
			WList=self.variables[var]['W']
			if len(WList)==0 or len(RList)+len(WList)<2:
				continue
			#detect W race with W
			for i in range(0, len(WList)-1):
				for j in range(i+1, len(WList)):
					'''				
					print("i:")
					printObj(self.records[WList[i]])
					print("j:")
					printObj(self.records[WList[j]])
					print("i & j concurrent: %s" %(self.isConcurrent_new_1(WList[i], WList[j])))
					
					self.solver.push()
					self.solver.add(self.grid[self.cbs[self.records[WList[i]].eid].start] == self.grid[WList[i]] - 1)
					self.solver.add(self.grid[self.cbs[self.records[WList[j]].eid].start] == self.grid[WList[j]] - 1)
					'''
					if self.isConcurrent_for_var(WList[i], WList[j]):
						#race=Race('W_W', self.records[WList[i]], self.records[WList[j]]''', self.searchCbChain(WList[i]), self.searchCbChain(WList[j])''')
						race=Race('W_W', self.records[WList[i]], self.records[WList[j]])
						self.races.append(race)

					#self.solver.pop()
			#detect W race with R
			for i in range(0, len(WList)):
				for j in range(0, len(RList)):
					'''
					print("i:")
					printObj(self.records[WList[i]])
					print("j:")
					printObj(self.records[RList[j]])
					print("i & j concurrent: %s" %(self.isConcurrent_new_1(WList[i], RList[j])))
					

					self.solver.push()
					self.solver.add(self.grid[self.cbs[self.records[WList[i]].eid].start] == self.grid[WList[i]] - 1)
					self.solver.add(self.grid[self.cbs[self.records[RList[j]].eid].start] == self.grid[RList[j]] - 1)
					'''
					if self.isConcurrent_for_var(WList[i], RList[j]):
						#race=Race('W_R', self.records[WList[i]], self.records[RList[j]]''', self.searchCbChain(WList[i]), self.searchCbChain(RList[j])''')
						race=Race('W_R', self.records[WList[i]], self.records[RList[j]])
						self.races.append(race)

					#self.solver.pop()
		pass

	def matchFileRacePattern (self, rcd1, rcd2):
		# @return <Boolean>
		return rcd2.accessType in _fsPattern[rcd1.accessType]
		pass

	def detectFileRace (self):
		
		#print '=======Detect FS Race======'
		#print("before detect file: %s" %(self.check()))
		
		for f in self.files:
			#print 'file %s' %(f)
			#print type(self.files[f])
			for i in range(0, len(self.files[f])):
				#print type(self.files[f][i])
				printObj(self.records[self.files[f][i]])
		
		for f in self.files:
			accessList = self.files[f]
			if len(accessList) < 2:
				continue
			#print 'file %s: ' %(f)
			for i in range(0, len(accessList) - 1):
				for j in range(i + 1, len(accessList)):
					
					#print '~~~~~~~~~~~~~~accessList[%s] is:~~~~~~~~~~~~~~' %(i)
					#printObj(accessList[i])
					#print '~~~~~~~~~~~~~~accessList[%s] is:~~~~~~~~~~~~~~' %(j)
					#printObj(accessList[j])
					
					if self.records[accessList[i]].isAsync != self.records[accessList[j]].isAsync:
						#print 'THEY HAVE DIFFERENT ASYNC'
						continue	
					elif not self.matchFileRacePattern(self.records[accessList[i]], self.records[accessList[j]]):
						#print 'NOT MATCH'
						continue
					elif self.records[accessList[i]].isAsync == False:
						if self.records[accessList[i]].eid == self.records[accessList[j]].eid:
							continue
						elif not self.cbHappensBefore(self.cbs[self.records[accssList[i]].eid], self.cbs[self.records[accssList[j]].eid]):
							#print("SYNC AND NOT CONCURRENT")
							continue
						else:
							pattern = self.records[accessList[i]].accessType + '_' +self.records[accessList[j]].accessType
							race = Race(pattern, self.records[accessList[i]], self.records[accessList[j]])
							self.races.append(race)
					elif not self.isConcurrent_new_1(self.records[accessList[i]].lineno, self.records[accessList[j]].lineno):
						#print 'NOT CONCURRENT'
						continue
					else:
						pattern = self.records[accessList[i]].accessType + '_' +self.records[accessList[j]].accessType
						race = Race(pattern, self.records[accessList[i]], self.records[accessList[j]])
						self.races.append(race)	
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
		#for instruction in self.grid:
			#print 'instruction_for_%s is: %s' %(instruction, model[self.grid[instruction]])
		pass

	def printReports (self):

		info='***** BUGS REPORTS GENERATED BY NODERACER*****\n'
		info+='Number of AV bugs found: %s\n' %(len(self.reports))
		for i in range(0, len(self.reports)):
			info+='['+str(i+1)+'] '+self.reports[i].toString()+'\n\n'
		print (info)
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
		print (info)
		pass

def startDebug(parsedResult, isRace, isChain):
	scheduler=Scheduler(parsedResult)
	scheduler.filterCbs()
	scheduler.createOrderVariables()
		
	scheduler.addDistinctConstraint()
	'''
	#scheduler.addProgramAtomicityConstraint()
	scheduler.addRegisterandResolveConstraint()
	scheduler.addPriorityConstraint()
	scheduler.addFsConstraint()
	'''			
	if not isRace:
		scheduler.addPatternConstraint()
		#scheduler.check()
		scheduler.printReports()	
	else:
		#scheduler.detectRace()
		scheduler.detectFileRace()
		scheduler.printRaces(isChain)
	
	#print '*******END DEBUG*******'
	
	pass