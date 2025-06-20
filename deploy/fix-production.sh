#!/bin/bash
# Fix Production Deployment Script

echo "Fixing DroneStrike v2 Production Deployment..."

# Update environment for production
echo "Updating environment configuration..."
echo "REACT_APP_API_URL=http://134.199.192.164" > frontend/.env.production
echo "REACT_APP_ENVIRONMENT=production" >> frontend/.env.production

# Copy current working .env to production env
cp .env frontend/.env.production.local

echo "Environment updated for production"
echo ""
echo "Now run these commands on your production server:"
echo ""
echo "ssh droneuser@134.199.192.164"
echo ""
echo "# Update code"
echo "cd dronestrike-v2"
echo "git pull origin main"
echo ""
echo "# Fix Django backend"
echo "cd django_backend"
echo "source venv/bin/activate"
echo "echo 'ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0,134.199.192.164' >> .env"
echo "pip install -r requirements.txt"
echo "python manage.py migrate"
echo "python manage.py collectstatic --noinput"
echo "pkill -f 'manage.py runserver'"
echo "nohup python manage.py runserver 0.0.0.0:8000 > django.log 2>&1 &"
echo ""
echo "# Fix React frontend"
echo "cd ../frontend"
echo "npm install"
echo "REACT_APP_API_URL=http://134.199.192.164 npm run build"
echo "sudo rm -rf /var/www/dronestrike-v2/*"
echo "sudo cp -r build/* /var/www/dronestrike-v2/"
echo "sudo systemctl restart nginx"
echo ""
echo "# Verify deployment"
echo "curl http://localhost"
echo "curl http://134.199.192.164"
echo ""
echo "Production should now match localhost!"