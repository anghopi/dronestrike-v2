#!/bin/bash
# Blue-Green Deployment Script for DroneStrike v2
# Production-ready deployment with zero-downtime and automatic rollback

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOY_CONFIG="${SCRIPT_DIR}/deploy-config.env"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load configuration
if [[ -f "$DEPLOY_CONFIG" ]]; then
    source "$DEPLOY_CONFIG"
else
    echo -e "${RED}Error: Deploy configuration file not found: $DEPLOY_CONFIG${NC}"
    exit 1
fi

# Required environment variables
REQUIRED_VARS=(
    "DOCKER_REGISTRY"
    "IMAGE_NAME"
    "IMAGE_TAG"
    "BLUE_CONTAINER_NAME"
    "GREEN_CONTAINER_NAME"
    "LOAD_BALANCER_CONFIG"
    "HEALTH_CHECK_URL"
    "DATABASE_URL"
    "BACKUP_ENABLED"
)

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validate environment
validate_environment() {
    log_info "Validating deployment environment..."
    
    for var in "${REQUIRED_VARS[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log_error "Required environment variable $var is not set"
            exit 1
        fi
    done
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed or not in PATH"
        exit 1
    fi
    
    # Check network connectivity
    if ! ping -c 1 google.com &> /dev/null; then
        log_warning "No internet connectivity detected"
    fi
    
    log_success "Environment validation completed"
}

# Create backup before deployment
create_backup() {
    if [[ "$BACKUP_ENABLED" == "true" ]]; then
        log_info "Creating pre-deployment backup..."
        
        BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
        BACKUP_PATH="/backups/${BACKUP_FILE}"
        
        # Create database backup
        docker exec dronestrike-postgres pg_dump \
            -h localhost \
            -U "$DATABASE_USER" \
            -d "$DATABASE_NAME" \
            --no-password \
            --format=custom \
            --compress=9 \
            > "$BACKUP_PATH"
        
        if [[ $? -eq 0 ]]; then
            log_success "Backup created: $BACKUP_PATH"
            echo "$BACKUP_PATH" > /tmp/latest_backup.txt
        else
            log_error "Backup creation failed"
            exit 1
        fi
    else
        log_info "Backup disabled, skipping..."
    fi
}

# Pull latest images
pull_images() {
    log_info "Pulling latest images..."
    
    local image_full="${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
    
    if docker pull "$image_full"; then
        log_success "Successfully pulled image: $image_full"
    else
        log_error "Failed to pull image: $image_full"
        exit 1
    fi
}

# Determine current active environment
get_active_environment() {
    local blue_running=$(docker ps --filter "name=${BLUE_CONTAINER_NAME}" --filter "status=running" -q)
    local green_running=$(docker ps --filter "name=${GREEN_CONTAINER_NAME}" --filter "status=running" -q)
    
    if [[ -n "$blue_running" && -z "$green_running" ]]; then
        echo "blue"
    elif [[ -z "$blue_running" && -n "$green_running" ]]; then
        echo "green"
    elif [[ -n "$blue_running" && -n "$green_running" ]]; then
        echo "both"
    else
        echo "none"
    fi
}

# Get target environment for deployment
get_target_environment() {
    local active=$(get_active_environment)
    
    case "$active" in
        "blue"|"both")
            echo "green"
            ;;
        "green"|"none")
            echo "blue"
            ;;
        *)
            log_error "Unknown active environment: $active"
            exit 1
            ;;
    esac
}

# Deploy to target environment
deploy_to_environment() {
    local target_env="$1"
    local image_full="${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
    
    log_info "Deploying to $target_env environment..."
    
    # Set environment-specific variables
    if [[ "$target_env" == "blue" ]]; then
        CONTAINER_NAME="$BLUE_CONTAINER_NAME"
        PORT="$BLUE_PORT"
        NETWORK="$BLUE_NETWORK"
    else
        CONTAINER_NAME="$GREEN_CONTAINER_NAME"
        PORT="$GREEN_PORT"
        NETWORK="$GREEN_NETWORK"
    fi
    
    # Stop and remove existing container
    if docker ps -a --filter "name=${CONTAINER_NAME}" -q | grep -q .; then
        log_info "Stopping existing container: $CONTAINER_NAME"
        docker stop "$CONTAINER_NAME" || true
        docker rm "$CONTAINER_NAME" || true
    fi
    
    # Run database migrations
    log_info "Running database migrations..."
    docker run --rm \
        --network "$NETWORK" \
        --env-file "$PROJECT_ROOT/.env.production" \
        "$image_full" \
        python -m cli.database migrate up
    
    if [[ $? -ne 0 ]]; then
        log_error "Database migration failed"
        exit 1
    fi
    
    # Start new container
    log_info "Starting new container: $CONTAINER_NAME"
    docker run -d \
        --name "$CONTAINER_NAME" \
        --network "$NETWORK" \
        --port "$PORT:8000" \
        --env-file "$PROJECT_ROOT/.env.production" \
        --restart unless-stopped \
        --health-cmd="./health-check.sh" \
        --health-interval=30s \
        --health-timeout=10s \
        --health-retries=3 \
        --health-start-period=60s \
        -v "${PROJECT_ROOT}/logs:/app/logs" \
        -v "${PROJECT_ROOT}/uploads:/app/uploads" \
        -v "${PROJECT_ROOT}/backups:/app/backups" \
        "$image_full"
    
    if [[ $? -eq 0 ]]; then
        log_success "Container started successfully: $CONTAINER_NAME"
    else
        log_error "Failed to start container: $CONTAINER_NAME"
        exit 1
    fi
}

