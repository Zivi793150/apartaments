# Исправление ошибки Nginx конфигурации

Ошибка: `"server" directive is not allowed here` означает, что в файле конфигурации неправильная структура.

## Решение:

### 1. Проверьте содержимое файла:

```bash
sudo cat /etc/nginx/sites-available/site-endless-summer
```

### 2. Если там есть старый контент или неправильная структура:

```bash
# Удалите старый файл
sudo rm /etc/nginx/sites-available/site-endless-summer
sudo rm /etc/nginx/sites-enabled/site-endless-summer

# Создайте новый файл
sudo nano /etc/nginx/sites-available/site-endless-summer
```

### 3. Вставьте правильную конфигурацию:

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

### 4. Если есть SSL (HTTPS):

```nginx
server {
    listen 80;
    server_name site.endless-summer.ru;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name site.endless-summer.ru;

    ssl_certificate /etc/letsencrypt/live/site.endless-summer.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/site.endless-summer.ru/privkey.pem;

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

### 5. После сохранения:

```bash
# Создайте симлинк
sudo ln -s /etc/nginx/sites-available/site-endless-summer /etc/nginx/sites-enabled/

# Проверьте конфигурацию
sudo nginx -t

# Если все ОК, перезагрузите
sudo systemctl reload nginx
```

### 6. Проверка:

```bash
curl http://localhost:3000  # Должна вернуться HTML страница
curl -I https://site.endless-summer.ru  # Должен показать ваш сайт
```

