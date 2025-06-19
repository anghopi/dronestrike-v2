# Digital Ocean Deployment Setup

## 1. Server Information
- **Host**: dronestrike-v2
- **Root Password**: dronestrike-v2-prod.XGT13ds
- **User**: droneuser
- **User Password**: dronestrike-v2-prod.XGT13ds

## 2. Initial Server Setup
Run on your DO droplet as root:
```bash
wget https://raw.githubusercontent.com/anghopi/dronestrike-v2/main/deploy/setup-server.sh
chmod +x setup-server.sh
./setup-server.sh
```

## 3. GitHub Secrets Setup
Add these secrets to your GitHub repository:

### Repository → Settings → Secrets and Variables → Actions

**DO_SSH_PRIVATE_KEY**: Your SSH private key for the droneuser account

Generate SSH key pair:
```bash
# On your local machine
ssh-keygen -t rsa -b 4096 -C "deployment@dronestrike-v2"
# Save as: ~/.ssh/dronestrike_v2_deploy

# Copy public key to server
ssh-copy-id -i ~/.ssh/dronestrike_v2_deploy.pub droneuser@dronestrike-v2

# Add private key content to GitHub secret
cat ~/.ssh/dronestrike_v2_deploy
```

## 4. Deployment Process
1. Push to `main` branch
2. GitHub Actions automatically:
   - Connects to your DO server
   - Pulls latest code
   - Updates backend dependencies
   - Runs database migrations
   - Builds frontend
   - Restarts services
   - Deployment complete!

## 5. Manual Commands (if needed)
```bash
# Connect to server
ssh droneuser@dronestrike-v2

# Check service status
sudo systemctl status dronestrike-django
sudo systemctl status nginx

# View logs
sudo journalctl -u dronestrike-django -f
sudo tail -f /var/log/nginx/error.log
```

## 6. Environment Variables
Make sure your DO server has the same `.env` file in `/home/droneuser/dronestrike-v2/django_backend/.env`