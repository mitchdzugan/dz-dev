#!/usr/bin/env python3

import libtmux
import os
import time

NVIM_ADDRESS = os.environ.get("NVIM_LISTEN_ADDRESS")
server = libtmux.Server()
session = server.find_where({ "session_name": NVIM_ADDRESS })
w = session.list_windows()[0]
w.split_window(attach=False)
panes = w.list_panes()
main = panes[0]
cmds = panes[1]
main.resize_pane("-Z")
os.system("nvim")
w.kill_window()
