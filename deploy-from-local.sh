#!/bin/bash

# Deploy DroneStrike v2 from local machine to production server
# Usage: ./deploy-from-local.sh

set -e

SERVER="134.199.192.164"
USER="droneuser"
PASSWORD="dronestrike-v2-prod.XGT13ds"

echo "Deploying DroneStrike v2 to production..."

# Push latest changes to GitHub
echo "Pushing latest changes to GitHub..."
git add .
git commit -m "Deploy $(date)" || echo "No changes to commit"
git push origin main

# Deploy on server
echo "Deploying on server..."
sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no "$USER@$SERVER" << 'EOF'
cd /home/droneuser/dronestrike-v2
echo "Pulling latest code..."
git pull origin main
echo "Running deployment script..."
chmod +x deploy.sh
sudo ./deploy.sh
echo "Deployment completed!"
EOF

echo "Deployment finished successfully!"
echo "Frontend: http://$SERVER"
echo "Backend API: http://$SERVER:8000/api/"