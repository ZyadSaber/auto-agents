FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/uploads /app/db

EXPOSE 8100

# Single process — keeps the file watcher and in-memory state consistent.
# uvloop + httptools give measurable async I/O speedup without extra workers.
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
CMD ["uvicorn", "main:app", \
     "--host", "0.0.0.0", \
     "--port", "8100", \
     "--loop", "uvloop", \
     "--http", "httptools", \
     "--timeout-keep-alive", "75", \
     "--workers", "1"]
