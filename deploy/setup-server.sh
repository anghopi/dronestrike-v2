#!/bin/bash
# Digital Ocean Server Setup Script
# Run this on your DO droplet as root first, then as droneuser

echo "=== DroneStrike v2 Server Setup ==="

# Update system
apt update && apt upgrade -y

# Install required packages
apt install -y nginx python3 python3-pip python3-venv nodejs npm postgresql postgresql-contrib redis-server git

# Setup PostgreSQL
sudo -u postgres createuser dronestrike
sudo -u postgres createdb dronestrike_v2
sudo -u postgres psql -c "ALTER USER dronestrike PASSWORD 'secure_password';"

# Create application directory
mkdir -p /home/droneuser/dronestrike-v2
chown droneuser:droneuser /home/droneuser/dronestrike-v2

# Create web directory
mkdir -p /var/www/dronestrike-v2
chown droneuser:droneuser /var/www/dronestrike-v2

# Setup Nginx
cat > /etc/nginx/sites-available/dronestrike-v2 << 'EOL'
server {
    listen 80;
    server_name dronestrike-v2;
    
    # Frontend
    location / {
        root /var/www/dronestrike-v2;
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOL

ln -s /etc/nginx/sites-available/dronestrike-v2 /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx

# Setup systemd service for Django
cat > /etc/systemd/system/dronestrike-django.service << 'EOL'
[Unit]
Description=DroneStrike Django App
After=network.target

[Service]
Type=exec
User=droneuser
Group=droneuser
WorkingDirectory=/home/droneuser/dronestrike-v2/django_backend
Environment=PATH=/home/droneuser/dronestrike-v2/django_backend/venv/bin
ExecStart=/home/droneuser/dronestrike-v2/django_backend/venv/bin/gunicorn dronestrike_v2.wsgi:application --bind 127.0.0.1:8000
Restart=always

[Install]
WantedBy=multi-user.target
EOL

systemctl daemon-reload
systemctl enable dronestrike-django

echo "=== Setup complete! Now run as droneuser: ==="
echo "cd /home/droneuser"
echo "git clone https://github.com/anghopi/dronestrike-v2.git"
echo "cd dronestrike-v2/django_backend"
echo "python3 -m venv venv"
echo "source venv/bin/activate"
echo "pip install -r requirements.txt"
echo "python manage.py migrate"
echo "sudo systemctl start dronestrike-django"