FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y curl build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/db

EXPOSE 8200

# 4 workers: general-agent is stateless (no file watcher), so multiple
# workers safely handle concurrent requests without race conditions.
# uvloop + httptools boost async I/O throughput.
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
CMD ["uvicorn", "main:app", \
     "--host", "0.0.0.0", \
     "--port", "8200", \
     "--loop", "uvloop", \
     "--http", "httptools", \
     "--timeout-keep-alive", "75", \
     "--workers", "4"]
