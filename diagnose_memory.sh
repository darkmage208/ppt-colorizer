#!/bin/bash

echo "🔍 MEMORY DIAGNOSTIC REPORT"
echo "=========================="

echo "📊 System Memory:"
free -h

echo ""
echo "📊 Docker Memory Limits:"
docker compose -f docker-compose.prod.yml exec celery cat /sys/fs/cgroup/memory/memory.limit_in_bytes | awk '{printf "Container Memory Limit: %.2f GB\n", $1/1024/1024/1024}'

echo ""
echo "📊 Current Memory Usage:"
docker compose -f docker-compose.prod.yml exec celery cat /sys/fs/cgroup/memory/memory.usage_in_bytes | awk '{printf "Container Memory Usage: %.2f GB\n", $1/1024/1024/1024}'

echo ""
echo "📊 Swap Usage:"
free | grep Swap

echo ""
echo "📊 Docker Stats (live):"
timeout 10 docker stats --no-stream | grep celery

echo ""
echo "📊 OOM Killer Events:"
dmesg | grep -i "killed process" | tail -5

echo ""
echo "📊 Celery Worker Processes:"
docker compose -f docker-compose.prod.yml exec celery ps aux | grep celery

echo ""
echo "📊 Current Docker Compose Config:"
docker compose -f docker-compose.prod.yml config | grep -A 10 -B 5 memory