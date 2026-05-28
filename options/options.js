// List of all function toggle IDs (must match CHECK_REGISTRY ids in content_script.js)
const FUNCTION_IDS = [
    // VCS
    "git", "svn", "hg", "env", "ds_store", "cvs", "bzr", "svn_entries",
    // Secrets
    "env_local", "env_production", "env_backup", "env_dev",
    "npmrc", "dockerenv", "docker_compose", "dockerfile",
    "wp_config", "composer_auth", "firebase",
    "terraform_state", "terraform_vars",
    "rails_secrets", "django_settings", "laravel_log",
    "ssh_keys", "aws_credentials", "kube_config",
    // Backup
    "sql_dump", "backup_archive", "php_backup", "htaccess_backup", "web_config_backup",
    // Debug
    "phpinfo", "php_errors", "adminer", "phpmyadmin",
    "spring_actuator", "symfony_profiler", "laravel_telescope",
    "rails_info", "django_debug", "elmah", "grafana",
    // Server
    "htaccess", "htpasswd", "nginx_conf", "server_status", "nginx_status",
    "web_config", "crossdomain", "robots_txt",
    // API
    "swagger", "graphql", "wsdl",
    // CMS
    "wp_login", "wp_xmlrpc", "wp_user_enum", "joomla", "drupal", "magento",
    // CI/CD
    "jenkinsfile", "gitlab_ci", "travis_ci", "github_actions", "circleci",
    // Packages
    "package_json", "package_lock", "composer_json", "gemfile",
    "requirements_txt", "pom_xml", "cargo_toml", "go_sum",
    // Info Disclosure
    "dir_listing", "source_maps", "sitemap",
    // Additional (from guide)
    "app_settings", "config_json", "config_php", "pem_keys", "google_cloud",
    "gitignore", "admin_panel", "debug_dirs", "log_files",
    "api_config", "client_access_policy",
    "readme_docs", "csv_export"
];

function set_gui(options) {
    let colors = document.getElementById("color");
    for (let i = 0; i < colors.length; i++) {
        if (colors.options[i].value === options.color) {
            document.getElementById("color").selectedIndex = i;
        }
    }

    // Set function toggles dynamically
    for (const id of FUNCTION_IDS) {
        const onEl = document.getElementById(id + "On");
        const offEl = document.getElementById(id + "Off");
        if (onEl && offEl) {
            onEl.checked = options.functions[id];
            offEl.checked = !options.functions[id];
        }
    }

    document.getElementById("debugOn").checked = options.debug;
    document.getElementById("debugOff").checked = !options.debug;
    document.getElementById("checkFailedOn").checked = options.check_failed;
    document.getElementById("checkFailedOff").checked = !options.check_failed;
    document.getElementById("max_sites").value = options.max_sites;
    document.getElementById("max_connections").value = options.download.max_connections;
    document.getElementById("failed_in_a_row").value = options.download.failed_in_a_row;
    document.getElementById("wait").value = options.download.wait;
    document.getElementById("max_wait").value = options.download.max_wait;
    document.getElementById("on1").checked = options.notification.new_git;
    document.getElementById("off1").checked = !options.notification.new_git;
    document.getElementById("on2").checked = options.notification.download;
    document.getElementById("off2").checked = !options.notification.download;
    document.getElementById("on3").checked = options.check_opensource;
    document.getElementById("off3").checked = !options.check_opensource;
    document.getElementById("on4").checked = options.check_securitytxt;
    document.getElementById("off4").checked = !options.check_securitytxt;
    document.getElementById("blacklist").value = options.blacklist.join(", ");
}

