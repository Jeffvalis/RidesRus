#!/bin/zsh
# Double-click to run the whole RidesRus system in this Terminal window.
# Close the window (or press Ctrl-C) to stop everything.
cd "$(dirname "$0")"

# Use Node 24 if it's installed in ~/.local (otherwise whatever node is on PATH).
[ -d "$HOME/.local/node-v24.21.0-darwin-arm64/bin" ] && export PATH="$HOME/.local/node-v24.21.0-darwin-arm64/bin:$PATH"

if ! command -v node >/dev/null; then
  echo "Node.js isn't installed. Get Node 22+ from https://nodejs.org and try again."; read; exit 1
fi
[ -d node_modules ] || npm install

# Open the three apps in the browser once they're up.
( for i in {1..90}; do curl -s -o /dev/null localhost:8081 && break; sleep 2; done
  open http://localhost:3000 http://localhost:8081 http://localhost:8082 ) &

npm run dev
