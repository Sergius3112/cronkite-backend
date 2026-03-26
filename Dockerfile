FROM node:20-slim AS frontend-builder
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .
COPY cronkite-edu.html .
COPY teacher.html .
COPY student.html .

# Copy built React app
COPY --from=frontend-builder /frontend/dist ./frontend/dist

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
