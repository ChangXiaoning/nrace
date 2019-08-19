import TraceParser
import z3Scheduler
import z3Detector

import sys
import os

lineno = -1
sourceMap = dict()
currentSourceFile = None
cbCtx = TraceParser.CbStack()
print_obj = TraceParser.print_obj

def main():
	traceFile = sys.argv[1]
	if sys.argv[2] == 't':
		isRace = True
	else:
		isRace = False
	if sys.argv[3] == 't':
		isChain = True
	else:
		isChain = False
	#step 1: parse record into object
	print '*******BEGIN PARSE TRACE FILE*******'
	parsedResult = TraceParser.processTraceFile(traceFile)
	'''
	for cb in parsedResult['cbs'].values():
		if cb.asyncId == '1727':
			print(cb.records)
			
	print(parsedResult)
	for rcd in parsedResult['files'].values():
		if isinstance(rcd, TraceParser.FileAccessRecord):
			print(print_obj(rcd, ['lineno', 'entryType', 'accessType', 'resource', 'ref', 'name', 'eid', 'location', 'isAsync']))
	'''
	e_num = 0
	for cb in parsedResult['cbs'].values():
		if hasattr(cb, 'start'):
			e_num += 1
	print('EVENT NUM: %s' %(e_num))
	access_op = 0
	for rcd in parsedResult['records'].values():
		if isinstance(rcd, TraceParser.DataAccessRecord) or isinstance(rcd, TraceParser.FileAccessRecord):
			access_op += 1
	print("W-R NUM: %s" %(access_op))
	for fileName in parsedResult['files']:
		print("%s: [%s]\n"  %(fileName, len(parsedResult['files'][fileName])))
	#print(parsedResult['files'])
	#print('16')
	#print(parsedResult['cbs']['16'].records)
	#print('after parse:\n')
	#res = map(lambda x: int(x), parsedResult['cbs'].keys())
	#res.sort()
	#print(res)
	#print('size of vars: %s' %(len(parsedResult)))
	#step 3: detect
	print '*******BEGIN DEBUG*******'
	#z3Detector.start_detect(parsedResult, isRace, isChain)
	z3Scheduler.startDebug(parsedResult, isRace, isChain)
	pass

if __name__ == '__main__':
	main()
	pass

