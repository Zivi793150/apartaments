#!/bin/bash

echo "=== 1. Проверка админки внутри сервера ==="
curl -s http://localhost:81 | head -5 || echo "❌ Не работает внутри сервера"

echo ""
echo "=== 2. Проверка внешнего IP сервера ==="
curl -s ifconfig.me || curl -s ipinfo.io/ip

echo ""
echo "=== 3. Проверка firewall ==="
sudo ufw status

echo ""
echo "=== 4. Проверка что порт 81 слушается ==="
sudo ss -tulpn | grep 81

echo ""
echo "=== 5. Проверка контейнера NPM ==="
docker ps | grep nginx-proxy

echo ""
echo "=== 6. Попробуйте открыть админку по IP внутри Docker сети ==="
docker exec nginx-proxy-manager curl -s http://localhost:81 | head -5

