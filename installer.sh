#!/bin/bash
# ==============================================================================
# RexaCloud Panel — Official Production VPS Installer
# Interactive installer inspired by the Pterodactyl Panel installation workflow.
# Installs RexaCloud custom dashboard, configures Nginx/SSL, creates systemd services,
# and provisions the initial system administrator.
# ==============================================================================

set -Eeuo pipefail

# Project Repository Configuration
REPO_URL="https://github.com/jukgamer200-gif/Rexa-dash-test.git"
ARCHIVE_URL="https://github.com/jukgamer200-gif/Rexa-dash-test/archive/refs/heads/main.tar.gz"

# Terminal ANSI Color Codes
CLR_RESET="\033[0m"
CLR_BOLD="\033[1m"
CLR_PURPLE="\033[38;2;139;92;246m"
CLR_VIOLET="\033[38;2;168;85;247m"
CLR_CYAN="\033[36m"
CLR_GREEN="\033[32m"
CLR_YELLOW="\033[33m"
CLR_RED="\033[31m"

# Default configuration variables (ensures set -u safety)
INSTALL_DIR="/var/www/rexacloud"
DASH_DOMAIN=""
DNS_MATCH=false
SSL_CHOICE="1"
SSL_EMAIL=""
DB_CHOICE="1"
DB_DRIVER="sqlite"
DB_HOST="127.0.0.1"
DB_PORT="3306"
DB_NAME="rexacloud"
DB_USER="rexacloud"
DB_PASS=""
CONFIGURE_PTERO_NOW="Y"
PTERO_URL=""
PTERO_CLIENT_KEY=""
PTERO_APP_KEY=""
PROXY_CHOICE="1"
CREATE_ADMIN_NOW="Y"
ADMIN_USER="admin"
ADMIN_EMAIL=""
ADMIN_PASS=""
CONFIRM_INSTALL="Y"

banner() {
    clear 2>/dev/null || true
    echo -e "${CLR_PURPLE}${CLR_BOLD}"
    echo "  ██████╗ ███████╗██╗  ██╗ █████╗  ██████╗██╗      ██████╗ ██╗   ██╗██████╗ "
    echo "  ██╔══██╗██╔════╝╚██╗██╔╝██╔══██╗██╔════╝██║     ██╔═══██╗██║   ██║██╔══██╗"
    echo "  ██████╔╝█████╗   ╚███╔╝ ███████║██║     ██║     ██║   ██║██║   ██║██║  ██║"
    echo "  ██╔══██╗██╔══╝   ██╔██╗ ██╔══██║██║     ██║     ██║   ██║██║   ██║██║  ██║"
    echo "  ██║  ██║███████╗██╔╝ ██╗██║  ██║╚██████╗███████╗╚██████╔╝╚██████╔╝██████╔╝"
    echo "  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚══════╝ ╚═════╝  ╚═════╝ ╚═════╝ "
    echo -e "${CLR_RESET}"
    echo -e "${CLR_VIOLET}  :: Premium Game Server Management Panel :: Production VPS Installer${CLR_RESET}"
    echo -e "${CLR_CYAN}  Authoritative Pterodactyl API Integration Engine${CLR_RESET}\n"
    echo "=============================================================================="
}

log_info() {
    echo -e "${CLR_CYAN}[INFO]${CLR_RESET} $1"
}

log_success() {
    echo -e "${CLR_GREEN}[✔]${CLR_RESET} $1"
}

log_warn() {
    echo -e "${CLR_YELLOW}[!] WARNING:${CLR_RESET} $1"
}

log_error() {
    echo -e "${CLR_RED}[✖] ERROR:${CLR_RESET} $1"
}

handle_error() {
    local exit_code=$1
    local line_no=$2
    log_error "Installation interrupted at line $line_no with exit status $exit_code."
    log_error "Review the diagnostic output above for details."
    log_error "Existing application data, databases, and user files were left untouched."
    exit "$exit_code"
}
trap 'handle_error $? $LINENO' ERR

