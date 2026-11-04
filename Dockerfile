FROM python:3.10-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    OMP_NUM_THREADS=4 \
    MKL_NUM_THREADS=4 \
    HANGUL_HOST=0.0.0.0 \
    HANGUL_PORT=7860 \
    PORT=7860 \
    HANGUL_ALLOW_ALL_HOSTS=1

WORKDIR /app

# Install system dependencies including Tesseract OCR with Korean data
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-kor \
    libgl1 \
    libglib2.0-0 \
    fonts-nanum \
    fonts-noto-cjk \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy project files
COPY multi_ocr /app/multi_ocr
COPY dist /app/dist

# Install Python requirements
RUN pip install --no-cache-dir -r multi_ocr/requirements-base.txt && \
    pip install --no-cache-dir -r multi_ocr/requirements-easy.txt && \
    pip install --no-cache-dir -r multi_ocr/requirements-paddle.txt

# Create cache and data directories
RUN mkdir -p /app/local-data/.paddlex && chmod -R 777 /app/local-data

EXPOSE 7860

CMD ["python", "multi_ocr/server.py"]
