#!/bin/bash
#######################################################################
# AUTOMATED REPAIR SCRIPT - Fixes Common Issues Automatically
# Run via cron every 5 minutes to detect and repair issues
#######################################################################

set -e

# Configuration
PROJECT_DIR="/root/crypto-tracker"
LOG_FILE="/var/log/auto-repair.log"
ALERT_EMAIL="your-email@example.com"  # Change this to your email
WEBHOOK_URL=""  # Optional: Slack/Discord webhook for alerts

# Color codes for logging
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Send alert notification
send_alert() {
    local title="$1"
    local message="$2"
    local severity="$3"  # info, warning, error
    
    log_warning "ALERT: $title - $message"
    
    # Send webhook notification if configured
    if [ -n "$WEBHOOK_URL" ]; then
        curl -s -X POST "$WEBHOOK_URL" \
            -H 'Content-Type: application/json' \
            -d "{\"text\":\"🚨 $title\",\"blocks\":[{\"type\":\"section\",\"text\":{\"type\":\"mrkdwn\",\"text\":\"*$title*\n$message\"}}]}" \
            > /dev/null 2>&1 || true
    fi
}

#######################################################################
# 1. DISK SPACE CHECK AND AUTO-CLEANUP
#######################################################################
check_disk_space() {
    log "Checking disk space..."
    local disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [ "$disk_usage" -gt 85 ]; then
        log_warning "Disk usage is ${disk_usage}% - Running emergency cleanup..."
        send_alert "Disk Space Warning" "Disk usage at ${disk_usage}% - Auto-cleanup initiated" "warning"
        
        # Emergency cleanup
        cd "$PROJECT_DIR"
        
        # Clean Docker
        docker system prune -af --volumes --filter "until=24h" >> "$LOG_FILE" 2>&1
        
        # Clean logs older than 3 days
        journalctl --vacuum-time=3d >> "$LOG_FILE" 2>&1
        find /var/log -name "*.log" -type f -mtime +3 -delete 2>/dev/null || true
        
        # Clean apt cache
        apt-get clean >> "$LOG_FILE" 2>&1
        
        local new_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
        log_success "Cleanup complete. Disk usage: ${disk_usage}% → ${new_usage}%"
        send_alert "Disk Cleanup Complete" "Freed space: ${disk_usage}% → ${new_usage}%" "info"
        
        return 0
    else
        log "Disk space OK: ${disk_usage}%"
        return 0
    fi
}

#######################################################################
# 2. REDIS HEALTH CHECK AND AUTO-REPAIR
#######################################################################
check_redis() {
    log "Checking Redis health..."
    cd "$PROJECT_DIR"
    
    # Check if Redis is running
    if ! docker-compose ps redis | grep -q "Up"; then
        log_error "Redis is not running - Attempting restart..."
        send_alert "Redis Down" "Redis container stopped - Auto-restarting" "error"
        
        docker-compose restart redis >> "$LOG_FILE" 2>&1
        sleep 10
        
        if docker-compose ps redis | grep -q "Up"; then
            log_success "Redis restarted successfully"
            send_alert "Redis Recovered" "Redis container restarted successfully" "info"
            return 0
        else
            log_error "Redis restart failed - Attempting full recovery..."
            
            # Full Redis recovery
            docker-compose down redis >> "$LOG_FILE" 2>&1
            docker volume rm crypto-tracker_redis_data 2>/dev/null || true
            docker-compose up -d redis >> "$LOG_FILE" 2>&1
            sleep 15
            
            if docker-compose exec -T redis redis-cli ping | grep -q "PONG"; then
                log_success "Redis recovered with fresh volume"
                send_alert "Redis Recovered" "Redis recreated with clean data" "warning"
                return 0
            else
                log_error "Redis recovery failed - Manual intervention required"
                send_alert "Redis Recovery Failed" "Manual intervention required" "error"
                return 1
            fi
        fi
    fi
    
    # Test Redis connectivity
    if ! docker-compose exec -T redis redis-cli ping | grep -q "PONG"; then
        log_error "Redis not responding - Restarting..."
        send_alert "Redis Not Responding" "Auto-restarting Redis" "warning"
        
        docker-compose restart redis >> "$LOG_FILE" 2>&1
        sleep 10
        
        if docker-compose exec -T redis redis-cli ping | grep -q "PONG"; then
            log_success "Redis connectivity restored"
            return 0
        else
            log_error "Redis restart failed"
            return 1
        fi
    fi
    
    log "Redis health OK"
    return 0
}