# Health check for deployed environment
health_check() {
    local target_env="$1"
    local max_attempts=30
    local attempt=1
    
    log_info "Performing health check for $target_env environment..."
    
    # Determine port based on environment
    if [[ "$target_env" == "blue" ]]; then
        local port="$BLUE_PORT"
    else
        local port="$GREEN_PORT"
    fi
    
    local health_url="http://localhost:${port}/health"
    
    while [[ $attempt -le $max_attempts ]]; do
        log_info "Health check attempt $attempt/$max_attempts..."
        
        if curl -sf --max-time 10 "$health_url" > /dev/null 2>&1; then
            log_success "Health check passed for $target_env environment"
            return 0
        fi
        
        sleep 10
        ((attempt++))
    done
    
    log_error "Health check failed for $target_env environment after $max_attempts attempts"
    return 1
}

# Update load balancer configuration
update_load_balancer() {
    local target_env="$1"
    
    log_info "Updating load balancer to point to $target_env environment..."
    
    # Determine target port
    if [[ "$target_env" == "blue" ]]; then
        local target_port="$BLUE_PORT"
    else
        local target_port="$GREEN_PORT"
    fi
    
    # Update nginx configuration
    sed -i.backup "s/proxy_pass http:\/\/.*:/proxy_pass http:\/\/localhost:${target_port}/" \
        "$LOAD_BALANCER_CONFIG"
    
    # Reload nginx
    if command -v nginx &> /dev/null; then
        nginx -s reload
    elif docker ps --filter "name=nginx" -q | grep -q .; then
        docker exec nginx nginx -s reload
    else
        log_warning "Could not reload nginx configuration"
    fi
    
    log_success "Load balancer updated to point to $target_env environment"
}

# Verify deployment success
verify_deployment() {
    local target_env="$1"
    
    log_info "Verifying deployment success..."
    
    # Check application health
    if ! health_check "$target_env"; then
        return 1
    fi
    
    # Check database connectivity
    log_info "Checking database connectivity..."
    if [[ "$target_env" == "blue" ]]; then
        local container_name="$BLUE_CONTAINER_NAME"
    else
        local container_name="$GREEN_CONTAINER_NAME"
    fi
    
    if docker exec "$container_name" python -c "
import asyncio
from core.database import engine
from sqlalchemy import text

async def check():
    async with engine.begin() as conn:
        result = await conn.execute(text('SELECT 1'))
        return result.scalar() == 1

if not asyncio.run(check()):
    exit(1)
"; then
        log_success "Database connectivity verified"
    else
        log_error "Database connectivity check failed"
        return 1
    fi
    
    # Check background tasks
    log_info "Checking background task system..."
    if docker exec "$container_name" celery -A tasks.celery_app inspect ping; then
        log_success "Background task system verified"
    else
        log_warning "Background task system check failed"
    fi
    
    log_success "Deployment verification completed"
    return 0
}

