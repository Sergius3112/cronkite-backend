#!/bin/bash
# FactCheck backend auto-start script

cd /Users/christianstapleton/Downloads/factchecker/backend
source venv/bin/activate
export GROQ_API_KEY=REMOVED
uvicorn main:app --host 127.0.0.1 --port 8000
