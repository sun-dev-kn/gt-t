// scraper/uivision.js
const TIMEOUT_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 1500;

export async function runMacroInContainer(cookieStoreId, macroName = "dotgit-websitelaunches") {
  const tab = await browser.tabs.create({
    url: "https://websitelaunches.com",
    cookieStoreId,
    active: false,
  });

  try {
    await waitForTabLoad(tab.id);
    await injectTrigger(tab.id, macroName);
    return await pollForResult(tab.id);
  } finally {
    await browser.tabs.remove(tab.id).catch(() => {});
  }
}

async function waitForTabLoad(tabId) {
  // Check if already complete before attaching listener (avoids race on fast loads)
  const current = await browser.tabs.get(tabId);
  if (current.status === "complete") return;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      browser.tabs.onUpdated.removeListener(listener);
      reject(new Error("Tab load timeout"));
    }, 30000);

    function listener(updatedTabId, info) {
      if (updatedTabId === tabId && info.status === "complete") {
        clearTimeout(timeout);
        browser.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }

    browser.tabs.onUpdated.addListener(listener);
  });
}

async function injectTrigger(tabId, macroName) {
  await browser.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: (macro) => {
      localStorage.removeItem("DotGitScrapedData");
      localStorage.removeItem("XrunnerOutput");
      localStorage.setItem(
        "XrunnerInput",
        JSON.stringify({ cmd: "run", macro, closeRPA: false })
      );
    },
    args: [macroName],
  });
}

async function pollForResult(tabId) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + TIMEOUT_MS;

    function onTabRemoved(removedTabId) {
      if (removedTabId === tabId) {
        clearInterval(interval);
        browser.tabs.onRemoved.removeListener(onTabRemoved);
        reject(new Error("Scraper tab was closed before macro completed"));
      }
    }
    browser.tabs.onRemoved.addListener(onTabRemoved);

    const interval = setInterval(async () => {
      if (Date.now() > deadline) {
        clearInterval(interval);
        browser.tabs.onRemoved.removeListener(onTabRemoved);
        reject(new Error("ui.vision macro timed out after 5 minutes"));
        return;
      }

      try {
        const [frame] = await browser.scripting.executeScript({
          target: { tabId },
          world: "MAIN",
          func: () => ({
            output: localStorage.getItem("XrunnerOutput"),
            data: localStorage.getItem("DotGitScrapedData"),
          }),
        });

        const result = frame?.result;
        if (result?.output) {
          clearInterval(interval);
          browser.tabs.onRemoved.removeListener(onTabRemoved);
          try {
            const parsed = JSON.parse(result.output);
            if (parsed.status === "error") {
              reject(new Error(parsed.msg || "Macro reported error"));
            } else {
              resolve(result.data ? JSON.parse(result.data) : []);
            }
          } catch (e) {
            reject(new Error("Failed to parse macro result: " + e.message));
          }
        }
      } catch {
        // tab navigated mid-poll, keep waiting
      }
    }, POLL_INTERVAL_MS);
  });
}
