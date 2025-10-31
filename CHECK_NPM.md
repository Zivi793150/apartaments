# Проверка Nginx Proxy Manager

## Проверка, работает ли NPM:

```bash
# Проверка портов 81 и 80
sudo netstat -tulpn | grep -E ":81|:80"

# Проверка процессов NPM
sudo ps aux | grep -i "nginx-proxy\|npm" | grep -v grep

# Проверка Docker (если NPM в Docker)
sudo docker ps | grep nginx

# Проверка статуса сервисов
sudo systemctl status nginx-proxy-manager
sudo systemctl status docker
```

## Если NPM не запущен или не установлен:

### Вариант 1: Через Docker (рекомендуется)

```bash
# Установка Docker (если нет)
sudo apt update
sudo apt install docker.io docker-compose -y
sudo systemctl start docker
sudo systemctl enable docker

# Добавление пользователя в группу docker
sudo usermod -aG docker $USER
newgrp docker

# Запуск Nginx Proxy Manager
docker run -d \
  --name nginx-proxy-manager \
  --restart unless-stopped \
  -p 80:80 \
  -p 81:81 \
  -p 443:443 \
  -v /home/vika/nginx-proxy-manager/data:/data \
  -v /home/vika/nginx-proxy-manager/letsencrypt:/etc/letsencrypt \
  jc21/nginx-proxy-manager:latest
```

### Вариант 2: Через обычный Nginx (если NPM не нужен)

Тогда нужно просто правильно настроить обычный Nginx:

```bash
# Удалите неправильный файл
sudo rm /etc/nginx/sites-enabled/site-endless-summer

# Создайте правильный
sudo nano /etc/nginx/sites-available/site-endless-summer
```

Вставьте:
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

```bash
sudo ln -s /etc/nginx/sites-available/site-endless-summer /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

