#coding:utf-8
#!/usr/bin/python
# from __future__ import print_function
# Jiahong Zhou 2017
import sys
# path = "/Users/zhoujiahong/Jiahonglibs/z3-4.4.0-x64-osx-10.10.3/bin"
# path = "/Users/zhoujiahong/Jiahonglibs/z3-4.6.0-x64-osx-10.11.6/bin/python/z3"

import os
thisFilePath = os.path.split(os.path.realpath(__file__))[0]
rootPath = thisFilePath[0:-13]
# print rootPath
z3path = rootPath + "z3py/bin/python/z3/"
# print z3path
# note: sys.path is the dictory for import python libs, find the libz3.dylib must use the PATH or Z3_LIB_DIRS

sys.path.append(z3path)

import __builtin__
__builtin__.Z3_LIB_DIRS = [rootPath + "z3py/bin/"]

import z3
import json

def happen_before():
    # step 1
    solver = z3.Solver()

    # step 2
    x1 = z3.Int("z3_x1")
    

    # step 3
    solver.add(x1>10)
    print '1. %s' %(solver)
    solver.push()
    solver.add(x1>20)
    print '2. %s' %(solver)
    solver.pop()
    print '3. %s' %(solver)
    ####
    solver.push()
    solver.add(x1>30)
    print '4. %s' %(solver)
    solver.pop()
    print '5. %s' %(solver)


if __name__ == "__main__":
    happen_before()
