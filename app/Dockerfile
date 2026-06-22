FROM python:3.12-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
# Run as a non-root user — the app only needs to read its own code and the
# read-only radar/static mounts; it never writes to the container filesystem.
RUN useradd -u 10001 -m appuser && chown -R appuser /app
USER appuser
CMD ["python", "main.py"]