#######################################################################
# 3. BACKEND HEALTH CHECK AND AUTO-REPAIR
#######################################################################
check_backend() {
    log "Checking backend health..."
    cd "$PROJECT_DIR"
    
    # Check if backend is running
    if ! docker-compose ps backend1 | grep -q "Up"; then
        log_error "Backend is not running - Attempting restart..."
        send_alert "Backend Down" "Backend container stopped - Auto-restarting" "error"
        
        docker-compose restart backend1 >> "$LOG_FILE" 2>&1
        sleep 30
        
        if docker-compose ps backend1 | grep -q "Up"; then
            log_success "Backend restarted successfully"
            send_alert "Backend Recovered" "Backend container restarted successfully" "info"
            return 0
        else
            log_error "Backend restart failed - Manual intervention required"
            send_alert "Backend Recovery Failed" "Manual intervention required" "error"
            return 1
        fi
    fi
    
    # Check backend API health (from inside container to avoid network issues)
    if docker-compose exec -T backend1 curl -sf http://localhost:8000/ > /dev/null 2>&1; then
        log "Backend API responding OK"
        return 0
    else
        log_warning "Backend API not responding - Restarting..."
        send_alert "Backend API Slow" "Restarting backend container" "warning"
        
        docker-compose restart backend1 >> "$LOG_FILE" 2>&1
        sleep 30
        
        if docker-compose exec -T backend1 curl -sf http://localhost:8000/ > /dev/null 2>&1; then
            log_success "Backend API recovered"
            return 0
        else
            log_error "Backend API still not responding"
            return 1
        fi
    fi
}

#######################################################################
# 4. FRONTEND HEALTH CHECK AND AUTO-REPAIR
#######################################################################
check_frontend() {
    log "Checking frontend health..."
    cd "$PROJECT_DIR"
    
    # Check if frontend is running
    if ! docker-compose ps frontend | grep -q "Up"; then
        log_error "Frontend is not running - Attempting restart..."
        send_alert "Frontend Down" "Frontend container stopped - Auto-restarting" "error"
        
        docker-compose restart frontend >> "$LOG_FILE" 2>&1
        sleep 20
        
        if docker-compose ps frontend | grep -q "Up"; then
            log_success "Frontend restarted successfully"
            send_alert "Frontend Recovered" "Frontend container restarted successfully" "info"
            return 0
        else
            log_error "Frontend restart failed - Manual intervention required"
            send_alert "Frontend Recovery Failed" "Manual intervention required" "error"
            return 1
        fi
    fi
    
    # Check frontend responsiveness
    if curl -sf http://localhost:3000/ > /dev/null 2>&1; then
        log "Frontend responding OK"
        return 0
    else
        log_warning "Frontend not responding - Restarting..."
        docker-compose restart frontend >> "$LOG_FILE" 2>&1
        sleep 20
        log_success "Frontend restarted"
        return 0
    fi
}

#######################################################################
# 5. NGINX HEALTH CHECK
#######################################################################
check_nginx() {
    log "Checking Nginx health..."
    cd "$PROJECT_DIR"
    
    if ! docker-compose ps nginx | grep -q "Up"; then
        log_error "Nginx is not running - Attempting restart..."
        send_alert "Nginx Down" "Nginx container stopped - Auto-restarting" "error"
        
        docker-compose restart nginx >> "$LOG_FILE" 2>&1
        sleep 5
        
        if docker-compose ps nginx | grep -q "Up"; then
            log_success "Nginx restarted successfully"
            return 0
        else
            log_error "Nginx restart failed"
            return 1
        fi
    fi
    
    log "Nginx health OK"
    return 0
}

#######################################################################
# 6. DATABASE CONNECTION CHECK
#######################################################################
check_database() {
    log "Checking database connectivity..."
    cd "$PROJECT_DIR"
    
    # Test PostgreSQL connection from backend
    if docker-compose exec -T backend1 python -c "
import os
import psycopg2
try:
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.close()
    exit(0)
except:
    exit(1)
" 2>/dev/null; then
        log "Database connection OK"
        return 0
    else
        log_warning "Database connection issue detected"
        send_alert "Database Connection Warning" "Backend cannot connect to PostgreSQL" "warning"
        
        # Restart backend to reset connections
        docker-compose restart backend1 >> "$LOG_FILE" 2>&1
        sleep 30
        
        return 1
    fi
}

#######################################################################
# 7. WEBSOCKET HEALTH CHECK
#######################################################################
check_websocket() {
    log "Checking WebSocket connectivity..."
    
    # Check if data-worker is running
    cd "$PROJECT_DIR"
    if ! docker-compose ps data-worker | grep -q "Up"; then
        log_error "Data worker is not running - Attempting restart..."
        send_alert "Data Worker Down" "Data worker stopped - Auto-restarting" "error"
        
        docker-compose restart data-worker >> "$LOG_FILE" 2>&1
        sleep 15
        
        if docker-compose ps data-worker | grep -q "Up"; then
            log_success "Data worker restarted successfully"
            return 0
        else
            log_error "Data worker restart failed"
            return 1
        fi
    fi
    
    log "WebSocket services OK"
    return 0
}

