# Manual Deployment Guide

## Quick Deploy Commands

### SSH into server:
```bash
ssh droneuser@134.199.192.164
# Password: dronestrike-v2-prod.XGT13ds
```

### Deploy everything:
```bash
cd /home/droneuser/dronestrike-v2
./deploy.sh
```

### Deploy only backend:
```bash
cd /home/droneuser/dronestrike-v2/django_backend
source venv/bin/activate
git pull origin main
python manage.py migrate
pkill -f "manage.py runserver" || true
nohup python manage.py runserver 0.0.0.0:8000 > django.log 2>&1 &
```

### Deploy only frontend:
```bash
cd /home/droneuser/dronestrike-v2/frontend
git pull origin main
npm ci
npm run build
sudo cp -r build/* /var/www/dronestrike-v2/
sudo systemctl restart nginx
```

### Check status:
```bash
# Check if services are running
ps aux | grep "manage.py runserver"
sudo systemctl status nginx

# Check logs
tail -f /home/droneuser/dronestrike-v2/django_backend/django.log
sudo tail -f /var/log/nginx/error.log
```

## One-liner Deploy (from your local machine):

```bash
sshpass -p 'dronestrike-v2-prod.XGT13ds' ssh droneuser@134.199.192.164 'cd /home/droneuser/dronestrike-v2 && git pull origin main && ./deploy.sh'
```