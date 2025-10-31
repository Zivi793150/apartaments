# Исправление настройки домена site.endless-summer.ru

## Проблема
Домен показывает стандартную страницу "Welcome to nginx!" вместо вашего приложения.

## Решение

### Вариант 1: Если используете Nginx Proxy Manager

1. Откройте админ-панель: `http://95.165.75.43:81` или `https://95.165.75.43:81`
2. Войдите в систему
3. Перейдите в **Hosts** → **Proxy Hosts**
4. Найдите запись для `site.endless-summer.ru` или создайте новую:
   - Нажмите **Add Proxy Host** или отредактируйте существующий

5. Проверьте/измените настройки:
   - **Domain Names:** `site.endless-summer.ru`
   - **Scheme:** `http`
   - **Forward Hostname / IP:** `localhost` или `127.0.0.1`
   - **Forward Port:** `3000` ⚠️ **ВАЖНО: должен быть 3000!**
   - **Websockets Support:** ✅ включите

6. Вкладка **SSL:**
   - Убедитесь, что SSL сертификат активен
   - **Force SSL:** ✅ включено

7. Сохраните изменения

### Вариант 2: Если используете обычный Nginx

Проверьте конфигурацию:

```bash
# Посмотрите текущие конфигурации
sudo ls -la /etc/nginx/sites-enabled/
sudo cat /etc/nginx/sites-enabled/site-endless-summer

# Или найдите конфигурацию для домена
sudo grep -r "site.endless-summer.ru" /etc/nginx/
```

Если конфигурация есть, проверьте, что она проксирует на порт 3000:

```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name site.endless-summer.ru;

    # SSL сертификаты (если есть)
    ssl_certificate /path/to/cert;
    ssl_certificate_key /path/to/key;

    location / {
        proxy_pass http://localhost:3000;  # ⚠️ Должен быть порт 3000!
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

После изменений:
```bash
sudo nginx -t  # Проверка конфигурации
sudo systemctl reload nginx  # Перезагрузка
```

### Проверка работы приложения

```bash
# Убедитесь, что приложение работает
curl http://localhost:3000
pm2 status
pm2 logs apart-site --lines 10
```

### Диагностика

```bash
# Проверьте, что порт 3000 открыт и приложение слушает
netstat -tulpn | grep 3000
# Должно показать: node или npm процесс на порту 3000

# Проверьте логи Nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Проверьте, какой порт использует домен
curl -I https://site.endless-summer.ru
curl http://localhost:3000
```

## Быстрое решение

Скорее всего проблема в том, что домен проксирует не на порт 3000, а на стандартный Nginx (порт 80/443).

**Проверьте в Nginx Proxy Manager:**
- Forward Port должен быть **3000**, а не 80 или 443!

