import sys
import os
thisFilePath = os.path.split(os.path.realpath(__file__))[0]
rootPath = thisFilePath[0:-13]

z3path = rootPath + "z3py/bin/python/z3/"
sys.path.append(z3path)

from z3 import *
#solver = z3.Solver()
'''
import __builtin__
__builtin__.Z3_LIB_DIRS = [rootPath + "z3py/bin/"]

import z3
import json
'''
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


if __name__ == "__main__":
    happen_before()
