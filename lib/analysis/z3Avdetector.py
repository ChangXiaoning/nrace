import sys
import os
import TraceParser

rootPath=os.path.dirname(os.path.realpath(__file__))
z3path=rootPath+'/z3py/bin/python/z3'
print z3path
sys.path.append(z3path)

import __builtin__
__builtin__.Z3_LIB_DIRS=[rootPath+'/z3py/bin']

import z3

def happen_before():
    # step 1
    solver = z3.Solver()

    # step 2
    x1 = z3.Int("z3_x1")
    x2 = z3.Int("z3_x2")
    x3 = z3.Int("z3_x3")

    # step 3
    solver.add(z3.And(x1 <= x2, x2 <= x3))
    solver.add(z3.Distinct(x1, x2, x3))

    # step 4
    if solver.check() != z3.sat:
        print "Error in z3"
    else:
        print "It works"

    # step 5
    model = solver.model()

    # step 6
    print "x1: %s" % model[x1]
    print "x2: %s" % model[x2]
    print "x3: %s" % model[x3]
    pass

def buildHappensBeforeConstraint (consList):
	#@param consList <list>: the list contains the constraints (of class Constraint)
	#@return print xxx

	#store the coresponding relation between the z3 values and its original value, indexed by the original value
	grid=dict()

	#step 1: build a solver
	solver=z3.Solver()

	#step 2: create order variables

	priorCbList=list()
	postCbList=list()

	for constraint in consList:
		print "===process constraint: "
		TraceParser.printObj(constraint)
		if constraint.prior not in grid:
			prior=z3.Int('cb_for_%s' %(constraint.prior))
			grid[constraint.prior]=prior
		else:
			prior=grid[constraint.prior]

		if constraint.asyncId not in grid:
			asyncId=z3.Int('cb_for_%s' %(constraint.asyncId))
			grid[constraint.asyncId]=asyncId
		else:
			asyncId=grid[constraint.asyncId]

		#constraint: the callback happens before the callback it registers/resolves
		solver.add(prior<asyncId)

		#obtain the callback whose prior is 1 (i.e., the global script)
		if constraint.prior=='1':
			priorCbList.append(constraint.asyncId)
		else:
			postCbList.append(constraint.asyncId)
		
	#step 3: build constraints
	#constraint: all the order variables are different
	solver.add(z3.Distinct(grid.values()))

	#constraint: all the order variables >=1
	for cb in grid.values():
		solver.add(cb>=1)

	#constraint: the callback registered by the global script should happen before than other callbacks not registered by global
	for priorCb in priorCbList:
		for postCb in postCbList:
			solver.add(grid[priorCb]<grid[postCb])

	#step 4: check sat
	if solver.check()!=z3.sat:
		print "Error in z3"
	else :
		print "It works"

	#step 5: decode model
	model=solver.model()

	#step 6: output result
	for cb in grid:
		print "cb %s is: %s" %(cb, model[grid[cb]])

	pass

def addRegister_Resolve_Constraint (solver, grid, consList):
	#add register & resolve constraints
	#@param solver <instance>: the solver constraints are added to
	#@param grid <dict>: the dictionary that stores the corresponding relation between the original cb id and cb id in z3
	#@param consList <list>: the list returned from TraceParser.processTraceFile()
	#@return: no return. Just add constraints to the param solver

	priorCbList=list()
	postCbList=list()

	#constraint: the callback happens before callbacks it registers and resolves
	for constraint in consList:
		solver.add(grid[constraint.prior]<grid[constraint.asyncId])

		#obtain the callback whose prior is 1 (i.e., the global script)
		if constraint.prior=='1':
			priorCbList.append(constraint.asyncId)
		else:
			postCbList.append(constraint.asyncId)

	#constraint: the callback registered by the global script should happen before than other callbacks not registered by global
	print 'priorCbList is: %s' %(priorCbList)
	print 'postCbList is: %s' %(postCbList)
	for priorCb in priorCbList:
		for postCb in postCbList:
			solver.add(grid[priorCb]<grid[postCb])

	#constraint: all the order variables are different
	solver.add(z3.Distinct(grid.values()))

	#constraint: all the order variables >= 1
	for cb in grid.values():
		solver.add(cb>=1)

	pass

def addR_W_RConstraint ():

	pass

def addW_W_RConstraint ():

	pass

def addW_R_WConstraint ():

	pass

def addR_W_WConstraint ():

	pass

def addPatternConstraint ():

	pass

def buildConstraint (consList):
	#used for constraint building: register & resolve & patterns
	
	solver=z3.Solver()
	grid=dict()

	#build order variables
	for constraint in consList:
		if constraint.prior not in grid:
			grid[constraint.prior]=z3.Int("cb_for_%s" %(constraint.prior))

		if constraint.asyncId not in grid:
			grid[constraint.asyncId]=z3.Int('cb_for_%s' %(constraint.asyncId))

	#add register & resolve constraints
	addRegister_Resolve_Constraint(solver, grid, consList)

	#add pattern constraints

	#check
	if solver.check()!=z3.sat:
		print "Error in z3!"
	else:
		print "It works"

	#de-model
	model=solver.model()

	for cb in grid:
		print 'cb %s is: %s' %(cb, model[grid[cb]])

	pass

def testDistinct ():

	grid=dict()

	solver=z3.Solver()

	value=z3.Int("number_%d" %(1))
	grid[1]=value

	for i in range(2,6):
		value=z3.Int("number_%d" %(i))
		grid[i]=value
		solver.add(grid[i-1]<value)

	solver.add(z3.Distinct(grid.values()))

	if solver.check()!=z3.sat:
		print "error in z3"
	else:
		print "It works"

	model=solver.model()

	for key in grid:
		print "value[%s] is: %s" %(key, model[grid[key]])
	pass

def testAdd ():
	solver=z3.Solver()
	a=z3.Int("test_a")
	solver.add(a>1)
	solver.add(a<5)

	if solver.check()!=z3.sat:
		print "Error in z3"
	else:
		print "It works"

	model=solver.model()
	print 'a=%s' %(model[a])
	pass

if __name__ == "__main__":
    happen_before()

