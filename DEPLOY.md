# Инструкция по развертыванию на VPS

## Шаг 1: Подготовка сервера

### Подключение к серверу
```bash
# В Termius подключитесь к серверу по SSH
ssh root@ваш_ip_адрес
```

### Обновление системы (Ubuntu/Debian)
```bash
sudo apt update && sudo apt upgrade -y
```

## Шаг 2: Установка Node.js (версия 20.x)

```bash
# Установка Node.js через nvm (рекомендуемый способ)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# Установка Node.js 20
nvm install 20
nvm use 20
nvm alias default 20

# Проверка установки
node --version  # должен показать v20.x.x
npm --version
```

**Альтернативный способ (если nvm не работает):**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## Шаг 3: Установка PM2 (менеджер процессов)

```bash
sudo npm install -g pm2
```

## Шаг 4: Установка Nginx

```bash
sudo apt install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

## Шаг 5: Загрузка проекта на сервер

### Вариант A: Через Git (рекомендуется)
```bash
# Установка Git
sudo apt install git -y

# Переход в домашнюю директорию
cd ~

# Клонирование проекта (если есть репозиторий)
git clone <ваш_репозиторий> apart-site
cd apart-site/web
```

### Вариант B: Через SCP/SFTP (если нет Git)
```bash
# На вашем локальном компьютере (в Termius или через терминал)
# Замените 'username' на ваше имя пользователя на сервере
scp -r web username@ваш_ip:~/apart-site/
```

### Вариант C: Через встроенный SFTP в Termius
1. В Termius выберите подключение к серверу
2. Нажмите SFTP
3. Перейдите в домашнюю директорию (~ или /home/ваше_имя/)
4. Создайте папку `apart-site/web` (если нужно)
5. Загрузите папку `web` в `~/apart-site/web/` или `/home/ваше_имя/apart-site/web/`

## Шаг 6: Установка зависимостей и сборка

```bash
# Переход в директорию проекта
cd ~/apart-site/web

# Установка зависимостей
npm install --production=false

# Сборка проекта
npm run build
```

## Шаг 7: Настройка PM2

```bash
# Запуск приложения через PM2
pm2 start npm --name "apart-site" -- start

# Сохранение конфигурации PM2
pm2 save

# Настройка автозапуска при перезагрузке
pm2 startup
# Выполните команду, которую PM2 покажет (обычно что-то вроде:)
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ваш_username --hp /home/ваш_username
# Замените 'ваш_username' на ваше имя пользователя
```

## Шаг 8: Настройка Nginx как Reverse Proxy

```bash
# Создание конфигурации для сайта
sudo nano /etc/nginx/sites-available/apart-site
```

**Вставьте следующую конфигурацию:**
```nginx
server {
    listen 80;
    server_name ваш_домен.ru www.ваш_домен.ru;  # Замените на ваш домен или IP

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

**Активация конфигурации:**
```bash
sudo ln -s /etc/nginx/sites-available/apart-site /etc/nginx/sites-enabled/
sudo nginx -t  # проверка конфигурации
sudo systemctl reload nginx
```

## Шаг 9: Настройка Firewall (UFW)

```bash
# Разрешение HTTP и HTTPS
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

## Шаг 10: Установка SSL сертификата (Let's Encrypt)

```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx -y

# Получение SSL сертификата (замените на ваш домен)
sudo certbot --nginx -d ваш_домен.ru -d www.ваш_домен.ru

# Автоматическое обновление сертификата
sudo certbot renew --dry-run
```

## Шаг 11: Проверка работы

```bash
# Проверка статуса PM2
pm2 status
pm2 logs apart-site

# Проверка Nginx
sudo systemctl status nginx

# Откройте в браузере ваш домен или IP адрес
```

## Полезные команды для управления

### PM2 команды:
```bash
pm2 status              # Статус процессов
pm2 logs apart-site     # Логи приложения
pm2 restart apart-site  # Перезапуск
pm2 stop apart-site     # Остановка
pm2 delete apart-site   # Удаление
pm2 monit               # Мониторинг в реальном времени
```

### Обновление приложения:
```bash
cd ~/apart-site/web
git pull              # если используете Git
# или загрузите новые файлы через SFTP

npm install            # обновить зависимости
npm run build         # пересобрать
pm2 restart apart-site # перезапустить
```

### Логи:
```bash
# Логи приложения
pm2 logs apart-site

# Логи Nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

## Решение проблем

### Если приложение не запускается:
```bash
# Проверьте логи
pm2 logs apart-site --lines 50

# Проверьте, занят ли порт 3000
sudo lsof -i :3000

# Убедитесь, что сборка прошла успешно
ls -la ~/apart-site/web/.next
```

### Если Nginx не работает:
```bash
# Проверьте конфигурацию
sudo nginx -t

# Проверьте статус
sudo systemctl status nginx

# Перезапустите
sudo systemctl restart nginx
```

## Оптимизация (опционально)

### Увеличение лимита памяти Node.js:
```bash
pm2 delete apart-site
pm2 start npm --name "apart-site" -- start -- --max-old-space-size=4096
pm2 save
```

### Настройка автоперезапуска при сбое:
PM2 уже настроен на автоперезапуск по умолчанию.

## Готово! 🎉

Ваш сайт должен быть доступен по адресу вашего домена или IP.

