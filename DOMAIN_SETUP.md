# Настройка домена site.endless-summer.ru

## Шаг 1: Проверка работы приложения

```bash
# Проверка, что приложение запущено на порту 3000
curl http://localhost:3000

# Проверка логов PM2
pm2 logs apart-site --lines 20

# Если все хорошо, должно быть "online" и без ошибок
pm2 status
```

## Шаг 2: Настройка через Nginx Proxy Manager

Если у вас установлен Nginx Proxy Manager (судя по странице "Congratulations!"), настройка делается через веб-интерфейс:

### 2.1. Откройте админ-панель Nginx Proxy Manager

Обычно это: `http://95.165.75.43:81` или `http://ваш_IP:81`

**Логин/пароль по умолчанию:**
- Email: `admin@example.com`
- Password: `changeme`

Если не помните, проверьте документацию или попросите у администратора сервера.

### 2.2. Создайте новый Proxy Host

1. Войдите в админ-панель
2. Перейдите в **"Hosts"** → **"Proxy Hosts"**
3. Нажмите **"Add Proxy Host"**

### 2.3. Заполните настройки:

**Details Tab:**
- **Domain Names:** `site.endless-summer.ru`
- **Scheme:** `http`
- **Forward Hostname / IP:** `localhost` или `127.0.0.1`
- **Forward Port:** `3000`
- **Block Common Exploits:** ✅ (включено)
- **Websockets Support:** ✅ (включено)

**SSL Tab:**
- **SSL Certificate:** Выберите **"Request a new SSL Certificate"** или используйте существующий
- **Force SSL:** ✅ (включено)
- **HTTP/2 Support:** ✅ (включено)
- **HSTS Enabled:** ✅ (включено)
- Нажмите **"Save"**

**Advanced Tab (опционально):**
Можно добавить кастомные заголовки:
```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

### 2.4. Сохранение

Нажмите **"Save"** и подождите, пока SSL сертификат будет получен (если выбрали автоматический).

## Шаг 3: Проверка DNS

Убедитесь, что DNS запись для домена указывает на ваш сервер:

```bash
# Проверка DNS записи
nslookup site.endless-summer.ru
# или
dig site.endless-summer.ru

# Должен показывать IP: 95.165.75.43
```

Если DNS еще не настроен, нужно:
1. Зайти в панель управления доменом (где покупали домен)
2. Создать A-запись:
   - **Type:** A
   - **Name:** site (или @ для корневого домена)
   - **Value:** 95.165.75.43
   - **TTL:** 3600

## Шаг 4: Проверка работы

После настройки подождите 1-2 минуты для применения настроек, затем:

```bash
# Проверка с сервера
curl http://localhost:3000
curl -I https://site.endless-summer.ru

# Откройте в браузере
https://site.endless-summer.ru
```

## Альтернатива: Настройка через обычный Nginx

Если Nginx Proxy Manager не используется, настройте обычный Nginx:

```bash
# Создание конфигурации
sudo nano /etc/nginx/sites-available/site-endless-summer
```

**Вставьте конфигурацию:**
```nginx
server {
    listen 80;
    server_name site.endless-summer.ru;

    location / {
        proxy_pass http://localhost:3000;
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

**Активация:**
```bash
sudo ln -s /etc/nginx/sites-available/site-endless-summer /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# SSL сертификат
sudo certbot --nginx -d site.endless-summer.ru
```

## Шаг 5: Проверка логов (если проблемы)

```bash
# Логи приложения
pm2 logs apart-site --lines 50

# Логи Nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Проверка порта
sudo netstat -tulpn | grep 3000
```

## Готово! 🎉

После настройки ваш сайт будет доступен по адресу: `https://site.endless-summer.ru`

