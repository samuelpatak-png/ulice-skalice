#!/bin/bash
cd "$(dirname "$0")/hra"
echo "Ulice Skalice - http://localhost:8080  (Ctrl+C alebo zatvorenie okna hru vypne)"
(sleep 1; xdg-open http://localhost:8080/) &
python3 -m http.server 8080
