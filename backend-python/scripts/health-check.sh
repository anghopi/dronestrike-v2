#!/bin/bash
# Production Health Check Script for DroneStrike v2
# Comprehensive health monitoring with detailed checks

set -e

# Configuration
HEALTH_CHECK_URL="http://localhost:8000/health"
TIMEOUT=10
MAX_RETRIES=3
LOG_FILE="/app/logs/health-check.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check if service is responding
check_http_health() {
    local url="$1"
    local timeout="$2"
    
    if curl -sf --max-time "$timeout" "$url" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Check database connectivity
check_database() {
    python3 -c "
import asyncio
import sys
from core.database import engine
from sqlalchemy import text

async def check_db():
    try:
        async with engine.begin() as conn:
            result = await conn.execute(text('SELECT 1'))
            return result.scalar() == 1
    except Exception as e:
        print(f'Database check failed: {e}', file=sys.stderr)
        return False

if not asyncio.run(check_db()):
    sys.exit(1)
" 2>/dev/null
}

# Check Redis connectivity
check_redis() {
    python3 -c "
import redis
import sys
import os

try:
    r = redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379'))
    r.ping()
    print('Redis OK')
except Exception as e:
    print(f'Redis check failed: {e}', file=sys.stderr)
    sys.exit(1)
" 2>/dev/null
}

# Check disk space
check_disk_space() {
    local threshold=90
    local usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [ "$usage" -gt "$threshold" ]; then
        log "ERROR: Disk usage is ${usage}% (threshold: ${threshold}%)"
        return 1
    fi
    
    return 0
}

# Check memory usage
check_memory() {
    local threshold=90
    local usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    
    if [ "$usage" -gt "$threshold" ]; then
        log "WARNING: Memory usage is ${usage}% (threshold: ${threshold}%)"
        return 1
    fi
    
    return 0
}

# Check CPU load
check_cpu_load() {
    local threshold=80
    local load=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
    
    if (( $(echo "$load > $threshold" | bc -l) )); then
        log "WARNING: CPU load is ${load}% (threshold: ${threshold}%)"
        return 1
    fi
    
    return 0
}

# Check log file sizes
check_log_sizes() {
    local max_size=104857600  # 100MB in bytes
    
    for logfile in /app/logs/*.log; do
        if [ -f "$logfile" ]; then
            local size=$(stat -f%z "$logfile" 2>/dev/null || stat -c%s "$logfile" 2>/dev/null)
            if [ "$size" -gt "$max_size" ]; then
                log "WARNING: Log file $logfile is $(($size / 1024 / 1024))MB (max: 100MB)"
            fi
        fi
    done
}

# Main health check function
main_health_check() {
    local exit_code=0
    
    echo -e "${GREEN}Starting DroneStrike v2 Health Check...${NC}"
    log "INFO: Starting comprehensive health check"
    
    # Check HTTP endpoint
    echo -n "Checking HTTP endpoint... "
    if check_http_health "$HEALTH_CHECK_URL" "$TIMEOUT"; then
        echo -e "${GREEN}OK${NC}"
        log "INFO: HTTP endpoint check passed"
    else
        echo -e "${RED}FAILED${NC}"
        log "ERROR: HTTP endpoint check failed"
        exit_code=1
    fi
    
    # Check database
    echo -n "Checking database connectivity... "
    if check_database; then
        echo -e "${GREEN}OK${NC}"
        log "INFO: Database connectivity check passed"
    else
        echo -e "${RED}FAILED${NC}"
        log "ERROR: Database connectivity check failed"
        exit_code=1
    fi
    
    # Check Redis
    echo -n "Checking Redis connectivity... "
    if check_redis; then
        echo -e "${GREEN}OK${NC}"
        log "INFO: Redis connectivity check passed"
    else
        echo -e "${RED}FAILED${NC}"
        log "ERROR: Redis connectivity check failed"
        exit_code=1
    fi
    
    # Check disk space
    echo -n "Checking disk space... "
    if check_disk_space; then
        echo -e "${GREEN}OK${NC}"
        log "INFO: Disk space check passed"
    else
        echo -e "${YELLOW}WARNING${NC}"
        log "WARNING: Disk space check failed"
        # Don't fail health check for disk space warning
    fi
    
    # Check memory
    echo -n "Checking memory usage... "
    if check_memory; then
        echo -e "${GREEN}OK${NC}"
        log "INFO: Memory usage check passed"
    else
        echo -e "${YELLOW}WARNING${NC}"
        log "WARNING: Memory usage check failed"
        # Don't fail health check for memory warning
    fi
    
    # Check CPU load
    echo -n "Checking CPU load... "
    if check_cpu_load; then
        echo -e "${GREEN}OK${NC}"
        log "INFO: CPU load check passed"
    else
        echo -e "${YELLOW}WARNING${NC}"
        log "WARNING: CPU load check failed"
        # Don't fail health check for CPU warning
    fi
    
    # Check log file sizes
    echo -n "Checking log file sizes... "
    check_log_sizes
    echo -e "${GREEN}OK${NC}"
    log "INFO: Log file size check completed"
    
    # Final status
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✓ Health check PASSED${NC}"
        log "INFO: Overall health check PASSED"
    else
        echo -e "${RED}✗ Health check FAILED${NC}"
        log "ERROR: Overall health check FAILED"
    fi
    
    return $exit_code
}

# Retry logic
retry_count=0
while [ $retry_count -lt $MAX_RETRIES ]; do
    if main_health_check; then
        exit 0
    fi
    
    retry_count=$((retry_count + 1))
    if [ $retry_count -lt $MAX_RETRIES ]; then
        echo -e "${YELLOW}Retrying health check in 5 seconds... (${retry_count}/${MAX_RETRIES})${NC}"
        sleep 5
    fi
done

echo -e "${RED}Health check failed after $MAX_RETRIES attempts${NC}"
log "ERROR: Health check failed after $MAX_RETRIES attempts"
exit 1