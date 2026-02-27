#!/bin/bash
# FactCheck backend auto-start script

cd /Users/christianstapleton/Downloads/factchecker/cronkite-backend
source venv/bin/activate
export GROQ_API_KEY=$GROQ_API_KEY
uvicorn main:app --host 127.0.0.1 --port 8000
