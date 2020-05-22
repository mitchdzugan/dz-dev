#!/usr/bin/env python3

import libtmux
import os
import sys
import socket
import time
import json

zvim_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
zvim_sock.bind(('', 0))
addr = zvim_sock.getsockname()
zvim_port = addr[1]
os.environ["ZVIM_PORT"] = str(zvim_port)

sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.bind(('', 0))
addr = sock.getsockname()
port = addr[1]
sock.listen(1)

zvim_sock.close()

NVIM_ADDRESS = os.environ.get("NVIM_LISTEN_ADDRESS")
server = libtmux.Server()
session = server.find_where({ "session_name": NVIM_ADDRESS })
w = session.list_windows()[0]
w.split_window(attach=False)
panes = w.list_panes()
main = panes[0]
cmds = panes[1]
cmds.send_keys("export ZVIM_PORT=" + str(zvim_port))
cmds.send_keys("export LOOKING_GLASS_PORT=" + str(port))
cmds.send_keys("export NVIM_LISTEN_ADDRESS=" + NVIM_ADDRESS)
cmds.send_keys("cd /home/dz/Projects/dz-dev")
cmds.send_keys("yarn start")
main.resize_pane("-Z")
os.system("pearl.py " + " ".join(sys.argv[1:]) + " &")

conn, addr = sock.accept()
done = False
while not done:
    data = conn.recv(1024)
    msg = json.loads(data)
    if (msg["type"] == "open"):
        main.resize_pane("-Z")
    if (msg["type"] == "exit"):
        done = True

w.kill_window()
