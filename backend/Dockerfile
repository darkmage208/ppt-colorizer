FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    postgresql-client \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create upload and output directories with proper permissions
RUN mkdir -p uploads/conversion_files uploads/individual_files uploads/vcf_files \
    && mkdir -p outputs/conversion_results outputs/txt_files \
    && chmod -R 755 uploads outputs

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]