#!/bin/bash

# Проверка всех контейнеров (включая остановленные)
echo "=== Проверка всех контейнеров ==="
docker ps -a | grep nginx-proxy

# Проверка, заняты ли порты
echo ""
echo "=== Проверка портов 80, 81, 443 ==="
sudo ss -tulpn | grep -E ":81|:80|:443"

# Удаление старого контейнера если есть
echo ""
echo "=== Удаление старого контейнера ==="
docker rm -f nginx-proxy-manager 2>/dev/null || echo "Контейнера не было"

# Создание директорий заново
mkdir -p ~/nginx-proxy-manager/data
mkdir -p ~/nginx-proxy-manager/letsencrypt

# Запуск NPM с проверкой ошибок
echo ""
echo "=== Запуск Nginx Proxy Manager ==="
docker run -d \
  --name nginx-proxy-manager \
  --restart unless-stopped \
  -p 80:80 \
  -p 81:81 \
  -p 443:443 \
  -v ~/nginx-proxy-manager/data:/data \
  -v ~/nginx-proxy-manager/letsencrypt:/etc/letsencrypt \
  jc21/nginx-proxy-manager:latest

# Ожидание запуска
echo "Ожидание 5 секунд..."
sleep 5

# Проверка статуса
echo ""
echo "=== Статус контейнера ==="
docker ps | grep nginx-proxy

# Проверка логов
echo ""
echo "=== Последние 20 строк логов ==="
docker logs nginx-proxy-manager --tail 20 2>&1 || echo "Контейнер не запустился"