#######################################################################
# 8. CELERY WORKERS CHECK
#######################################################################
check_celery() {
    log "Checking Celery workers..."
    cd "$PROJECT_DIR"
    
    # Check celery-worker
    if ! docker-compose ps celery-worker | grep -q "Up"; then
        log_warning "Celery worker not running - Restarting..."
        docker-compose restart celery-worker >> "$LOG_FILE" 2>&1
        sleep 10
    fi
    
    # Check celery-beat
    if ! docker-compose ps celery-beat | grep -q "Up"; then
        log_warning "Celery beat not running - Restarting..."
        docker-compose restart celery-beat >> "$LOG_FILE" 2>&1
        sleep 10
    fi
    
    log "Celery workers OK"
    return 0
}

#######################################################################
# 9. MEMORY CHECK
#######################################################################
check_memory() {
    log "Checking memory usage..."
    local mem_usage=$(free | awk '/Mem:/ {printf("%.0f", $3/$2 * 100)}')
    
    if [ "$mem_usage" -gt 90 ]; then
        log_warning "High memory usage: ${mem_usage}% - Restarting services..."
        send_alert "High Memory Usage" "Memory at ${mem_usage}% - Restarting containers" "warning"
        
        cd "$PROJECT_DIR"
        
        # Restart non-critical services first
        docker-compose restart celery-worker calc-worker >> "$LOG_FILE" 2>&1
        sleep 10
        
        # Clear system cache
        sync
        echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true
        
        local new_usage=$(free | awk '/Mem:/ {printf("%.0f", $3/$2 * 100)}')
        log_success "Memory cleared: ${mem_usage}% → ${new_usage}%"
        
        return 0
    else
        log "Memory usage OK: ${mem_usage}%"
        return 0
    fi
}

#######################################################################
# 10. SSL CERTIFICATE CHECK
#######################################################################
check_ssl() {
    log "Checking SSL certificate..."
    
    # Check if cert expires in less than 30 days
    local expiry_date=$(echo | openssl s_client -servername volusignal.com -connect volusignal.com:443 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
    
    if [ -n "$expiry_date" ]; then
        local expiry_epoch=$(date -d "$expiry_date" +%s 2>/dev/null || date -j -f "%b %d %H:%M:%S %Y %Z" "$expiry_date" +%s 2>/dev/null)
        local current_epoch=$(date +%s)
        local days_until_expiry=$(( ($expiry_epoch - $current_epoch) / 86400 ))
        
        if [ "$days_until_expiry" -lt 30 ]; then
            log_warning "SSL certificate expires in $days_until_expiry days"
            send_alert "SSL Certificate Expiring" "Certificate expires in $days_until_expiry days - Renewal needed" "warning"
        else
            log "SSL certificate valid for $days_until_expiry days"
        fi
    else
        log_warning "Could not check SSL certificate expiry"
    fi
    
    return 0
}

#######################################################################
# 11. WEBSITE AVAILABILITY CHECK
#######################################################################
check_website() {
    log "Checking website availability..."
    
    # Check if website is accessible
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" https://volusignal.com/ 2>/dev/null || echo "000")
    
    if [ "$http_code" = "200" ]; then
        log "Website responding OK (HTTP $http_code)"
        return 0
    else
        log_error "Website not responding correctly (HTTP $http_code)"
        send_alert "Website Down" "Website returned HTTP $http_code - Auto-repair initiated" "error"
        
        # Emergency restart sequence
        cd "$PROJECT_DIR"
        
        log "Restarting Nginx..."
        docker-compose restart nginx >> "$LOG_FILE" 2>&1
        sleep 5
        
        log "Restarting Frontend..."
        docker-compose restart frontend >> "$LOG_FILE" 2>&1
        sleep 20
        
        log "Restarting Backend..."
        docker-compose restart backend1 >> "$LOG_FILE" 2>&1
        sleep 30
        
        # Verify recovery
        local new_http_code=$(curl -s -o /dev/null -w "%{http_code}" https://volusignal.com/ 2>/dev/null || echo "000")
        
        if [ "$new_http_code" = "200" ]; then
            log_success "Website recovered (HTTP $new_http_code)"
            send_alert "Website Recovered" "Website back online after auto-repair" "info"
            return 0
        else
            log_error "Website still down (HTTP $new_http_code) - Manual intervention required"
            send_alert "Website Recovery Failed" "Manual intervention required" "error"
            return 1
        fi
    fi
}

#######################################################################
# MAIN EXECUTION
#######################################################################
main() {
    log "=========================================="
    log "Starting Automated Health Check & Repair"
    log "=========================================="
    
    local exit_code=0
    
    # Run all checks
    check_disk_space || exit_code=$?
    check_redis || exit_code=$?
    check_backend || exit_code=$?
    check_frontend || exit_code=$?
    check_nginx || exit_code=$?
    check_database || exit_code=$?
    check_websocket || exit_code=$?
    check_celery || exit_code=$?
    check_memory || exit_code=$?
    check_ssl || exit_code=$?
    check_website || exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        log_success "All health checks passed ✓"
    else
        log_warning "Some checks failed - Review log for details"
    fi
    
    log "=========================================="
    log "Health Check Complete"
    log "=========================================="
    
    return $exit_code
}

# Run main function
main