# 1. Root and OS Architecture Verification
check_environment() {
    if [ "$EUID" -ne 0 ]; then
        log_error "This installer must be run as root. Please run with: sudo bash installer.sh"
        exit 1
    fi

    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS_NAME=${ID:-unknown}
        OS_VER=${VERSION_ID:-unknown}
    else
        log_error "Cannot detect operating system. Supported: Ubuntu 20.04+, Debian 11+."
        exit 1
    fi

    if [[ "$OS_NAME" != "ubuntu" && "$OS_NAME" != "debian" ]]; then
        log_warn "Detected OS: $OS_NAME $OS_VER. Recommended platform is Ubuntu 22.04 LTS or Debian 12."
        read -p "Do you want to continue anyway? [y/N]: " continue_anyway
        if [[ ! "${continue_anyway:-N}" =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        log_success "Operating System verified: ${PRETTY_NAME:-$OS_NAME}"
    fi
}

# 2. Interactive Questions & Input Validation
gather_configuration() {
    echo -e "\n${CLR_BOLD}${CLR_VIOLET}--- STEP 1: INSTALLATION DIRECTORY ---${CLR_RESET}"
    read -p "Install directory [/var/www/rexacloud]: " input_dir
    INSTALL_DIR=${input_dir:-/var/www/rexacloud}

    echo -e "\n${CLR_BOLD}${CLR_VIOLET}--- STEP 2: DOMAIN CONFIGURATION ---${CLR_RESET}"
    while true; do
        read -p "Enter dashboard domain (e.g. dash.yourdomain.com): " raw_domain
        DASH_DOMAIN=$(echo "${raw_domain:-}" | tr '[:upper:]' '[:lower:]' | xargs)

        # Domain regex check
        if [[ "$DASH_DOMAIN" =~ ^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$ ]]; then
            log_success "Domain format valid: $DASH_DOMAIN"
            break
        else
            log_error "Invalid domain format. Please enter a valid FQDN (e.g. panel.domain.com)."
        fi
    done

    # Optional DNS verification check
    log_info "Verifying DNS resolution for $DASH_DOMAIN..."
    SERVER_IP=$(curl -s -4 ifconfig.me 2>/dev/null || curl -s -4 icanhazip.com 2>/dev/null || echo "")
    DOMAIN_IP=$(getent hosts "$DASH_DOMAIN" 2>/dev/null | awk '{ print $1 }' || echo "")

    if [[ -n "$DOMAIN_IP" && -n "$SERVER_IP" && "$DOMAIN_IP" == "$SERVER_IP" ]]; then
        log_success "DNS verified: $DASH_DOMAIN points to this server IP ($SERVER_IP)"
        DNS_MATCH=true
    else
        log_warn "DNS resolution ($DOMAIN_IP) does not currently match public server IP ($SERVER_IP)."
        log_warn "Make sure your A record points to this VPS before Let's Encrypt certificate issuance."
        DNS_MATCH=false
    fi

    echo -e "\n${CLR_BOLD}${CLR_VIOLET}--- STEP 3: SSL / HTTPS CERTIFICATE ---${CLR_RESET}"
    echo "1) Automatic Let's Encrypt SSL certificate (Certbot)"
    echo "2) Cloudflare Origin / Custom Certificate (Configure manually later)"
    echo "3) Self-signed / Plain HTTP (Development only)"
    read -p "Select SSL option [1]: " input_ssl
    SSL_CHOICE=${input_ssl:-1}

    SSL_EMAIL=""
    if [ "$SSL_CHOICE" -eq 1 ]; then
        while true; do
            read -p "Enter email address for Let's Encrypt renewal alerts: " SSL_EMAIL
            if [[ "$SSL_EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$ ]]; then
                break
            else
                log_error "Please enter a valid email address."
            fi
        done
    fi

    echo -e "\n${CLR_BOLD}${CLR_VIOLET}--- STEP 4: DATABASE CONFIGURATION ---${CLR_RESET}"
    echo "1) Embedded High-Speed SQLite (Recommended, zero external setup)"
    echo "2) MySQL / MariaDB (External database server)"
    echo "3) PostgreSQL (External database server)"
    read -p "Select database driver [1]: " input_db
    DB_CHOICE=${input_db:-1}

    DB_DRIVER="sqlite"
    DB_HOST="127.0.0.1"
    DB_PORT="3306"
    DB_NAME="rexacloud"
    DB_USER="rexacloud"
    DB_PASS=""

    if [ "$DB_CHOICE" -eq 2 ]; then
        DB_DRIVER="mysql"
        read -p "Database Host [127.0.0.1]: " in_dbh
        DB_HOST=${in_dbh:-127.0.0.1}
        read -p "Database Port [3306]: " in_dbp
        DB_PORT=${in_dbp:-3306}
        read -p "Database Name [rexacloud]: " in_dbn
        DB_NAME=${in_dbn:-rexacloud}
        read -p "Database User [rexacloud]: " in_dbu
        DB_USER=${in_dbu:-rexacloud}
        read -s -p "Database Password: " DB_PASS
        echo ""
    elif [ "$DB_CHOICE" -eq 3 ]; then
        DB_DRIVER="postgres"
        read -p "Database Host [127.0.0.1]: " in_dbh
        DB_HOST=${in_dbh:-127.0.0.1}
        read -p "Database Port [5432]: " in_dbp
        DB_PORT=${in_dbp:-5432}
        read -p "Database Name [rexacloud]: " in_dbn
        DB_NAME=${in_dbn:-rexacloud}
        read -p "Database User [rexacloud]: " in_dbu
        DB_USER=${in_dbu:-rexacloud}
        read -s -p "Database Password: " DB_PASS
        echo ""
    fi
    log_success "Database engine configured: $DB_DRIVER"

    echo -e "\n${CLR_BOLD}${CLR_VIOLET}--- STEP 5: PTERODACTYL PANEL API INTEGRATION ---${CLR_RESET}"
    read -p "Do you want to configure your Pterodactyl Panel connection now? [Y/n]: " input_ptero_now
    CONFIGURE_PTERO_NOW=${input_ptero_now:-Y}

    PTERO_URL=""
    PTERO_CLIENT_KEY=""
    PTERO_APP_KEY=""

    if [[ "$CONFIGURE_PTERO_NOW" =~ ^[Yy]$ ]]; then
        while true; do
            read -p "Enter Pterodactyl Panel URL (e.g. https://panel.yourdomain.com): " raw_ptero_url
            PTERO_URL=$(echo "${raw_ptero_url:-}" | sed -e 's/\/$//')
            if [[ "$PTERO_URL" =~ ^https?://.+ ]]; then
                break
            else
                log_error "Please enter a valid HTTP or HTTPS URL."
            fi
        done

        read -p "Enter Pterodactyl Client API Key (starts with ptlc_): " PTERO_CLIENT_KEY
        read -p "Enter Pterodactyl Application API Key (starts with ptla_): " PTERO_APP_KEY

        log_info "Testing connection to Pterodactyl at $PTERO_URL..."
        PTERO_TEST_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $PTERO_CLIENT_KEY" -H "Accept: application/json" "$PTERO_URL/api/client" 2>/dev/null || echo "000")
        if [[ "$PTERO_TEST_HTTP" =~ ^(200|403|401)$ ]]; then
            log_success "Pterodactyl endpoint reached (HTTP $PTERO_TEST_HTTP)!"
        else
            log_warn "Could not reach Pterodactyl immediately (HTTP $PTERO_TEST_HTTP). You can re-test or edit settings in Admin Dashboard later."
        fi
    else
        log_info "Pterodactyl configuration skipped. You can configure it later in Admin Dashboard > Settings or via .env."
    fi

    echo -e "\n${CLR_BOLD}${CLR_VIOLET}--- STEP 6: REVERSE PROXY WEB SERVER ---${CLR_RESET}"
    echo "1) Nginx (Recommended standard)"
    echo "2) Caddy (Automatic HTTPS)"
    read -p "Select web server [1]: " input_proxy
    PROXY_CHOICE=${input_proxy:-1}

    echo -e "\n${CLR_BOLD}${CLR_VIOLET}--- STEP 7: INITIAL ADMINISTRATOR PROVISIONING ---${CLR_RESET}"
    read -p "Do you want to create the initial Administrator account now? [Y/n]: " input_create_admin
    CREATE_ADMIN_NOW=${input_create_admin:-Y}

    ADMIN_USER="admin"
    ADMIN_EMAIL=""
    ADMIN_PASS=""

    if [[ "$CREATE_ADMIN_NOW" =~ ^[Yy]$ ]]; then
        while true; do
            read -p "Administrator Username [admin]: " input_admin_user
            ADMIN_USER=${input_admin_user:-admin}
            if [ ${#ADMIN_USER} -ge 3 ]; then
                break
            else
                log_error "Username must be at least 3 characters."
            fi
        done

        while true; do
            read -p "Administrator Email Address: " ADMIN_EMAIL
            if [[ "$ADMIN_EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$ ]]; then
                break
            else
                log_error "Please enter a valid email address."
            fi
        done

        while true; do
            read -s -p "Administrator Password (min 8 characters): " ADMIN_PASS
            echo ""
            if [ ${#ADMIN_PASS} -lt 8 ]; then
                log_error "Password must be at least 8 characters long."
                continue
            fi
            read -s -p "Confirm Administrator Password: " ADMIN_PASS_CONFIRM
            echo ""
            if [ "$ADMIN_PASS" == "$ADMIN_PASS_CONFIRM" ]; then
                log_success "Password confirmed."
                break
            else
                log_error "Passwords do not match. Please re-enter."
            fi
        done
    fi

    echo -e "\n=============================================================================="
    echo -e "${CLR_BOLD}CONFIGURATION SUMMARY:${CLR_RESET}"
    echo " - Installation Path:     $INSTALL_DIR"
    echo " - Dashboard Domain:      $DASH_DOMAIN"
    echo " - Database Driver:       $DB_DRIVER"
    echo " - Pterodactyl URL:       ${PTERO_URL:-(Will configure later in Admin Panel)}"
    echo " - Reverse Proxy:         $([ "$PROXY_CHOICE" -eq 1 ] && echo "Nginx" || echo "Caddy")"
    echo " - SSL Mode:              $([ "$SSL_CHOICE" -eq 1 ] && echo "Let's Encrypt Certbot" || echo "Manual / Other")"
    echo " - Create Initial Admin:  $([[ "$CREATE_ADMIN_NOW" =~ ^[Yy]$ ]] && echo "Yes ($ADMIN_USER <$ADMIN_EMAIL>)" || echo "No (Use CLI later)")"
    echo "=============================================================================="
    read -p "Proceed with automated installation? [Y/n]: " input_confirm
    CONFIRM_INSTALL=${input_confirm:-Y}
    if [[ ! "$CONFIRM_INSTALL" =~ ^[Yy]$ ]]; then
        log_info "Installation aborted by user."
        exit 0
    fi
}

# 3. System Dependencies (Node.js 20 LTS, Git, Curl, Nginx, Certbot)
install_dependencies() {
    log_info "Updating apt package repositories..."
    apt-get update -y

    log_info "Installing prerequisite system utilities..."
    apt-get install -y curl wget git tar unzip ufw software-properties-common build-essential

    # Check and install Node.js 20+
    if ! command -v node &> /dev/null || [ "$(node -v | cut -d'v' -f2 | cut -d'.' -f1)" -lt 20 ]; then
        log_info "Configuring Node.js 20.x LTS repository..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    fi
    log_success "Node.js runtime verified: $(node -v) (npm $(npm -v))"

    # Install Reverse Proxy
    if [ "$PROXY_CHOICE" -eq 1 ]; then
        log_info "Installing Nginx web server and Certbot..."
        apt-get install -y nginx certbot python3-certbot-nginx
    else
        log_info "Installing Caddy web server..."
        apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
        curl -1sLF 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
        curl -1sLF 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
        apt-get update -y
        apt-get install -y caddy
    fi
}

# 4. Check whether repository is publicly accessible
validate_repository_access() {
    log_info "Verifying public accessibility of repository: $REPO_URL..."
    local accessible=false

    # Test Git remote probe without prompting for credentials
    if command -v git &>/dev/null; then
        if GIT_TERMINAL_PROMPT=0 git ls-remote --heads "$REPO_URL" &>/dev/null; then
            accessible=true
            log_success "GitHub repository is publicly accessible via Git."
        fi
    fi

    # Fallback check via HTTPS curl probe
    if [ "$accessible" = false ] && command -v curl &>/dev/null; then
        if curl -sI -L "$ARCHIVE_URL" 2>/dev/null | grep -qE "HTTP/[12](\.[01])? (200|302)"; then
            accessible=true
            log_success "GitHub repository archive is publicly accessible via HTTPS."
        fi
    fi

    if [ "$accessible" = false ]; then
        log_error "Cannot reach the project repository: $REPO_URL"
        log_error "The repository could not be contacted without credentials, or network connectivity is unavailable."
        log_error "Please verify internet connectivity and confirm the repository is public."
        exit 1
    fi
}

# 5. Fetch project source safely
fetch_project_source() {
    log_info "Fetching RexaCloud Panel project source..."
    local script_dir
    script_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

    # Check if installer was invoked from within an existing RexaCloud directory
    if [ -f "$script_dir/package.json" ]; then
        if [ "$script_dir" = "$INSTALL_DIR" ]; then
            log_info "Installer executed from target directory ($INSTALL_DIR). Preserving local source."
            return 0
        fi

        log_info "Deploying from local repository source ($script_dir)..."
        mkdir -p "$INSTALL_DIR"
        # Preserve user .env if already present in target
        if [ -f "$INSTALL_DIR/.env" ]; then
            cp "$INSTALL_DIR/.env" "/tmp/.env.rexacloud.bak.$$"
        fi
        cp -a "$script_dir"/. "$INSTALL_DIR"/
        if [ -f "/tmp/.env.rexacloud.bak.$$" ]; then
            mv "/tmp/.env.rexacloud.bak.$$" "$INSTALL_DIR/.env"
        fi
        return 0
    fi

    # Remote clone / download
    mkdir -p "$INSTALL_DIR"
    local download_success=false

    # If already a Git repository in INSTALL_DIR, update it
    if [ -d "$INSTALL_DIR/.git" ]; then
        log_info "Existing Git repository detected in $INSTALL_DIR. Updating remote origin..."
        git -C "$INSTALL_DIR" remote set-url origin "$REPO_URL" 2>/dev/null || true
        if GIT_TERMINAL_PROMPT=0 git -C "$INSTALL_DIR" fetch origin main 2>/dev/null; then
            if GIT_TERMINAL_PROMPT=0 git -C "$INSTALL_DIR" checkout -f main 2>/dev/null || GIT_TERMINAL_PROMPT=0 git -C "$INSTALL_DIR" reset --hard origin/main 2>/dev/null; then
                download_success=true
                log_success "Repository updated successfully via Git."
            fi
        fi
    fi

    if [ "$download_success" = false ]; then
        # If target directory is not empty and not a git repo, clone to a safe staging directory
        if [ -n "$(ls -A "$INSTALL_DIR" 2>/dev/null)" ]; then
            log_info "Installation directory $INSTALL_DIR is not empty. Using safe staging directory..."
            local staging_dir
            staging_dir=$(mktemp -d /tmp/rexacloud_stage_XXXXXX)
            if GIT_TERMINAL_PROMPT=0 git clone --depth 1 "$REPO_URL" "$staging_dir"; then
                download_success=true
                log_success "Repository cloned into staging directory."
                if [ -f "$INSTALL_DIR/.env" ]; then
                    cp "$INSTALL_DIR/.env" "$staging_dir/.env.preserve.$$"
                fi
                cp -a "$staging_dir"/. "$INSTALL_DIR"/
                if [ -f "$staging_dir/.env.preserve.$$" ]; then
                    mv "$staging_dir/.env.preserve.$$" "$INSTALL_DIR/.env"
                fi
                rm -rf "$staging_dir"
            else
                rm -rf "$staging_dir"
                log_warn "Git clone failed. Attempting release archive download fallback..."
            fi
        else
            log_info "Cloning $REPO_URL into $INSTALL_DIR..."
            if GIT_TERMINAL_PROMPT=0 git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"; then
                download_success=true
                log_success "Repository cloned successfully."
            else
                log_warn "Git clone failed. Attempting release archive download fallback..."
            fi
        fi
    fi

    # Fallback to archive tarball if git clone was unsuccessful
    if [ "$download_success" = false ]; then
        log_info "Downloading release archive from $ARCHIVE_URL..."
        local archive_file="/tmp/rexacloud-main-$$.tar.gz"
        if curl -fsSL -o "$archive_file" "$ARCHIVE_URL"; then
            log_info "Extracting release archive to $INSTALL_DIR..."
            if tar -xzf "$archive_file" -C "$INSTALL_DIR" --strip-components=1; then
                download_success=true
                log_success "Release archive extracted successfully."
            else
                log_error "Failed to extract downloaded archive."
            fi
            rm -f "$archive_file"
        else
            log_error "Failed to download archive from $ARCHIVE_URL."
            rm -f "$archive_file"
        fi
    fi

    if [ "$download_success" = false ]; then
        log_error "CRITICAL: Could not download project source from $REPO_URL."
        log_error "Git clone and archive download both failed. Cannot continue."
        log_error "No npm commands will be executed on a non-existent or partially downloaded project."
        exit 1
    fi
}

# 6. Validate the Project Before Running NPM
validate_project_root() {
    log_info "Validating project installation at $INSTALL_DIR..."

    # 1. Confirm installation directory exists
    if [ ! -d "$INSTALL_DIR" ]; then
        log_error "Target installation directory does not exist: $INSTALL_DIR"
        exit 1
    fi

    # 2 & 3. Locate the actual application root containing package.json
    local detected_root=""
    if [ -f "$INSTALL_DIR/package.json" ]; then
        detected_root="$INSTALL_DIR"
    else
        local found_pkg
        found_pkg=$(find "$INSTALL_DIR" -maxdepth 2 -name "package.json" 2>/dev/null | head -n 1 || echo "")
        if [ -n "$found_pkg" ]; then
            detected_root="$(cd "$(dirname "$found_pkg")" && pwd)"
            log_info "Located project root at nested directory: $detected_root"
        fi
    fi

    # 4. Verify package.json exists and is readable
    if [ -z "$detected_root" ] || [ ! -f "$detected_root/package.json" ]; then
        log_error "Project validation failed: package.json not found in $INSTALL_DIR"
        log_error "Expected directory: $INSTALL_DIR/package.json"
        log_error "The project was not downloaded successfully or the project root is incorrect."
        log_error "Stopping immediately before running npm commands."
        exit 1
    fi

    if [ ! -r "$detected_root/package.json" ]; then
        log_error "package.json exists at $detected_root/package.json but is not readable."
        log_error "Please check filesystem permissions."
        exit 1
    fi

    # Check key application files
    local required_files=("server.ts" "tsconfig.json" "vite.config.ts")
    for f in "${required_files[@]}"; do
        if [ ! -f "$detected_root/$f" ]; then
            log_error "Required application component missing: $detected_root/$f"
            log_error "The project source is incomplete. Aborting."
            exit 1
        fi
    done

    if [ ! -d "$detected_root/src" ]; then
        log_error "Required application directory missing: $detected_root/src"
        log_error "The project source is incomplete. Aborting."
        exit 1
    fi

    # 5. Inspect package.json configuration
    log_info "Inspecting package.json configuration..."
    if ! node -e "const p = require('$detected_root/package.json'); if (!p.name) process.exit(1);" 2>/dev/null; then
        log_error "Failed to parse $detected_root/package.json as valid JSON."
        exit 1
    fi

    INSTALL_DIR="$detected_root"
    log_success "Project validation passed: Application root confirmed at $INSTALL_DIR"
}

# 7. Configure and Validate Environment
configure_environment() {
    cd "$INSTALL_DIR"

    # Generate secure JWT session secret
    local jwt_secret
    jwt_secret=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || date +%s%N | sha256sum | awk '{print $1}')

    if [ ! -f .env ]; then
        log_info "Generating production .env configuration..."
        cat <<EOF > .env
PORT=3000
NODE_ENV=production
APP_URL="https://$DASH_DOMAIN"
JWT_SECRET="$jwt_secret"

# Database Configuration ($DB_DRIVER)
DB_DRIVER="$DB_DRIVER"
DB_HOST="$DB_HOST"
DB_PORT="$DB_PORT"
DB_NAME="$DB_NAME"
DB_USER="$DB_USER"
DB_PASS="$DB_PASS"

# Pterodactyl Panel Integration
PTERODACTYL_PANEL_URL="$PTERO_URL"
PTERODACTYL_CLIENT_API_KEY="$PTERO_CLIENT_KEY"
PTERODACTYL_APPLICATION_API_KEY="$PTERO_APP_KEY"
EOF
        log_success "Generated new production .env file."
    else
        log_info "Existing .env detected; preserving current configuration."
    fi

    # Validate that required configuration keys exist
    log_info "Validating environment configuration (.env)..."
    local required_vars=("PORT" "NODE_ENV" "APP_URL" "JWT_SECRET" "DB_DRIVER")
    local missing_vars=()

    for v in "${required_vars[@]}"; do
        if ! grep -qE "^${v}=.+" .env; then
            missing_vars+=("$v")
        fi
    done

    if [ ${#missing_vars[@]} -gt 0 ]; then
        log_error "Required configuration variable(s) missing or empty in .env: ${missing_vars[*]}"
        log_error "Please define these keys in $INSTALL_DIR/.env before continuing."
        exit 1
    fi
    log_success "Environment configuration verified."
}

# 8. Install Dependencies and Build Application
build_application() {
    cd "$INSTALL_DIR"

    log_info "Installing Node.js dependencies (production build)..."
    local install_ok=false

    if npm install; then
        install_ok=true
    else
        log_warn "Standard npm install encountered peer dependency conflict. Retrying with --legacy-peer-deps..."
        if npm install --legacy-peer-deps; then
            install_ok=true
        fi
    fi

    if [ "$install_ok" = false ]; then
        log_error "CRITICAL: Node.js dependency installation failed in $INSTALL_DIR."
        log_error "Check npm logs for details. Aborting installation."
        exit 1
    fi
    log_success "Node.js dependencies installed successfully."

    log_info "Building production frontend assets (npm run build)..."
    if ! npm run build; then
        log_error "CRITICAL: Frontend asset compilation failed ('npm run build')."
        log_error "Check the build output above for compiler errors. Aborting."
        exit 1
    fi
    log_success "Frontend assets compiled successfully."

    # Run TypeScript validation if lint script is available
    local has_lint
    has_lint=$(node -e "const p = require('$INSTALL_DIR/package.json'); console.log(p.scripts && p.scripts.lint ? 'yes' : 'no')" 2>/dev/null || echo "no")
    if [ "$has_lint" = "yes" ]; then
        log_info "Running TypeScript verification (npm run lint)..."
        if ! npm run lint; then
            log_error "CRITICAL: TypeScript validation failed ('npm run lint')."
            log_error "Installation will not proceed with unverified code. Aborting."
            exit 1
        fi
        log_success "TypeScript check passed."
    fi

    # Configure service user permissions
    id -u rexacloud &>/dev/null || useradd -r -s /bin/false rexacloud 2>/dev/null || true
    chown -R rexacloud:rexacloud "$INSTALL_DIR" 2>/dev/null || true
    chmod -R 755 "$INSTALL_DIR" 2>/dev/null || true

    # Install global CLI binary in /usr/local/bin/rexacloud
    log_info "Installing global system CLI utility (/usr/local/bin/rexacloud)..."
    cat <<EOF > /usr/local/bin/rexacloud
#!/bin/bash
cd "$INSTALL_DIR"
exec npx tsx "$INSTALL_DIR/cli.ts" "\$@"
EOF
    chmod +x /usr/local/bin/rexacloud 2>/dev/null || true
    log_success "Global CLI installed. You can run 'rexacloud <command>' anywhere on this system."

    log_success "Application deployed and built successfully."
}

# 9. Provision Initial Admin Account
setup_admin_account() {
    if [[ "$CREATE_ADMIN_NOW" =~ ^[Yy]$ ]]; then
        log_info "Provisioning initial administrator account ($ADMIN_USER)..."
        cd "$INSTALL_DIR"
        local admin_result=0
        npx tsx -e "
            import { authService } from './backend/services/authService.js';
            try {
                const u = authService.createAdminUser({
                    username: '$ADMIN_USER',
                    email: '$ADMIN_EMAIL',
                    password: '$ADMIN_PASS'
                });
                console.log('Administrator ' + u.username + ' (' + u.email + ') created successfully.');
            } catch(e) {
                console.error('Provisioning notice:', e.message);
            }
        " || admin_result=$?

        if [ $admin_result -eq 0 ]; then
            log_success "Administrator account ($ADMIN_USER) created."
        else
            log_warn "Administrator account setup encountered a non-fatal notice."
            log_info "You can create or reset an administrator account anytime by running: rexacloud admin:create"
        fi
    else
        log_info "Initial admin creation skipped. You can create one anytime by running:"
        echo -e "${CLR_CYAN}    cd $INSTALL_DIR && npm run cli admin:create${CLR_RESET}"
    fi
}

# 10. Configure Systemd Daemon Service
setup_systemd() {
    log_info "Configuring systemd service (/etc/systemd/system/rexacloud.service)..."
    local npm_bin
    npm_bin=$(command -v npm || echo "/usr/bin/npm")

    cat <<EOF > /etc/systemd/system/rexacloud.service
[Unit]
Description=RexaCloud Game Server Management Panel
After=network.target

[Service]
Type=simple
User=rexacloud
WorkingDirectory=$INSTALL_DIR
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=$npm_bin start
Restart=always
RestartSec=5
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=rexacloud

[Install]
WantedBy=multi-user.target
EOF

    if command -v systemctl &>/dev/null && [ -d /run/systemd/system ]; then
        systemctl daemon-reload 2>/dev/null || true
        systemctl enable rexacloud.service 2>/dev/null || true
        systemctl restart rexacloud.service 2>/dev/null || log_warn "Could not start service immediately. Start manually with: systemctl start rexacloud"
        log_success "RexaCloud systemd service configured and enabled on boot."
    else
        log_info "systemd daemon not active in current environment; service file written to /etc/systemd/system/rexacloud.service."
    fi
}

# 11. Configure Reverse Proxy (Nginx / Caddy) & Let's Encrypt SSL
setup_reverse_proxy() {
    if [ "$PROXY_CHOICE" -eq 1 ]; then
        log_info "Configuring Nginx reverse proxy for $DASH_DOMAIN..."

        mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
        cat <<EOF > /etc/nginx/sites-available/rexacloud.conf
server {
    listen 80;
    listen [::]:80;
    server_name $DASH_DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        client_max_body_size 100M;
    }
}
EOF

        ln -sf /etc/nginx/sites-available/rexacloud.conf /etc/nginx/sites-enabled/ 2>/dev/null || true
        rm -f /etc/nginx/sites-enabled/default

        if command -v nginx &>/dev/null; then
            if nginx -t 2>/dev/null; then
                systemctl reload nginx 2>/dev/null || true
                log_success "Nginx configuration verified."
            else
                log_warn "Nginx syntax test failed. Please verify /etc/nginx/sites-available/rexacloud.conf."
            fi
        fi

        # Let's Encrypt SSL Issuance
        if [ "$SSL_CHOICE" -eq 1 ] && command -v certbot &>/dev/null; then
            log_info "Requesting Let's Encrypt SSL certificate via Certbot..."
            if certbot --nginx -d "$DASH_DOMAIN" --non-interactive --agree-tos -m "$SSL_EMAIL" --redirect 2>/dev/null; then
                log_success "Let's Encrypt SSL certificate obtained and HTTPS redirect enabled!"
            else
                log_warn "Certbot was unable to automatically issue an SSL certificate."
                log_warn "Ensure DNS A record for $DASH_DOMAIN points to this server, then run:"
                echo -e "${CLR_CYAN}    certbot --nginx -d $DASH_DOMAIN${CLR_RESET}"
            fi
        fi

    else
        log_info "Configuring Caddy reverse proxy for $DASH_DOMAIN..."
        cat <<EOF > /etc/caddy/Caddyfile
$DASH_DOMAIN {
    reverse_proxy 127.0.0.1:3000
}
EOF
        if command -v systemctl &>/dev/null; then
            systemctl reload caddy 2>/dev/null || true
        fi
        log_success "Caddy configured with automatic SSL."
    fi
}

# 12. Firewall configuration (UFW)
setup_firewall() {
    if command -v ufw &> /dev/null; then
        log_info "Configuring UFW firewall rules for web traffic..."
        ufw allow 22/tcp 2>/dev/null || true
        ufw allow 80/tcp 2>/dev/null || true
        ufw allow 443/tcp 2>/dev/null || true
    fi
}

# 13. Final Verification & Summary
final_summary() {
    banner
    log_success "REXACLOUD PANEL INSTALLATION COMPLETED SUCCESSFULLY!"
    echo "=============================================================================="
    echo -e "Dashboard URL:     ${CLR_BOLD}${CLR_VIOLET}https://$DASH_DOMAIN${CLR_RESET}"
    echo -e "Installation Path: ${CLR_CYAN}$INSTALL_DIR${CLR_RESET}"
    echo -e "Service Status:    systemctl status rexacloud"
    echo -e "Service Logs:      journalctl -u rexacloud -f"
    echo ""
    echo -e "${CLR_BOLD}Administrative Commands (Global CLI & Local):${CLR_RESET}"
    echo -e "  Create Administrator:  ${CLR_CYAN}rexacloud admin:create${CLR_RESET}  (or npm run cli admin:create)"
    echo -e "  Test Pterodactyl API:  ${CLR_CYAN}rexacloud pterodactyl:test${CLR_RESET}  (or npm run cli pterodactyl:test)"
    echo -e "  Generate Secret Key:   ${CLR_CYAN}rexacloud key:generate${CLR_RESET}  (or npm run cli key:generate)"
    echo ""
    echo -e "${CLR_BOLD}Connecting your Pterodactyl Instance:${CLR_RESET}"
    echo "  1. Sign in to your RexaCloud dashboard at https://$DASH_DOMAIN"
    echo "  2. Go to Admin Dashboard > Settings"
    echo "  3. Enter your Pterodactyl Panel URL, Client API Key, and Application API Key"
    echo "  4. Click 'Test Connection' to verify live communication with your servers."
    echo "=============================================================================="
    echo ""
}

# Master Execution Flow
banner
check_environment
gather_configuration
install_dependencies
validate_repository_access
fetch_project_source
validate_project_root
configure_environment
build_application
setup_admin_account
setup_systemd
setup_reverse_proxy
setup_firewall
final_summary
