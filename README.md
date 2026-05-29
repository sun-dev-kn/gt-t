[![FF users](https://img.shields.io/amo/users/dotgit?color=orange&label=Firefox%20users)](https://addons.mozilla.org/it/firefox/addon/dotgit/)
[![Chrome users](https://img.shields.io/chrome-web-store/users/pampamgoihgcedonnphgehgondkhikel?label=Chrome%20users)](https://chrome.google.com/webstore/detail/dotgit/pampamgoihgcedonnphgehgondkhikel)

# DotGit

A browser extension for detecting exposed sensitive files and directories on visited websites. Goes far beyond `.git` — checks for secrets, backups, debug panels, CI/CD configs, and more.

## Features

- **89 configurable security checks** across 10 categories (all off by default except `.git`)
- Severity levels for each finding: `critical`, `high`, `medium`, `info`
- Browser notifications when exposures are found
- Badge counter showing total sites with findings
- List of all exposed sites found, with direct links to the exposed paths
- Download the entire `.git` folder as a zip, even when directory listing is disabled
- View `.git/config` with one click
- Open-source detection — checks if the exposed `.git` points to a public GitHub/GitLab repo
- `security.txt` detection
- Site blacklist (supports wildcards)
- Debug mode
- Failed-request detection mode (catches exposures via network errors)

_Most checks are off by default — open Settings to enable what you need._

## Check Categories

### Version Control Systems
`.git`, `.svn`, `.hg` (Mercurial), `.DS_Store`, `CVS`, `.bzr` (Bazaar), `.svn/entries` (legacy)

### Secrets & Credentials
`.env` and variants (`.env.local`, `.env.production`, `.env.backup`, `.env.dev`/staging), `.npmrc`, `.dockerenv`, `docker-compose.yml`, `Dockerfile`, `wp-config.php`, `auth.json` (Composer), `firebase.json`, `terraform.tfstate`, `terraform.tfvars`, Rails secrets, Django settings, Laravel log, SSH private keys, AWS credentials, Kubernetes config, `config.json`/`config.php`, PEM private keys, Google Cloud service account credentials

### Backup & Archive Files
SQL dumps (MySQL/PostgreSQL/SQLite/MSSQL), backup archives (zip/tar/rar/7z), PHP config backups, `.htaccess` backup, `web.config` backup, CSV data exports

### Debug & Admin Panels
`phpinfo()`, PHP error log, Adminer, phpMyAdmin, Spring Boot Actuator, Symfony profiler, Laravel Telescope, Rails info, Django debug toolbar, ELMAH (.NET), Grafana/metrics endpoint, admin panels, debug directories, server log files

### Server Configuration
`.htaccess`, `.htpasswd`, `nginx.conf`, Apache `server-status`, Nginx `stub_status`, `web.config`, `crossdomain.xml`, `robots.txt` (sensitive disallow paths only)

### API & Documentation
Swagger/OpenAPI (`swagger.json`, `/api-docs`, `/v2/api-docs`, etc.), GraphQL (`/graphql`, `/graphiql`), WSDL, API config endpoints

### CMS-Specific
WordPress login page, WordPress XML-RPC, WordPress user enumeration (`/wp-json/wp/v2/users`), Joomla admin, Drupal `CHANGELOG.txt`, Magento config

### CI/CD & DevOps
`Jenkinsfile`, `.gitlab-ci.yml`, `.travis.yml`, GitHub Actions workflows, CircleCI config

### Package & Dependency Files
`package.json`, `package-lock.json`, `composer.json`, `Gemfile`, `requirements.txt`, `pom.xml` (Maven), `Cargo.toml` (Rust), `go.sum`/`go.mod`

### Information Disclosure
Directory listing, JavaScript source maps (`.js.map`), `sitemap.xml`, `.gitignore`/`.gitmodules`, README/INSTALL docs, `clientaccesspolicy.xml`

## How the .git Download Works

There is a queue for downloads, with a **maximum number of simultaneous connections**; if this number is exceeded, subsequent files are put on **wait** for X ms multiplied by the number of downloads already pending; the result of the multiplication cannot exceed the **maximum wait**.

### Notes:
- Downloading is an extra feature — it is not meant to download large repositories (extensions have RAM limits, and DotGit does everything in memory)
- The default download settings are conservative to avoid problems on slow connections; high values can freeze the browser even on powerful hardware
- The download walks well-known git paths, then recursively follows object hashes, tree objects, and pack files to reconstruct as much of the repository as possible

## Options

| Option | Default | Description |
|--------|---------|-------------|
| Color scheme | Grey | Badge and icon color |
| Max sites | 100 | Maximum entries kept in the findings list |
| Notifications | On | Alert when new exposures or downloads are found |
| Open-source check | On | Detect if `.git/config` points to a public repo |
| security.txt check | On | Detect if the site has a `security.txt` |
| Check failed requests | Off | Also trigger checks on network errors (catches some `.git` exposures) |
| Debug mode | Off | Log verbose output to the browser console |
| Blacklist | `localhost` | Comma-separated hostnames to skip (supports `*` wildcards) |
| Download: max connections | 20 | Simultaneous download threads |
| Download: wait | 100ms | Base wait time per queued download |
| Download: max wait | 10000ms | Ceiling for queued download wait |
| Download: failed in a row | 250 | Abort download after this many consecutive failures |

## Multi-Account Scraper

DotGit includes a built-in scraper for automating data collection across multiple accounts using [ui.vision RPA](https://ui.vision/).

### Features

- **Account pool** — store multiple accounts with automatic rotation; rate-limited or failed accounts are suspended automatically
- **Firefox Multi-Account Containers** — each account runs in its own isolated container tab (credentials never bleed across sessions)
- **Scheduled scraping** — configurable alarm interval triggers scrape cycles in the background
- **Offline caching** — when the backend is unreachable, scraped items are cached locally and replayed on next successful cycle
- **Popup** — shows recent launches, last-run log, and a manual trigger button

### Setup

1. Open **Settings** → configure backend URL, API key, and workflow ID
2. Go to the **Account Pool** tab → import accounts from CSV (`email,password,label`) or add individually
3. Enable the scraper toggle — cycles will run on the configured interval

### Workflow Designer

Open **Settings → Open Workflow Designer** to visually design scraping workflows.

The designer is a node-based canvas (React Flow) that lets you wire together browser actions, data extraction steps, control flow, and output nodes, then export them as **ui.vision macros**.

**Node types:** Trigger (schedule/manual) · Browser (navigate, click, fill, scroll, hover) · Wait (selector, delay, network idle) · Data (extract, extract table) · Control (condition, loop, merge) · Account (inject credentials, switch account) · Output (send to backend, save locally)

**Import/export:** Workflows can be exported to ui.vision RPA macro format and imported back — enabling round-trip editing between the visual designer and ui.vision's own recorder.

## Screenshot

![ScreenShot](https://user-images.githubusercontent.com/13476215/213874632-6f05c28e-1e90-487e-a0d9-f619b9b69e1a.png)

## Download: [Firefox](https://addons.mozilla.org/it/firefox/addon/dotgit/) | [Chrome](https://chrome.google.com/webstore/detail/dotgit/pampamgoihgcedonnphgehgondkhikel)
