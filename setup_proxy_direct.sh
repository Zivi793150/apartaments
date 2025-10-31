#!/bin/bash

# Подключение к контейнеру NPM и настройка через CLI
# Или используйте готовую конфигурацию

echo "=== Вариант 1: Откройте админку по IP ==="
echo "http://95.165.75.43:81"
echo ""
echo "=== Вариант 2: Если порт 81 заблокирован, настройте через Nginx напрямую ==="

# Создайте конфиг напрямую в NPM
docker exec -it nginx-proxy-manager bash <<EOF
# Создайте запись в базе данных через SQL
sqlite3 /data/database.sqlite <<SQL
INSERT INTO proxy_host (domain_names, forward_host, forward_port, forward_scheme, ssl_forced, enabled, access_list_id, certificate_id, created_on, modified_on, owner_user_id) 
VALUES ('site.endless-summer.ru', '172.17.0.1', 3000, 'http', 1, 1, 0, 0, datetime('now'), datetime('now'), 1);
SQL
exit
EOF

