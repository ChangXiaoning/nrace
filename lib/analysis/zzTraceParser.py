from __future__ import print_function
import json
import os
import sys
import pprint
import time
import Logging
import json
import re

import TraceParser

def processTraceFile (traceFile):
	result = TraceParser.processTraceFile(traceFile)
	return result
