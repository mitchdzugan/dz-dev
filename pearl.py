#!/usr/bin/env python3

import os
import sys
import socket
import time
import json

zvim_port = int(os.environ.get("ZVIM_PORT"))
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
while True:
    try:
        sock.connect(("localhost", zvim_port))
        break
    except:
        time.sleep(0.5)

os.system("nvim " + " ".join(sys.argv[1:]))
sock.send(json.dumps({"type": "close"}).encode())