document.addEventListener("DOMContentLoaded", function () {
    chrome.storage.local.get(["options"], function (result) {
        set_gui(result.options);

        document.addEventListener("change", (e) => {
            // Handle function toggles dynamically
            if (FUNCTION_IDS.includes(e.target.name)) {
                result.options.functions[e.target.name] = (e.target.value === "on");
                chrome.storage.local.set(result);
                chrome.runtime.sendMessage({
                    type: "function_toggle",
                    id: e.target.name,
                    value: result.options.functions[e.target.name]
                }, function (response) {
                });
            } else if (e.target.id === "color") {
                result.options.color = e.target.value;
                chrome.storage.local.set(result);
            } else if (e.target.validity.valid === true && (e.target.id === "max_sites")) {
                result.options.max_sites = e.target.value;
                chrome.storage.local.set(result);
            } else if (e.target.name === "notification_new_git") {
                result.options.notification.new_git = (e.target.value === "on");
                chrome.storage.local.set(result);
                chrome.runtime.sendMessage({
                    type: e.target.name,
                    value: result.options.notification.new_git
                }, function (response) {
                });
            } else if (e.target.name === "notification_download") {
                result.options.notification.download = (e.target.value === "on");
                chrome.storage.local.set(result);
                chrome.runtime.sendMessage({
                    type: e.target.name,
                    value: result.options.notification.download
                }, function (response) {
                });
            } else if (e.target.name === "check_opensource") {
                result.options.check_opensource = (e.target.value === "on");
                chrome.storage.local.set(result);
                chrome.runtime.sendMessage({
                    type: e.target.name,
                    value: result.options.check_opensource
                }, function (response) {
                });
            } else if (e.target.name === "check_securitytxt") {
                result.options.check_securitytxt = (e.target.value === "on");
                chrome.storage.local.set(result);
                chrome.runtime.sendMessage({
                    type: e.target.name,
                    value: result.options.check_securitytxt
                }, function (response) {
                });
            } else if (e.target.name === "debug") {
                result.options.debug = (e.target.value === "on");
                chrome.storage.local.set(result);
                chrome.runtime.sendMessage({
                    type: e.target.name,
                    value: result.options.debug
                }, function (response) {
                });
            } else if (e.target.name === "check_failed") {
                result.options.check_failed = (e.target.value === "on");
                chrome.storage.local.set(result);
                chrome.runtime.sendMessage({
                    type: e.target.name,
                    value: result.options.check_failed
                }, function (response) {
                });
            } else if (e.target.validity.valid === true && (e.target.id === "max_connections" || e.target.id === "wait" || e.target.id === "max_wait" || e.target.id === "failed_in_a_row")) {
                result.options.download[e.target.id] = e.target.value;
                chrome.storage.local.set(result);
                chrome.runtime.sendMessage({
                    type: e.target.id,
                    value: e.target.value
                }, function (response) {
                });
            } else if (e.target.id === "blacklist") {
                result.options.blacklist = e.target.value.replace(/\s/g, "").split(",").filter(function (el) {
                    return el !== "";
                });
                chrome.storage.local.set(result);
                chrome.runtime.sendMessage({
                    type: e.target.id,
                    value: result.options.blacklist
                }, function (response) {
                });
            }
        });

        document.addEventListener("click", (e) => {
            if (e.target.id === "reset_default") {
                chrome.runtime.sendMessage({
                    type: "reset_options"
                }, function (response) {
                    set_gui(response.options);
                });
            }
        });

    });
});

