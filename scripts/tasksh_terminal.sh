#!/bin/bash
# tasksh_terminal.sh - Custom script to launch tasksh in the terminal

# Set up Taskwarrior environment
export TASKRC="$(pwd)/data/taskwarrior/.taskrc"
export TASKDATA="$(pwd)/data/taskwarrior"

# Ensure the taskwarrior data directory exists
mkdir -p "$TASKDATA"

# Create default taskrc if it doesn't exist
if [ ! -f "$TASKRC" ]; then
  echo "data.location=$TASKDATA" > "$TASKRC"
  echo "confirmation=no" >> "$TASKRC"
  echo "verbose=blank,label,new-id,edit,special,project,sync,unwait,recur" >> "$TASKRC"
fi

# Display welcome message
echo "Welcome to Taskwarrior Shell (tasksh)"
echo "Type 'exit' to exit, or 'help' for tasksh commands"
echo "You can also run any bash command prefixed with '!'"
echo ""

# Path to tasksh binary (fixed path in Replit environment)
TASKSH_PATH="/nix/store/yfb4hsrh8pd94s7sr0dm0jx11kgrp0x1-tasksh-1.2.0/bin/tasksh"

# Launch tasksh if the binary exists
if [ -f "$TASKSH_PATH" ]; then
  exec "$TASKSH_PATH"
else
  echo "Error: Could not find tasksh at $TASKSH_PATH"
  echo "Falling back to standard bash shell"
  exec bash
fi