# Rollback deployment
rollback_deployment() {
    local failed_env="$1"
    local active_env=$(get_active_environment)
    
    log_warning "Rolling back deployment..."
    
    # Stop failed environment
    if [[ "$failed_env" == "blue" ]]; then
        docker stop "$BLUE_CONTAINER_NAME" || true
        docker rm "$BLUE_CONTAINER_NAME" || true
    else
        docker stop "$GREEN_CONTAINER_NAME" || true
        docker rm "$GREEN_CONTAINER_NAME" || true
    fi
    
    # Restore load balancer configuration
    if [[ -f "${LOAD_BALANCER_CONFIG}.backup" ]]; then
        mv "${LOAD_BALANCER_CONFIG}.backup" "$LOAD_BALANCER_CONFIG"
        
        # Reload nginx
        if command -v nginx &> /dev/null; then
            nginx -s reload
        elif docker ps --filter "name=nginx" -q | grep -q .; then
            docker exec nginx nginx -s reload
        fi
    fi
    
    # Restore database backup if needed
    if [[ -f "/tmp/latest_backup.txt" ]]; then
        local backup_file=$(cat /tmp/latest_backup.txt)
        if [[ -f "$backup_file" ]]; then
            log_info "Restoring database backup: $backup_file"
            docker exec -i dronestrike-postgres pg_restore \
                -h localhost \
                -U "$DATABASE_USER" \
                -d "$DATABASE_NAME" \
                --clean \
                --no-owner \
                --no-privileges \
                < "$backup_file"
        fi
    fi
    
    log_success "Rollback completed"
}

# Cleanup old environment
cleanup_old_environment() {
    local target_env="$1"
    local old_env
    
    if [[ "$target_env" == "blue" ]]; then
        old_env="green"
    else
        old_env="blue"
    fi
    
    log_info "Cleaning up old $old_env environment..."
    
    # Give some time for load balancer to fully switch
    sleep 30
    
    # Stop and remove old container
    if [[ "$old_env" == "blue" ]]; then
        docker stop "$BLUE_CONTAINER_NAME" 2>/dev/null || true
        docker rm "$BLUE_CONTAINER_NAME" 2>/dev/null || true
    else
        docker stop "$GREEN_CONTAINER_NAME" 2>/dev/null || true
        docker rm "$GREEN_CONTAINER_NAME" 2>/dev/null || true
    fi
    
    log_success "Cleanup completed for $old_env environment"
}

# Send deployment notification
send_notification() {
    local status="$1"
    local target_env="$2"
    
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local color
        local message
        
        if [[ "$status" == "success" ]]; then
            color="good"
            message="✅ DroneStrike v2 deployment successful to $target_env environment"
        else
            color="danger"
            message="❌ DroneStrike v2 deployment failed to $target_env environment"
        fi
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"text\": \"$message\",
                    \"fields\": [
                        {\"title\": \"Environment\", \"value\": \"$target_env\", \"short\": true},
                        {\"title\": \"Image Tag\", \"value\": \"$IMAGE_TAG\", \"short\": true},
                        {\"title\": \"Timestamp\", \"value\": \"$(date)\", \"short\": true}
                    ]
                }]
            }" \
            "$SLACK_WEBHOOK_URL"
    fi
}

# Main deployment function
main() {
    log_info "Starting Blue-Green deployment for DroneStrike v2"
    log_info "Image: ${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
    
    # Validate environment
    validate_environment
    
    # Determine deployment target
    local active_env=$(get_active_environment)
    local target_env=$(get_target_environment)
    
    log_info "Active environment: $active_env"
    log_info "Target environment: $target_env"
    
    # Create backup
    create_backup
    
    # Pull latest images
    pull_images
    
    # Deploy to target environment
    deploy_to_environment "$target_env"
    
    # Verify deployment
    if verify_deployment "$target_env"; then
        # Update load balancer
        update_load_balancer "$target_env"
        
        # Final health check through load balancer
        sleep 10
        if health_check "$target_env"; then
            log_success "Deployment successful!"
            
            # Cleanup old environment
            cleanup_old_environment "$target_env"
            
            # Send success notification
            send_notification "success" "$target_env"
            
            log_success "Blue-Green deployment completed successfully"
        else
            log_error "Final health check failed, rolling back..."
            rollback_deployment "$target_env"
            send_notification "failure" "$target_env"
            exit 1
        fi
    else
        log_error "Deployment verification failed, rolling back..."
        rollback_deployment "$target_env"
        send_notification "failure" "$target_env"
        exit 1
    fi
}

# Handle script interruption
trap 'log_error "Deployment interrupted"; exit 1' INT TERM

# Parse command line arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "status")
        echo "Active environment: $(get_active_environment)"
        ;;
    "rollback")
        if [[ -n "${2:-}" ]]; then
            rollback_deployment "$2"
        else
            log_error "Please specify environment to rollback (blue|green)"
            exit 1
        fi
        ;;
    "cleanup")
        if [[ -n "${2:-}" ]]; then
            cleanup_old_environment "$2"
        else
            log_error "Please specify environment to cleanup (blue|green)"
            exit 1
        fi
        ;;
    *)
        echo "Usage: $0 {deploy|status|rollback|cleanup} [environment]"
        exit 1
        ;;
esac