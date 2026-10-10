# RexaCloud — Game Server Management Panel

A custom, full-stack game server management platform with a dark-purple aesthetic. RexaCloud communicates directly with your existing **Pterodactyl Panel** installation through its official Client and Application APIs without replacing or rebuilding Pterodactyl or Wings.

---

## Architecture Overview

```text
               ┌────────────────────────────────────────────────────────┐
               │              RexaCloud Customer & Admin UI             │
               │        (React 19, TypeScript, Tailwind CSS, Lucide)    │
               └───────────────────────────┬────────────────────────────┘
                                           │
                             (Authenticated JSON / Bearer)
                                           │
               ┌───────────────────────────▼────────────────────────────┐
               │                 RexaCloud Backend Engine               │
               │                  (Express on Node.js 20)               │
               │   • RBAC & Session Manager   • Audit Log Engine        │
               │   • Server Ownership Guards  • Pterodactyl Client SVC │
               │   • Credential Vault         • Pterodactyl Admin SVC  │
               └───────────────────────────┬────────────────────────────┘
                                           │
                        (Server-to-Server Pterodactyl APIs)
                                           │
               ┌───────────────────────────▼────────────────────────────┐
               │           Authoritative Pterodactyl Installation       │
               │   • Pterodactyl Panel API (/api/client, /api/app)      │
               │   • Wings Daemon Running On Game Server Nodes          │
               │   • Docker Game Containers (Minecraft, Rust, etc.)     │
               └────────────────────────────────────────────────────────┘
```

---

## Features

- **Dashboard**: Personalized welcome banner, 5 metric counter cards, server cards with RAM/CPU progress, and resource overview.
- **Live Terminal Console**: Color-coded log levels, autoscroll controls, pause/resume, and real-time command input with command execution.
- **File Manager**: Directory navigation, file inspector, upload and creation modals, and in-browser code editor with line numbers and save actions.
- **Server Creation Wizard**: Multi-step provisioning flow for server details, startup egg selection, node allocation, RAM/CPU limits, and API dispatch.
- **Administrator Dashboard**: Fleet-wide statistics, active Wings compute nodes, datacenter locations, Egg catalog, user management, and audit logs.
- **Authentication & Security**: Scrypt cryptographic password hashing, role-based access control, session expiration, and zero client credential leakage.
- **Public Signup & Admin Guarding**: Public web signup is strictly restricted to customer accounts. The initial administrator is provisioned via the VPS installer or terminal CLI.

---

## System Requirements

- **Operating System**: Ubuntu 20.04 LTS, Ubuntu 22.04 LTS, Ubuntu 24.04 LTS, or Debian 11/12
- **Node.js**: Node.js 20.x LTS or higher
- **Hardware**: Minimum 1 vCPU, 1 GB RAM, 10 GB Disk
- **Network**: Inbound ports `80` (HTTP) and `443` (HTTPS) open for web traffic

---

## 1-Command Automated Installation

Run the interactive installer directly on your fresh Ubuntu VPS:

```bash
# One-line remote installer:
bash <(curl -fsSL https://raw.githubusercontent.com/jukgamer200-gif/Rexa-dash-test/main/installer.sh)

# Or from cloned repository:
sudo bash installer.sh
```

### What the installer handles:
1. Detects and validates your Ubuntu/Debian operating system.
2. Installs system packages: Node.js 20 LTS, Git, Curl, Nginx / Caddy, and Certbot.
3. Prompts for:
   - Installation directory (`/var/www/rexacloud`)
   - Dashboard domain with DNS verification check (e.g., `dash.yourdomain.com`)
   - Database configuration (Embedded SQLite, MySQL, or PostgreSQL)
   - Pterodactyl Panel API Connection Wizard (URL, Client Key, Application Key)
   - Reverse proxy preference (Nginx or Caddy)
   - Let's Encrypt SSL certificate email
   - Creation of initial dashboard Administrator account (username, email, password)
4. Configures systemd service `/etc/systemd/system/rexacloud.service` for automatic boot startup.
5. Configures Nginx reverse proxy with HTTP to HTTPS redirection and automated SSL renewal.
6. Installs the global `/usr/local/bin/rexacloud` CLI utility.
7. Verifies service health and prints final access credentials.

---

## Upgrades

To update an existing installation while preserving configuration and database data:

```bash
cd /var/www/rexacloud
sudo bash upgrade.sh
```

---

## Administrative CLI Commands

RexaCloud installs a global command `rexacloud` (also callable via `npm run cli <command>` in the installation directory):

### 1. Create an Administrator
```bash
rexacloud admin:create
# or
npm run cli admin:create
```

### 2. Test Pterodactyl Connection
```bash
rexacloud pterodactyl:test
# or
npm run cli pterodactyl:test
```

### 3. Generate a New Session Secret
```bash
rexacloud key:generate
# or
npm run cli key:generate
```

---

## Connecting Your Existing Pterodactyl Installation

RexaCloud communicates with your Pterodactyl Panel over its official API endpoints. You can configure this via **Admin Dashboard > Settings** or in `.env`:

```env
# URL where your Pterodactyl Panel is reachable
PTERODACTYL_PANEL_URL="https://panel.yourdomain.com"

# Client API key generated in Pterodactyl: Account Settings > API Credentials
PTERODACTYL_CLIENT_API_KEY="ptlc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Application API key generated in Pterodactyl: Admin > Application API
PTERODACTYL_APPLICATION_API_KEY="ptla_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### How to Generate Pterodactyl API Keys:

1. **Client API Key (Server Controls, Console & File Operations):**
   - In your Pterodactyl Panel, click your user avatar in the top-right and select **Account Settings**.
   - Navigate to the **API Credentials** tab.
   - Enter a description (e.g. `RexaCloud Client Key`) and click **Create**.
   - Copy the generated token starting with `ptlc_` (it is only shown once).

2. **Application API Key (Infrastructure, Users, Nests, Node Allocations):**
   - Click the gear icon in the top right to access the **Administrative Area**.
   - In the sidebar, select **Application API**.
   - Click **Create New**, label it `RexaCloud Application Key`, and grant Read & Write permissions for **Users**, **Servers**, **Nodes**, **Allocations**, **Locations**, and **Nests**.
   - Copy the generated token starting with `ptla_`.

3. **Verify Connection in RexaCloud:**
   - In RexaCloud, navigate to **Admin Dashboard > Settings**.
   - Paste your Panel URL, Client Key, and Application Key.
   - Click **Test Connection**. RexaCloud tests reachability, measures response latency, and validates credentials.
   - When verified, the dashboard transitions from **Demo Sandbox Mode** to **Live Production Mode**.

---

## Manual Installation (Step-by-Step)

If you prefer installing without `installer.sh`:

### 1. Install Node.js 20 LTS
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx certbot python3-certbot-nginx
```

### 2. Deploy RexaCloud
```bash
sudo mkdir -p /var/www/rexacloud
sudo git clone https://github.com/jukgamer200-gif/Rexa-dash-test.git /var/www/rexacloud
cd /var/www/rexacloud
sudo npm install
sudo npm run build
```

### 3. Configure Environment
```bash
sudo cp .env.example .env
npm run cli key:generate
```

### 4. Create Initial Administrator
```bash
npm run cli admin:create
```

### 5. Configure Systemd Service
Create `/etc/systemd/system/rexacloud.service`:
```ini
[Unit]
Description=RexaCloud Game Server Management Panel
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/rexacloud
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now rexacloud
```

---

## License

RexaCloud Proprietary Hosting Infrastructure. All rights reserved.
