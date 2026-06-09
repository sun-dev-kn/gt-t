if (typeof window.dotGitInjected === 'undefined') {
    window.dotGitInjected = true;

    let debug = false;

    // Per-origin rate limiting state for stealth mode
    const rateLimitMap = new Map(); // origin → { count403: number, suspended: boolean, suspendedUntil: number }

    function debugLog(...args) {
        if (debug) {
            console.log('[DotGit]', ...args);
        }
    }
    debugLog("Content script initialized");

    // =============================================
    // CHECK REGISTRY - All checks defined here
    // =============================================
    // Each check is an object with:
    //   id:        unique key (matches options.functions.xxx)
    //   category:  grouping for options UI
    //   label:     display name
    //   paths:     array of paths to check (relative to origin)
    //   validate:  function(text) => bool - validates response body
    //   severity:  "critical" | "high" | "medium" | "info"
    //   matchAny:  if true, returns the first matching path (like security.txt)

    const CHECK_REGISTRY = [
        // === Version Control ===
        {
            id: "git",
            category: "vcs",
            label: ".git",
            paths: ["/.git/HEAD"],
            validate: (text) => {
                const headerMatch = text.startsWith("ref: refs/heads/");
                const hashMatch = /^[a-f0-9]{40}/y.test(text);
                return headerMatch || hashMatch;
            },
            severity: "critical"
        },
        {
            id: "svn",
            category: "vcs",
            label: ".svn",
            paths: ["/.svn/wc.db"],
            validate: (text) => text.startsWith("SQLite"),
            severity: "critical"
        },
        {
            id: "hg",
            category: "vcs",
            label: ".hg",
            paths: ["/.hg/store/00manifest.i"],
            validate: (text) => {
                const headers = [
                    "\u0000\u0000\u0000\u0001",
                    "\u0000\u0001\u0000\u0001",
                    "\u0000\u0002\u0000\u0001",
                    "\u0000\u0003\u0000\u0001",
                ];
                return headers.some(header => text.startsWith(header));
            },
            severity: "critical"
        },
        {
            id: "env",
            category: "secrets",
            label: ".env",
            paths: ["/.env"],
            validate: (text) => /^[A-Z_]+=|^[#\n\r ][\s\S]*^[A-Z_]+=/m.test(text),
            severity: "critical"
        },
        {
            id: "ds_store",
            category: "vcs",
            label: ".DS_Store",
            paths: ["/.DS_Store"],
            validate: (text) => text.startsWith("\x00\x00\x00\x01Bud1"),
            severity: "medium"
        },
        {
            id: "cvs",
            category: "vcs",
            label: "CVS",
            paths: ["/CVS/Root", "/CVS/Entries"],
            validate: (text) => {
                // CVS/Root contains a CVSROOT path like :pserver:user@host:/path
                // CVS/Entries contains lines like /filename/revision/date/options/tagdate
                return text.startsWith(":") || /^\/[^\n]+\/[0-9]/.test(text) || /^D\//.test(text);
            },
            severity: "high"
        },
        {
            id: "bzr",
            category: "vcs",
            label: ".bzr (Bazaar)",
            paths: ["/.bzr/README", "/.bzr/branch-format"],
            validate: (text) => text.includes("This is a Bazaar") || text.includes("Bazaar-NG"),
            severity: "high"
        },
        {
            id: "svn_entries",
            category: "vcs",
            label: ".svn/entries (legacy)",
            paths: ["/.svn/entries"],
            validate: (text) => {
                // Old SVN format: first line is a version number, or XML format
                return /^\d+\s*$/.test(text.split('\n')[0]) || text.startsWith("<?xml");
            },
            severity: "high"
        },

        // === Configuration & Secrets ===
        {
            id: "env_local",
            category: "secrets",
            label: ".env.local",
            paths: ["/.env.local"],
            validate: (text) => /^[A-Z_]+=|^[#\n\r ][\s\S]*^[A-Z_]+=/m.test(text),
            severity: "critical"
        },
        {
            id: "env_production",
            category: "secrets",
            label: ".env.production",
            paths: ["/.env.production", "/.env.prod"],
            validate: (text) => /^[A-Z_]+=|^[#\n\r ][\s\S]*^[A-Z_]+=/m.test(text),
            severity: "critical"
        },
        {
            id: "env_backup",
            category: "secrets",
            label: ".env backup",
            paths: ["/.env.backup", "/.env.bak", "/.env.old", "/.env.save"],
            validate: (text) => /^[A-Z_]+=|^[#\n\r ][\s\S]*^[A-Z_]+=/m.test(text),
            severity: "critical"
        },
        {
            id: "env_dev",
            category: "secrets",
            label: ".env.dev/.env.staging",
            paths: ["/.env.dev", "/.env.development", "/.env.staging", "/.env.test"],
            validate: (text) => /^[A-Z_]+=|^[#\n\r ][\s\S]*^[A-Z_]+=/m.test(text),
            severity: "high"
        },
        {
            id: "npmrc",
            category: "secrets",
            label: ".npmrc",
            paths: ["/.npmrc"],
            validate: (text) => /\/\/registry|_authToken|_auth\s*=/.test(text),
            severity: "critical"
        },
        {
            id: "dockerenv",
            category: "secrets",
            label: ".dockerenv",
            paths: ["/.dockerenv"],
            validate: () => true, // Existence alone is meaningful
            severity: "info"
        },
        {
            id: "docker_compose",
            category: "secrets",
            label: "docker-compose.yml",
            paths: ["/docker-compose.yml", "/docker-compose.yaml", "/docker-compose.prod.yml"],
            validate: (text) => /^(version|services)\s*:/m.test(text),
            severity: "high"
        },
        {
            id: "dockerfile",
            category: "secrets",
            label: "Dockerfile",
            paths: ["/Dockerfile", "/dockerfile"],
            validate: (text) => /^FROM\s+/m.test(text),
            severity: "medium"
        },
        {
            id: "wp_config",
            category: "secrets",
            label: "wp-config.php",
            paths: ["/wp-config.php", "/wp-config.php.bak", "/wp-config.php.old", "/wp-config.php~", "/wp-config.php.save"],
            validate: (text) => /DB_PASSWORD|DB_NAME|AUTH_KEY|SECURE_AUTH_KEY/.test(text),
            severity: "critical"
        },
        {
            id: "composer_auth",
            category: "secrets",
            label: "auth.json (Composer)",
            paths: ["/auth.json"],
            validate: (text) => {
                try { const j = JSON.parse(text); return j["http-basic"] || j["github-oauth"] || j["gitlab-token"]; }
                catch { return false; }
            },
            severity: "critical"
        },
        {
            id: "firebase",
            category: "secrets",
            label: "Firebase config",
            paths: ["/firebase.json", "/.firebaserc"],
            validate: (text) => {
                try { const j = JSON.parse(text); return j.hosting || j.projects || j.firestore; }
                catch { return false; }
            },
            severity: "medium"
        },
        {
            id: "terraform_state",
            category: "secrets",
            label: "terraform.tfstate",
            paths: ["/terraform.tfstate"],
            validate: (text) => {
                try { const j = JSON.parse(text); return j.version !== undefined && j.resources !== undefined; }
                catch { return false; }
            },
            severity: "critical"
        },
        {
            id: "terraform_vars",
            category: "secrets",
            label: "terraform.tfvars",
            paths: ["/terraform.tfvars"],
            validate: (text) => /^\s*\w+\s*=\s*/m.test(text),
            severity: "critical"
        },
        {
            id: "rails_secrets",
            category: "secrets",
            label: "Rails secrets",
            paths: ["/config/database.yml", "/config/secrets.yml", "/config/master.key"],
            validate: (text) => /password:|secret_key_base:|production:/.test(text) || text.length === 32,
            severity: "critical"
        },
        {
            id: "django_settings",
            category: "secrets",
            label: "Django settings",
            paths: ["/settings.py", "/local_settings.py"],
            validate: (text) => /SECRET_KEY|DATABASES\s*=/.test(text),
            severity: "critical"
        },
        {
            id: "laravel_log",
            category: "secrets",
            label: "Laravel log",
            paths: ["/storage/logs/laravel.log"],
            validate: (text) => /^\[\d{4}-\d{2}-\d{2}/.test(text) || text.includes("laravel"),
            severity: "high"
        },
        {
            id: "ssh_keys",
            category: "secrets",
            label: "SSH keys",
            paths: ["/.ssh/id_rsa", "/.ssh/id_ed25519", "/.ssh/authorized_keys"],
            validate: (text) => /BEGIN (RSA|OPENSSH|EC|DSA) PRIVATE KEY|ssh-(rsa|ed25519)/.test(text),
            severity: "critical"
        },
        {
            id: "aws_credentials",
            category: "secrets",
            label: "AWS credentials",
            paths: ["/.aws/credentials", "/.aws/config"],
            validate: (text) => /\[default\]|aws_access_key_id|aws_secret_access_key/.test(text),
            severity: "critical"
        },
        {
            id: "kube_config",
            category: "secrets",
            label: "Kubernetes config",
            paths: ["/.kube/config", "/kubeconfig"],
            validate: (text) => /apiVersion:|clusters:|users:/.test(text),
            severity: "critical"
        },

        // === Backup & Archive Files ===
        {
            id: "sql_dump",
            category: "backup",
            label: "SQL dump",
            paths: ["/dump.sql", "/backup.sql", "/database.sql", "/db.sql", "/data.sql", "/mysql.sql",
                    "/db_backup.sql", "/archive.sql", "/full_dump.sql", "/export.sql"],
            validate: (text) => {
                // Multi-dialect SQL detection
                const basic = /CREATE\s+(TABLE|DATABASE|SCHEMA|VIEW|PROCEDURE|FUNCTION|TRIGGER|INDEX)\s+/i.test(text)
                    || /INSERT\s+INTO\s+\w+\s*(?:\(|VALUES\s*\()/i.test(text);
                const dumpHeader = /--\s*(MySQL|PostgreSQL|SQLite|SQL\s+Server)\s*(dump|generated|export)|Dump\s+completed\s+on/i.test(text);
                const mysql = /SET\s+(SQL_MODE|FOREIGN_KEY_CHECKS|UNIQUE_CHECKS)\s*=|ENGINE\s*=\s*(InnoDB|MyISAM)/i.test(text);
                const postgres = /CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS|\\COPY\s+\w+\s+FROM\s+stdin|SELECT\s+pg_catalog\.setval/i.test(text);
                const sqlite = /PRAGMA\s+(foreign_keys|synchronous|journal_mode)\s*=|BEGIN\s+TRANSACTION/i.test(text);
                const mssql = /SET\s+(ANSI_NULLS|QUOTED_IDENTIFIER)\s+ON|USE\s+\[\w+\]/i.test(text);
                return basic || dumpHeader || mysql || postgres || sqlite || mssql;
            },
            severity: "critical"
        },
        {
            id: "backup_archive",
            category: "backup",
            label: "Backup archives",
            paths: ["/backup.zip", "/backup.tar.gz", "/site.zip", "/www.zip", "/archive.zip",
                    "/source.zip", "/site_backup.zip", "/full_backup.zip", "/data.zip",
                    "/backup.tar", "/site-backup.tar.gz", "/data.tar.gz", "/data.tar",
                    "/backup.rar", "/source-code.rar", "/archive.rar",
                    "/backup.7z", "/data.7z", "/snapshots/backup.zip"],
            validate: (text) => {
                // Magic bytes: ZIP=PK, GZIP=\x1f\x8b, RAR=Rar!, 7z=7z\xBC
                return text.startsWith("PK") || text.startsWith("\x1f\x8b")
                    || text.startsWith("Rar!") || text.startsWith("7z\xBC");
            },
            severity: "critical"
        },
        {
            id: "php_backup",
            category: "backup",
            label: "PHP config backups",
            paths: ["/config.php.bak", "/config.php.old", "/config.php~", "/index.php.bak", "/configuration.php.bak",
                    "/config.old", "/site.bak", "/config.php.save", "/config.php.orig",
                    "/config.php.tmp", "/config.php.swp", "/login.php.bak", "/admin.php.bak"],
            validate: (text) => /<?php|<\?=/.test(text),
            severity: "critical"
        },
        {
            id: "htaccess_backup",
            category: "backup",
            label: ".htaccess backup",
            paths: ["/.htaccess.bak", "/.htaccess.old", "/.htaccess~"],
            validate: (text) => /RewriteEngine|RewriteRule|Deny from|Allow from|AuthType/.test(text),
            severity: "high"
        },
        {
            id: "web_config_backup",
            category: "backup",
            label: "web.config backup",
            paths: ["/web.config.bak", "/web.config.old"],
            validate: (text) => /<configuration>|<system\.webServer>/.test(text),
            severity: "high"
        },

        // === Debug & Admin Panels ===
        {
            id: "phpinfo",
            category: "debug",
            label: "phpinfo()",
            paths: ["/phpinfo.php", "/info.php", "/php_info.php", "/test.php", "/i.php"],
            validate: (text) => /phpinfo\(\)|PHP Version|PHP Credits|Configuration File/.test(text),
            severity: "high"
        },
        {
            id: "php_errors",
            category: "debug",
            label: "PHP error log",
            paths: ["/error_log", "/php_errors.log", "/error.log",
                    "/debug.log", "/application.log"],
            validate: (text) => /PHP (Fatal error|Warning|Notice|Parse error)|Stack trace:|^\[\d{4}-\d{2}-\d{2}/m.test(text),
            severity: "high"
        },
        {
            id: "adminer",
            category: "debug",
            label: "Adminer",
            paths: ["/adminer.php", "/adminer/"],
            validate: (text) => /Adminer|adminer\.css/.test(text),
            severity: "critical"
        },
        {
            id: "phpmyadmin",
            category: "debug",
            label: "phpMyAdmin",
            paths: ["/phpmyadmin/", "/pma/", "/phpMyAdmin/", "/myadmin/", "/mysql/"],
            validate: (text) => /phpMyAdmin|PMA_commonParams/.test(text),
            severity: "critical"
        },
        {
            id: "spring_actuator",
            category: "debug",
            label: "Spring Actuator",
            paths: ["/actuator", "/actuator/env", "/actuator/health", "/actuator/configprops", "/actuator/beans"],
            validate: (text) => {
                try { const j = JSON.parse(text); return j._links || j.status || j.beans || j.propertySources; }
                catch { return false; }
            },
            severity: "critical"
        },
        {
            id: "symfony_profiler",
            category: "debug",
            label: "Symfony profiler",
            paths: ["/_profiler/", "/_wdt/"],
            validate: (text) => /Symfony|sf-toolbar|profiler/.test(text),
            severity: "high"
        },
        {
            id: "laravel_telescope",
            category: "debug",
            label: "Laravel Telescope",
            paths: ["/telescope"],
            validate: (text) => /Telescope|telescope-app/.test(text),
            severity: "high"
        },
        {
            id: "rails_info",
            category: "debug",
            label: "Rails info",
            paths: ["/rails/info/properties", "/rails/info/routes"],
            validate: (text) => /Rails version|ruby|Environment/.test(text),
            severity: "high"
        },
        {
            id: "django_debug",
            category: "debug",
            label: "Django debug toolbar",
            paths: ["/__debug__/"],
            validate: (text) => /djdt|Django Debug Toolbar/.test(text),
            severity: "high"
        },
        {
            id: "elmah",
            category: "debug",
            label: "Elmah (.NET errors)",
            paths: ["/elmah.axd"],
            validate: (text) => /ELMAH|Error Log|errorlog/.test(text),
            severity: "high"
        },
        {
            id: "grafana",
            category: "debug",
            label: "Grafana / Metrics",
            paths: ["/grafana/", "/metrics"],
            validate: (text) => /grafana|Grafana|# HELP|# TYPE/.test(text),
            severity: "high"
        },

        // === Server Configuration ===
        {
            id: "htaccess",
            category: "server",
            label: ".htaccess",
            paths: ["/.htaccess"],
            validate: (text) => /RewriteEngine|RewriteRule|Deny from|Allow from|AuthType|Options/.test(text),
            severity: "medium"
        },
        {
            id: "htpasswd",
            category: "server",
            label: ".htpasswd",
            paths: ["/.htpasswd"],
            validate: (text) => /^[a-zA-Z0-9_.-]+:\$?[\$a-zA-Z0-9.\/]+/m.test(text),
            severity: "critical"
        },
        {
            id: "nginx_conf",
            category: "server",
            label: "nginx.conf",
            paths: ["/nginx.conf", "/conf/nginx.conf"],
            validate: (text) => /server\s*\{|location\s+\/|upstream\s+/.test(text),
            severity: "high"
        },
        {
            id: "server_status",
            category: "server",
            label: "Apache server-status",
            paths: ["/server-status", "/server-info"],
            validate: (text) => /Apache Server Status|Server Version|Current Time/.test(text),
            severity: "high"
        },
        {
            id: "nginx_status",
            category: "server",
            label: "Nginx status",
            paths: ["/nginx_status", "/stub_status"],
            validate: (text) => /Active connections:\s*\d+/.test(text),
            severity: "medium"
        },
        {
            id: "web_config",
            category: "server",
            label: "web.config",
            paths: ["/web.config"],
            validate: (text) => /<configuration>|<system\.webServer>/.test(text),
            severity: "high"
        },
        {
            id: "crossdomain",
            category: "server",
            label: "crossdomain.xml",
            paths: ["/crossdomain.xml"],
            validate: (text) => /allow-access-from|cross-domain-policy/.test(text),
            severity: "medium"
        },
        {
            id: "robots_txt",
            category: "server",
            label: "robots.txt (info leak)",
            paths: ["/robots.txt"],
            validate: (text) => /Disallow:\s*\/[a-zA-Z]/.test(text) && /admin|secret|private|backup|staging|dev|internal/.test(text.toLowerCase()),
            severity: "info"
        },

        // === API & Documentation ===
        {
            id: "swagger",
            category: "api",
            label: "Swagger / OpenAPI",
            paths: ["/swagger.json", "/swagger-ui.html", "/swagger-ui/", "/api-docs", "/openapi.json", "/openapi.yaml", "/openapi.yml", "/v2/api-docs", "/v3/api-docs"],
            validate: (text) => /swagger|openapi|"paths"\s*:|"info"\s*:/.test(text.toLowerCase()),
            severity: "medium"
        },
        {
            id: "graphql",
            category: "api",
            label: "GraphQL endpoint",
            paths: ["/graphql", "/graphiql"],
            validate: (text) => /graphiql|GraphQL Playground|"data"\s*:|__schema/.test(text),
            severity: "medium"
        },
        {
            id: "wsdl",
            category: "api",
            label: "WSDL",
            paths: ["/service.wsdl", "/api.wsdl"],
            validate: (text) => /wsdl:|<definitions|<wsdl:definitions/.test(text),
            severity: "medium"
        },

        // === CMS-Specific ===
        {
            id: "wp_login",
            category: "cms",
            label: "WordPress login",
            paths: ["/wp-login.php"],
            validate: (text) => /wp-login|WordPress|wp-includes/.test(text),
            severity: "info"
        },
        {
            id: "wp_xmlrpc",
            category: "cms",
            label: "WordPress XML-RPC",
            paths: ["/xmlrpc.php"],
            validate: (text) => /XML-RPC server accepts POST requests only|xmlrpc/.test(text),
            severity: "medium"
        },
        {
            id: "wp_user_enum",
            category: "cms",
            label: "WordPress user enum",
            paths: ["/wp-json/wp/v2/users"],
            validate: (text) => {
                try { const j = JSON.parse(text); return Array.isArray(j) && j.length > 0 && j[0].slug; }
                catch { return false; }
            },
            severity: "medium"
        },
        {
            id: "joomla",
            category: "cms",
            label: "Joomla admin",
            paths: ["/administrator/", "/administrator/index.php"],
            validate: (text) => /Joomla|com_login/.test(text),
            severity: "info"
        },
        {
            id: "drupal",
            category: "cms",
            label: "Drupal",
            paths: ["/CHANGELOG.txt", "/core/CHANGELOG.txt"],
            validate: (text) => /Drupal\s+\d+\.\d+/.test(text),
            severity: "info"
        },
        {
            id: "magento",
            category: "cms",
            label: "Magento config",
            paths: ["/app/etc/local.xml", "/app/etc/env.php", "/downloader/"],
            validate: (text) => /Magento|Mage_|magento|CRYPT_KEY/.test(text),
            severity: "high"
        },

        // === CI/CD & DevOps ===
        {
            id: "jenkinsfile",
            category: "cicd",
            label: "Jenkinsfile",
            paths: ["/Jenkinsfile"],
            validate: (text) => /pipeline\s*\{|node\s*\{|stage\s*\(/.test(text),
            severity: "medium"
        },
        {
            id: "gitlab_ci",
            category: "cicd",
            label: ".gitlab-ci.yml",
            paths: ["/.gitlab-ci.yml"],
            validate: (text) => /stages:|script:|image:/.test(text),
            severity: "medium"
        },
        {
            id: "travis_ci",
            category: "cicd",
            label: ".travis.yml",
            paths: ["/.travis.yml"],
            validate: (text) => /language:|script:|install:/.test(text),
            severity: "medium"
        },
        {
            id: "github_actions",
            category: "cicd",
            label: "GitHub Actions",
            paths: ["/.github/workflows/main.yml", "/.github/workflows/ci.yml", "/.github/workflows/build.yml"],
            validate: (text) => /on:|jobs:|steps:|runs-on:/.test(text),
            severity: "medium"
        },
        {
            id: "circleci",
            category: "cicd",
            label: "CircleCI config",
            paths: ["/.circleci/config.yml"],
            validate: (text) => /version:\s*2|jobs:|workflows:/.test(text),
            severity: "medium"
        },

        // === Package & Dependency Files ===
        {
            id: "package_json",
            category: "packages",
            label: "package.json",
            paths: ["/package.json"],
            validate: (text) => {
                try { const j = JSON.parse(text); return j.name && (j.dependencies || j.devDependencies); }
                catch { return false; }
            },
            severity: "info"
        },
        {
            id: "package_lock",
            category: "packages",
            label: "package-lock.json",
            paths: ["/package-lock.json"],
            validate: (text) => {
                try { const j = JSON.parse(text); return j.lockfileVersion !== undefined; }
                catch { return false; }
            },
            severity: "info"
        },
        {
            id: "composer_json",
            category: "packages",
            label: "composer.json",
            paths: ["/composer.json"],
            validate: (text) => {
                try { const j = JSON.parse(text); return j.require || j.name; }
                catch { return false; }
            },
            severity: "info"
        },
        {
            id: "gemfile",
            category: "packages",
            label: "Gemfile",
            paths: ["/Gemfile", "/Gemfile.lock"],
            validate: (text) => /^source\s+|^gem\s+|GEM\s+remote:/m.test(text),
            severity: "info"
        },
        {
            id: "requirements_txt",
            category: "packages",
            label: "requirements.txt",
            paths: ["/requirements.txt"],
            validate: (text) => /^[a-zA-Z0-9_-]+[>=<~!]+/m.test(text),
            severity: "info"
        },
        {
            id: "pom_xml",
            category: "packages",
            label: "pom.xml (Maven)",
            paths: ["/pom.xml"],
            validate: (text) => /<project|<groupId>|<artifactId>/.test(text),
            severity: "info"
        },
        {
            id: "cargo_toml",
            category: "packages",
            label: "Cargo.toml (Rust)",
            paths: ["/Cargo.toml"],
            validate: (text) => /\[package\]|\[dependencies\]/.test(text),
            severity: "info"
        },
        {
            id: "go_sum",
            category: "packages",
            label: "go.sum",
            paths: ["/go.sum", "/go.mod"],
            validate: (text) => /^module\s+|^require\s+|h1:[A-Za-z0-9+\/=]+/m.test(text),
            severity: "info"
        },

        // === Information Disclosure ===
        {
            id: "dir_listing",
            category: "info",
            label: "Directory listing",
            paths: ["/", "/images/", "/uploads/", "/assets/", "/static/", "/files/", "/backup/"],
            validate: (text) => /<title>\s*Index of\s|Directory listing for|Parent Directory/.test(text),
            severity: "medium"
        },
        {
            id: "source_maps",
            category: "info",
            label: "JavaScript source maps",
            paths: ["/main.js.map", "/app.js.map", "/bundle.js.map"],
            validate: (text) => {
                try { const j = JSON.parse(text); return j.version && j.sources && j.mappings; }
                catch { return false; }
            },
            severity: "medium"
        },
        {
            id: "sitemap",
            category: "info",
            label: "Sitemap XML",
            paths: ["/sitemap.xml"],
            validate: (text) => /<urlset|<sitemapindex/.test(text),
            severity: "info"
        },

        // === Additional Configuration Files (from guide Section 1) ===
        {
            id: "app_settings",
            category: "secrets",
            label: "App settings files",
            paths: ["/settings.yml", "/app.config", "/application.properties", "/application.yml",
                    "/application.yaml", "/config.yml"],
            validate: (text) => /database:|password:|secret:|api[_-]?key:|connection[_-]?string:/i.test(text),
            severity: "high"
        },
        {
            id: "config_json",
            category: "secrets",
            label: "Config/Secrets JSON",
            paths: ["/config.json", "/secrets.json", "/credentials.json", "/app.json"],
            validate: (text) => {
                try {
                    const j = JSON.parse(text);
                    if (typeof j !== 'object' || Array.isArray(j)) return false;
                    // Deep sensitive key detection
                    const hasSensitive = (obj, depth = 0) => {
                        if (depth > 5 || typeof obj !== 'object' || obj === null) return false;
                        for (const key in obj) {
                            if (/password|api_key|apiKey|secret|token|auth|credential|private_key|access_key|db_url|database|connection_string/i.test(key)) return true;
                            if (hasSensitive(obj[key], depth + 1)) return true;
                        }
                        return false;
                    };
                    return hasSensitive(j);
                } catch { return false; }
            },
            severity: "critical"
        },
        {
            id: "config_php",
            category: "secrets",
            label: "config.php (exposed)",
            paths: ["/config.php", "/configuration.php", "/settings.php", "/db.php", "/database.php"],
            validate: (text) => /define\s*\(\s*['"]DB_(NAME|PASSWORD|HOST|USER)['"]|mysql_connect|\$dbpass|\$db_password/i.test(text),
            severity: "critical"
        },
        {
            id: "pem_keys",
            category: "secrets",
            label: "Private keys (PEM)",
            paths: ["/keys.pem", "/server.key", "/private.key", "/cert.key", "/id_rsa", "/private.pem"],
            validate: (text) => /BEGIN (RSA |EC |DSA )?PRIVATE KEY|BEGIN OPENSSH PRIVATE KEY/.test(text),
            severity: "critical"
        },
        {
            id: "google_cloud",
            category: "secrets",
            label: "Google Cloud credentials",
            paths: ["/google-cloud.json", "/gcp-credentials.json", "/service-account.json",
                    "/google-services.json", "/client_secret.json"],
            validate: (text) => {
                try { const j = JSON.parse(text); return j.private_key || j.client_secret || j.type === "service_account"; }
                catch { return false; }
            },
            severity: "critical"
        },

        // === Git metadata (from guide Section 6) ===
        {
            id: "gitignore",
            category: "vcs",
            label: ".gitignore / .gitmodules",
            paths: ["/.gitignore", "/.gitmodules"],
            validate: (text) => /^\*\.|^#|^\/.+|^\[submodule/m.test(text),
            severity: "info"
        },

        // === Admin panels (from guide Section 3) ===
        {
            id: "admin_panel",
            category: "debug",
            label: "Admin panel",
            paths: ["/admin/", "/admin.php", "/login.php", "/admin/login", "/administrator/login.php",
                    "/admin/index.php", "/cp/", "/controlpanel/"],
            validate: (text) => /<input[^>]*type\s*=\s*["']password["']|admin.*login|sign.?in|dashboard/i.test(text),
            severity: "medium"
        },
        {
            id: "debug_dirs",
            category: "debug",
            label: "Debug/test directories",
            paths: ["/debug/", "/test/", "/dev/", "/console/", "/dashboard/", "/staging/"],
            validate: (text) => /debug|var_dump|phpinfo|stack.?trace|exception|error/i.test(text),
            severity: "high"
        },

        // === Log files (from guide Section 4) ===
        {
            id: "log_files",
            category: "debug",
            label: "Server log files",
            paths: ["/access.log", "/server.log", "/access_log", "/var/log/apache2/error.log",
                    "/logs/error.log", "/logs/access.log"],
            validate: (text) => /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|^\[\d{4}-\d{2}-\d{2}|\d{2}\/\w{3}\/\d{4}/m.test(text),
            severity: "high"
        },

        // === API config endpoints (from guide Section 7) ===
        {
            id: "api_config",
            category: "api",
            label: "API config endpoints",
            paths: ["/api/keys", "/api/config", "/api/settings", "/api/v1/config"],
            validate: (text) => {
                try { const j = JSON.parse(text); return typeof j === 'object' && !Array.isArray(j); }
                catch { return false; }
            },
            severity: "medium"
        },
        {
            id: "client_access_policy",
            category: "server",
            label: "clientaccesspolicy.xml",
            paths: ["/clientaccesspolicy.xml"],
            validate: (text) => /allow-from|cross-domain-access|access-policy/.test(text),
            severity: "medium"
        },

        // === Misc info disclosure (from guide Section 9) ===
        {
            id: "readme_docs",
            category: "info",
            label: "README / INSTALL docs",
            paths: ["/README.md", "/readme.md", "/INSTALL.txt", "/CHANGELOG.md", "/CHANGELOG.txt"],
            validate: (text) => /version|install|setup|configuration|password|database|api/i.test(text) && text.length > 200,
            severity: "info"
        },
        {
            id: "csv_export",
            category: "backup",
            label: "CSV data exports",
            paths: ["/export.csv", "/data_export.csv", "/users.csv", "/data.csv", "/dump.csv"],
            validate: (text) => {
                const lines = text.split('\n');
                // Must have header + data, with consistent comma count
                if (lines.length < 3) return false;
                const headerCommas = (lines[0].match(/,/g) || []).length;
                return headerCommas >= 2 && /email|name|user|phone|password|id/i.test(lines[0]);
            },
            severity: "high"
        },
    ];

    // Security.txt is special — it's always checked separately and returns the URL
    const SECURITYTXT_PATHS = [
        "/.well-known/security.txt",
        "/security.txt",
    ];
    const SECURITYTXT_SEARCH = "Contact: ";

    // Git config / opensource check constants
    const GIT_CONFIG_PATH = "/.git/config";
    const GIT_CONFIG_SEARCH = "url = (.*(github\\.com|gitlab\\.com).*)";

    // =============================================
    // Stealth helpers
    // =============================================
    function buildStealthHeaders(origin) {
        return {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "Referer": origin + "/",
        };
    }

    function randomDelay(min, max) {
        return new Promise(r => setTimeout(r, min + Math.random() * (max - min)));
    }

    function isOriginSuspended(origin) {
        const state = rateLimitMap.get(origin);
        if (!state?.suspended) return false;
        if (Date.now() > state.suspendedUntil) {
            state.suspended = false;
            return false;
        }
        return true;
    }

    function markRateLimited(origin) {
        rateLimitMap.set(origin, {
            count403: 0,
            suspended: true,
            suspendedUntil: Date.now() + 5 * 60 * 1000, // 5 minutes
        });
    }

    function trackHttp403(origin) {
        const state = rateLimitMap.get(origin) || { count403: 0, suspended: false, suspendedUntil: 0 };
        state.count403 = (state.count403 || 0) + 1;
        rateLimitMap.set(origin, state);
        if (state.count403 >= 5) {
            markRateLimited(origin);
            return true; // suspended
        }
        return false;
    }

    // =============================================
    // Generic check runner
    // =============================================
    async function fetchWithTimeout(resource, options = {}) {
        const { timeout = 10000, stealthHeaders, ...fetchOptions } = options;
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        const mergedHeaders = stealthHeaders ? { ...stealthHeaders, ...(fetchOptions.headers || {}) } : fetchOptions.headers;
        const response = await fetch(resource, {
            ...fetchOptions,
            headers: mergedHeaders,
            signal: controller.signal,
        });
        clearTimeout(id);
        return response;
    }

    async function runCheck(url, checkDef, options = {}) {
        for (const path of checkDef.paths) {
            const to_check = url + path;
            try {
                debugLog(`Checking ${checkDef.id}:`, to_check);
                const fetchOpts = {
                    redirect: "manual",
                    timeout: 10000,
                };
                if (options.stealth?.enabled && options.stealth?.realisticHeaders) {
                    fetchOpts.stealthHeaders = buildStealthHeaders(url);
                }
                const response = await fetchWithTimeout(to_check, fetchOpts);

                if (response.status === 429 && options.stealth?.rateLimitBackoff) {
                    markRateLimited(url);
                    return false; // stop checking this origin
                }
                if (response.status === 403 && options.stealth?.rateLimitBackoff) {
                    if (trackHttp403(url)) return false; // suspended
                }

                if (response.status === 200) {
                    const text = await response.text();
                    if (checkDef.validate(text)) {
                        debugLog(`${checkDef.id} found at ${to_check}`);
                        if (checkDef.id === "git") {
                            chrome.runtime.sendMessage({
                                type: "GIT_FOUND",
                                url: url
                            });
                        }
                        return true;
                    }
                }
            } catch (error) {
                debugLog(`Error checking ${checkDef.id}:`, error);
            }
        }
        return false;
    }

    // =============================================
    // Special checks (git config, opensource, security.txt)
    // =============================================
    async function checkSecuritytxt(url) {
        for (const path of SECURITYTXT_PATHS) {
            const to_check = url + path;
            const search = new RegExp(SECURITYTXT_SEARCH);
            try {
                const response = await fetchWithTimeout(to_check, {
                    redirect: "manual",
                    timeout: 10000
                });
                if (response.status === 200) {
                    const text = await response.text();
                    if (search.test(text)) {
                        return to_check;
                    }
                }
            } catch (error) {
                // Ignore error
            }
        }
        return false;
    }

    async function checkGitConfig(url) {
        const to_check = url + GIT_CONFIG_PATH;
        const search = new RegExp(GIT_CONFIG_SEARCH);
        let result = [];
        try {
            const response = await fetchWithTimeout(to_check, {
                redirect: "manual",
                timeout: 10000
            });
            if (response.status === 200) {
                let text = await response.text();
                if (text !== false && ((result = search.exec(text)) !== null)) {
                    return result[1];
                }
            }
        } catch (error) {
            // Ignore error
        }
        return false;
    }

    async function checkOpenSource(url) {
        try {
            const response = await fetchWithTimeout(url, {
                redirect: "manual",
                timeout: 10000
            });
            if (response.status === 200) {
                return url;
            }
        } catch (error) {
            // Ignore error
        }
        return false;
    }

    async function isOpenSource(url) {
        let configUrl;
        let str = "";

        configUrl = await checkGitConfig(url);

        if (configUrl !== false) {
            str = configUrl.replace("github.com:", "github.com/");
            str = str.replace("gitlab.com:", "gitlab.com/");
            if (str.startsWith("ssh://")) {
                str = str.substring(6);
            }
            if (str.startsWith("git@")) {
                str = str.substring(4);
            }
            if (str.endsWith(".git")) {
                str = str.substring(0, str.length - 4);
            }
            if (str.startsWith("http") === false) {
                str = "https://" + str;
            }

            try {
                new URL(str);
                return await checkOpenSource(str);
            } catch (_) {
                return false;
            }
        }

        return false;
    }

    // =============================================
    // Main site check — runs all enabled checks
    // =============================================
    async function checkSite(url, options, dynamicChecks = []) {
        try {
            debugLog('Starting site check for:', url);

            // Hydrate dynamic checks
            const hydratedDynamic = dynamicChecks.map(c => {
                try {
                    return {
                        ...c,
                        paths: typeof c.paths === 'string' ? JSON.parse(c.paths) : c.paths,
                        validate: c.validate_js ? new Function('text', c.validate_js) : () => true,
                    };
                } catch {
                    return null;
                }
            }).filter(Boolean);

            // Deduplicate by id (static registry first, dynamic appended)
            const seenIds = new Set();
            const mergedRegistry = [...CHECK_REGISTRY, ...hydratedDynamic].filter(c => {
                if (seenIds.has(c.id)) return false;
                seenIds.add(c.id);
                return true;
            });

            // Filter enabled checks: static gated by options.functions, dynamic always enabled
            const enabledChecks = mergedRegistry.filter(check =>
                check.id && check.id.startsWith('dynamic_')
                    ? true
                    : options.functions?.[check.id]
            );

            // Stealth: shuffle check order
            if (options.stealth?.enabled && options.stealth?.shufflePaths) {
                enabledChecks.sort(() => Math.random() - 0.5);
            }

            // Stealth: check if origin is rate-limited
            if (options.stealth?.enabled && options.stealth?.rateLimitBackoff && isOriginSuspended(url)) {
                debugLog('Stealth: origin suspended, skipping', url);
                return;
            }

            // Stealth Tier 2: relay mode — send all probes to relay server
            if (options.stealth?.enabled && options.stealth?.relayEnabled && options.stealth?.relayUrl) {
                return checkSiteViaRelay(url, enabledChecks, options);
            }

            // Run checks
            let checkResults;
            if (options.stealth?.enabled && options.stealth?.mode === 'sequential') {
                checkResults = [];
                for (const check of enabledChecks) {
                    checkResults.push(await runCheck(url, check, options));
                    await randomDelay(options.stealth.minDelay || 500, options.stealth.maxDelay || 3000);
                }
            } else {
                // existing parallel execution
                checkResults = await Promise.all(enabledChecks.map(check => runCheck(url, check, options)));
            }

            // Run special checks in parallel
            const specialPromises = [
                options.check_securitytxt ? checkSecuritytxt(url) : Promise.resolve(false),
                options.functions?.git && options.check_opensource ? isOpenSource(url) : Promise.resolve(false)
            ];
            const [securitytxt, opensource] = await Promise.all(specialPromises);

            // Build types list and result object
            const types = [];
            const resultObj = { securitytxt, opensource };

            enabledChecks.forEach((check, i) => {
                resultObj[check.id] = checkResults[i];
                if (checkResults[i]) {
                    types.push(check.id);
                }
            });

            debugLog('Check results:', resultObj);
            debugLog('Found types:', types);

            // Build severity map from registry
            const severityMap = {};
            enabledChecks.forEach(check => { severityMap[check.id] = check.severity; });

            if (types.length > 0) {
                for (const type of types) {
                    debugLog('Sending finding for type:', type);
                    await new Promise((resolve) => {
                        chrome.runtime.sendMessage({
                            type: "FINDINGS_FOUND",
                            data: {
                                url: url,
                                types: [type],
                                severity: severityMap[type] || "info",
                                opensource: opensource,
                                securitytxt: securitytxt
                            }
                        }, response => {
                            debugLog('Background response for', type, ':', response);
                            resolve();
                        });
                    });
                }
            }

            return resultObj;
        } catch (error) {
            debugLog('Error during checks:', error);
            return {
                securitytxt: false,
                opensource: false,
                error: error.message
            };
        }
    }

    // =============================================
    // Relay-mode check — routes probes through relay server
    // =============================================
    async function checkSiteViaRelay(origin, enabledChecks, options) {
        const { relayUrl, relayApiKey, relayEnabled } = options.stealth || {};
        if (!relayEnabled || !relayUrl) return;

        const allPaths = [...new Set(enabledChecks.flatMap(c => c.paths || []))];

        let results;
        try {
            const res = await fetch(`${relayUrl}/api/probe`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(relayApiKey ? { "Authorization": `Bearer ${relayApiKey}` } : {}),
                },
                body: JSON.stringify({ targetUrl: origin, paths: allPaths, timeoutMs: 8000 }),
                signal: AbortSignal.timeout(60000),
            });
            if (!res.ok) return;
            const data = await res.json();
            results = data.results || [];
        } catch (err) {
            return;
        }

        // Map relay results back to findings using each check's validate function
        for (const check of enabledChecks) {
            for (const path of (check.paths || [])) {
                const result = results.find(r => r.path === path);
                if (result?.status === 200 && result.bodySnippet) {
                    try {
                        if (check.validate(result.bodySnippet)) {
                            chrome.runtime.sendMessage({
                                type: "FINDINGS_FOUND",
                                data: {
                                    url: origin,
                                    types: [check.id],
                                    severity: check.severity || 'medium',
                                }
                            });
                            if (check.matchAny) break;
                        }
                    } catch {}
                }
            }
        }
    }

    // Expose registry for external access
    window.dotGitCheckRegistry = CHECK_REGISTRY;

    // Listen for messages from the background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        debugLog('Received message:', request);

        if (request.type === "CHECK_SITE") {
            const { url, options } = request;
            debug = options.debug;
            debugLog('Checking site:', url, 'with options:', options);

            checkSite(url, options, request.dynamicChecks || []).then((results) => {
                sendResponse(results);
            }).catch(error => {
                debugLog('Error during checks:', error);
                sendResponse({
                    securitytxt: false,
                    opensource: false,
                    error: error.message
                });
            });

            return true; // Keep the message channel open for async response
        }
    });

    debugLog('Content script setup complete');
}
