import sys
import os
import TraceParser
import Logging

logger=Logging.logger

rootPath=os.path.dirname(os.path.realpath(__file__))
z3path=rootPath+'/z3py/bin/python/z3'
print z3path
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
		if self.footprint==otherReport.footprint:
			return True
		pass

	def toString (self, detail=False):
		res=self.footprint+':'+self.pattern+'\n'
		#res+='\n'.join(self.triple)
		for i in range(0,3):
			res+='\n'+self.triple[i].toString()
		#if detail:
		return res
		pass

	def printout (self):
		print '*******************This Triple object is:'
		print 'rcd1: '
		printObj(self.rcd1)
		print 'rcd2: '
		printObj(self.rcd2)
		print 'rcd3: '
		printObj(self.rcd3)
		pass

class Scheduler:

	def __init__ (self, parsedResult):
		self.solver=z3.Solver()
		self.grid=dict()
		self.cbs=parsedResult['cbs']
		self.records=parsedResult['records']
		self.variables=parsedResult['vars']
		self.reports=list()
		pass

	def filterCbs (self):
		cbs=self.cbs
		#print cbs
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
		'''
		print '11111111111self.cbs is:'
		for cb in self.cbs.values():
			printObj(cb)
		'''
		pass

	def createOrderVariables (self):
		for cb in self.cbs.values():
			if hasattr(cb, 'start'):
				self.grid[cb.start]=z3.Int('Instruction_for_%s' %(cb.start))
				self.solver.add(self.grid[cb.start]>0)
			if hasattr(cb, 'end'):
				self.grid[cb.end]=z3.Int('Instruction_for_%s' %(cb.end))
				self.solver.add(self.grid[cb.end]>0)
			self.grid[cb.register]=z3.Int('Instruction_for_%s' %(cb.register)) 
			for lineno in cb.records:
				#print 'lineno in cb.records is: %s' %(lineno)
				self.grid[lineno]=z3.Int('Instruction_for_%s' %(lineno))
				self.solver.add(self.grid[lineno]>0)
		pass

	def addDistinctConstraint (self):
		self.solver.add(z3.Distinct(self.grid.values()))
		'''
		starts=list()
		for cb in self.cbs.values():
			print 'cb is:'
			printObj(cb)
			if hasattr(cb, 'start'):
				starts.append(self.grid[cb.start])
		self.solver.add(z3.Distinct(starts))
		'''
		pass

	def addAtomicityConstraint (self):

		for cb in self.cbs.values():
			for key in range(0, len(cb.instructions)-1):
				self.solver.add(self.grid[cb.instructions[key]]==self.grid[cb.instructions[key+1]]-1)
		#print self.solver
		pass

	def addRegisterandResolveConstraint (self):

		for cb in self.cbs.values():
			self.solver.add(self.grid[cb.register]<self.grid[cb.start])

		pass

	def addPriorityConstraint (self):

		for cb in self.cbs.values():
			if not hasattr(cb, 'postCbs'):
				continue
			#constraint: same priority
			for cbList in cb.postCbs.values():
				if len(cbList)<=1:
					continue
				for i in range(0, len(cbList)-1):
					self.solver.add(self.grid[self.cbs[cbList[i]].start]<self.grid[self.cbs[cbList[i+1]].start])
			#constraint: different priority
			cbListList=cb.postCbs.values()
			for i in range(0, len(cbListList)-1):
				cbList1=cbListList[i]
				cbList2=cbListList[i+1]
				for cb1 in cbList1:
					for cb2 in cbList2:
						self.solver.add(self.grid[self.cbs[cb1].start]<self.grid[self.cbs[cb2].start])
		pass

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

	def isConcurrent_new (self, lineno1, lineno2):
		print '**********isConcurrent_new: '
		print 'self.happensBefore(%s, %s) is: %s' %(lineno1, lineno2, self.happensBefore(lineno1, lineno2))
		print 'self.happensBefore(%s, %s) is: %s' %(lineno2, lineno1, self.happensBefore(lineno2, lineno1))
		return self.happensBefore(lineno1, lineno2) and self.happensBefore(lineno2, lineno1)
		pass

	def isConcurrent_new_1 (self, lineno1, lineno2):

		if self.records[lineno1].eid==self.records[lineno2].eid:
			return False
		self.solver.push()
		self.solver.add(self.grid[lineno1]<self.grid[lineno2])
		res=self.check()
		self.solver.pop()
		if not res:
			return False
		self.solver.push()
		self.solver.add(self.grid[lineno2]<self.grid[lineno1])
		res=self.check()
		self.solver.pop()
		if not res:
			return False
		else:
			return True
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

		model=self.solver.model()
		for instruction in self.grid:
			print 'instruction_for_%s is: %s' %(instruction, model[self.grid[instruction]])
		pass

	def printReports (self):

		info='***** BUGS REPORTS GENERATED BY NODEAV*****\n'
		info+='Number of AV bugs found: %s\n' %(len(self.reports))
		for i in range(0, len(self.reports)):
			info+='['+str(i+1)+'] '+self.reports[i].toString()+'\n\n'
		print info
		pass

def startDebug(parsedResult):
	scheduler=Scheduler(parsedResult)
	scheduler.filterCbs()
	scheduler.createOrderVariables()
	
	scheduler.addDistinctConstraint()
	scheduler.addAtomicityConstraint()
	scheduler.addRegisterandResolveConstraint()
	scheduler.addPriorityConstraint()
	
	scheduler.addPatternConstraint()
	#scheduler.check()
	scheduler.printReports()
	pass