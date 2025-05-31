#!/bin/bash
# Quick script to test the demo locally

echo "Starting local demo server..."
echo "Demo will be available at: http://localhost:8000"
echo "Press Ctrl+C to stop"
echo ""

cd demo
python3 -m http.server 8000