// ---- SCRAPER OPTIONS ----
import { importAccounts, loadAccounts, deleteAccount, clearAllAccounts, parseCSV, parseJSON } from "/scraper/accounts.js";
import { setMasterPassword, hasMasterPassword } from "/scraper/crypto.js";
import { saveScraperSettings, getScraperSettings } from "/scraper/orchestrate.js";
import { getLog, clearLog } from "/scraper/log.js";

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function renderAccountTable() {
  const accounts = await loadAccounts();
  const tbody = document.getElementById("account-tbody");
  if (!tbody) return;
  tbody.innerHTML = accounts.map((a) => `
    <tr>
      <td>${escapeHtml(a.email)}</td>
      <td>${escapeHtml(a.status)}${a.suspendedUntil ? " until " + escapeHtml(new Date(a.suspendedUntil).toLocaleString()) : ""}</td>
      <td>${a.lastUsed ? escapeHtml(new Date(a.lastUsed).toLocaleString()) : "—"}</td>
      <td><button data-delete="${escapeHtml(a.id)}">Delete</button></td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await deleteAccount(btn.dataset.delete);
      await renderAccountTable();
    });
  });
}

async function renderLog() {
  const log = await getLog();
  const tbody = document.getElementById("log-tbody");
  if (!tbody) return;
  tbody.innerHTML = log.map((e) => `
    <tr>
      <td>${escapeHtml(new Date(e.timestamp).toLocaleString())}</td>
      <td>${escapeHtml(e.accountEmail ?? "—")}</td>
      <td>${escapeHtml(String(e.itemsInserted ?? 0))}</td>
      <td>${escapeHtml(String(e.itemsSkipped ?? 0))}</td>
      <td>${escapeHtml(String(e.cached ?? 0))}</td>
      <td>${escapeHtml(e.error ?? "—")}</td>
    </tr>
  `).join("");
}

async function initScraperSection() {
  const settings = await getScraperSettings();
  const backendUrlEl = document.getElementById("backend-url");
  const workflowIdEl = document.getElementById("workflow-id");
  const enabledEl = document.getElementById("scraper-enabled");
  const statusEl = document.getElementById("master-password-status");

  if (backendUrlEl) backendUrlEl.value = settings.backendUrl;
  const apiKeyEl = document.getElementById("api-key");
  if (apiKeyEl) apiKeyEl.value = settings.apiKey ?? "";
  if (workflowIdEl) workflowIdEl.value = settings.workflowId;
  if (enabledEl) enabledEl.checked = settings.enabled;

  if (hasMasterPassword() && statusEl) {
    statusEl.textContent = "✅ Unlocked";
  }

  document.getElementById("set-master-password")?.addEventListener("click", async () => {
    const pw = document.getElementById("master-password")?.value;
    if (!pw) return;
    await setMasterPassword(pw);
    if (statusEl) statusEl.textContent = "✅ Unlocked";
    const pwEl = document.getElementById("master-password");
    if (pwEl) pwEl.value = "";
  });

  document.getElementById("save-scraper-settings")?.addEventListener("click", async () => {
    await saveScraperSettings({
      backendUrl: document.getElementById("backend-url")?.value ?? "",
      apiKey: document.getElementById("api-key")?.value ?? "",
      workflowId: document.getElementById("workflow-id")?.value ?? "",
      enabled: document.getElementById("scraper-enabled")?.checked ?? false,
    });
    const saveStatus = document.getElementById("settings-save-status");
    if (saveStatus) {
      saveStatus.textContent = "✅ Saved";
      setTimeout(() => { saveStatus.textContent = ""; }, 2000);
    }
  });

  document.getElementById("import-accounts")?.addEventListener("click", async () => {
    const fileEl = document.getElementById("account-file");
    const file = fileEl?.files?.[0];
    if (!file) return;
    const importStatus = document.getElementById("import-status");
    if (!hasMasterPassword()) {
      if (importStatus) importStatus.textContent = "❌ Unlock master password first";
      return;
    }
    try {
      const text = await file.text();
      const records = file.name.endsWith(".json") ? parseJSON(text) : parseCSV(text);
      if (!Array.isArray(records)) throw new Error("JSON file must be an array of account objects");
      const count = await importAccounts(records);
      if (importStatus) importStatus.textContent = `✅ Imported ${count} accounts`;
    } catch (err) {
      if (importStatus) importStatus.textContent = `❌ Import failed: ${err.message}`;
    }
    await renderAccountTable();
  });

  document.getElementById("clear-accounts")?.addEventListener("click", async () => {
    if (!confirm("Delete all accounts? This cannot be undone.")) return;
    await clearAllAccounts();
    await renderAccountTable();
  });

  document.getElementById("clear-log")?.addEventListener("click", async () => {
    await clearLog();
    await renderLog();
  });

  await renderAccountTable();
  await renderLog();
}

initScraperSection().catch((err) => {
  console.error("[DotGit] Scraper init failed:", err);
  const statusEl = document.getElementById("master-password-status");
  if (statusEl) statusEl.textContent = "❌ Failed to load scraper settings";
});

// ---- WORKFLOW DESIGNER ----
document.getElementById("open-workflow-designer")?.addEventListener("click", () => {
  browser.tabs.create({ url: browser.runtime.getURL("workflow/dist/workflow.html") });
});
