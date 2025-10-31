#!/bin/bash

echo "=== 1. Проверка работы приложения на порту 3000 ==="
curl -s http://localhost:3000 | head -5 || echo "❌ Приложение не отвечает на localhost:3000"

echo ""
echo "=== 2. Проверка контейнера NPM ==="
docker ps | grep nginx-proxy || echo "❌ Контейнер не запущен"

echo ""
echo "=== 3. Проверка IP Docker сети ==="
docker network inspect bridge | grep -A 5 Gateway

echo ""
echo "=== 4. Проверка доступности админки NPM ==="
curl -s http://localhost:81 | head -5 || echo "❌ Админка NPM не отвечает"

echo ""
echo "=== 5. Проверка что порт 3000 слушается ==="
sudo ss -tulpn | grep 3000

echo ""
echo "=== 6. Логи NPM (последние 10 строк) ==="
docker logs nginx-proxy-manager --tail 10

