FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && pip uninstall -y polars polars-runtime-32 polars-runtime-64 2>/dev/null || true \
    && pip install --no-cache-dir polars-lts-cpu
COPY worker.py .
CMD ["python", "worker.py"]
