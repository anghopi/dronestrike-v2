#!/bin/bash
set -e

echo "Starting deployment..."

# Update code
echo "Updating code..."
git fetch origin main
git stash push -m "Auto-stash before deployment" || true
git clean -fd || true
git pull origin main
echo "Code updated successfully"

# Backend deployment
echo "Deploying backend..."
cd django_backend
source venv/bin/activate
python manage.py migrate --noinput || true
pkill -f "manage.py runserver" || true
nohup python manage.py runserver 0.0.0.0:8000 > django.log 2>&1 &
sleep 1
echo "Backend restarted successfully"

# Frontend deployment
echo "Deploying frontend..."
cd ../frontend
if [ -d "build" ]; then
    sudo cp -r build/* /var/www/dronestrike-v2/
    sudo systemctl restart nginx
    echo "Frontend deployed successfully"
else
    echo "No build directory found - building frontend..."
    npm ci --silent
    npm run build --silent
    if [ -d "build" ]; then
        sudo cp -r build/* /var/www/dronestrike-v2/
        sudo systemctl restart nginx
        echo "Frontend built and deployed successfully"
    else
        echo "Frontend build failed"
        exit 1
    fi
fi

echo "Deployment completed successfully"