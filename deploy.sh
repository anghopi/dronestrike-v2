#!/bin/bash

# DroneStrike v2 Deployment Script
# Usage: ./deploy.sh [frontend|backend|all]

set -e

echo "DroneStrike v2 Deployment Script"
echo "=================================="

COMMAND=${1:-all}

deploy_backend() {
    echo "Deploying Django Backend..."
    cd django_backend
    
    echo "  - Installing Python dependencies..."
    pip install -r requirements.txt
    
    echo "  - Running database migrations..."
    python manage.py migrate
    
    echo "  - Collecting static files..."
    python manage.py collectstatic --noinput
    
    echo "  - Starting Django server with ASGI..."
    pkill -f "manage.py runserver" || true
    nohup python manage.py runserver 0.0.0.0:8000 --noreload > ../backend.log 2>&1 &
    echo $! > ../backend.pid
    
    echo "Backend deployed successfully!"
    cd ..
}

deploy_frontend() {
    echo "Deploying React Frontend..."
    cd frontend
    
    echo "  - Installing Node.js dependencies..."
    npm install
    
    echo "  - Building production bundle..."
    npm run build
    
    echo "  - Starting frontend server..."
    pkill -f "serve -s build" || true
    nohup npx serve -s build -p 3000 -l tcp://0.0.0.0:3000 > ../frontend.log 2>&1 &
    echo $! > ../frontend.pid
    
    echo "Frontend deployed successfully!"
    cd ..
}

case $COMMAND in
    "backend")
        deploy_backend
        ;;
    "frontend")
        deploy_frontend
        ;;
    "all")
        deploy_backend
        deploy_frontend
        ;;
    *)
        echo "Usage: $0 [frontend|backend|all]"
        exit 1
        ;;
esac

echo ""
echo "Deployment Complete!"
echo "========================"
echo "Backend running on: http://134.199.192.164:8000"
echo "Frontend running on: http://134.199.192.164:3000"
echo ""
echo "Service Status:"
if pgrep -f "manage.py runserver" > /dev/null; then
    echo "Django Backend: Running"
else
    echo "Django Backend: Not Running"
fi

if pgrep -f "serve -s build" > /dev/null; then
    echo "React Frontend: Running"
else
    echo "React Frontend: Not Running"
fi

echo ""
echo "Log files:"
echo "  - Backend: backend.log"
echo "  - Frontend: frontend.log"