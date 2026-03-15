const API_BASE_KEY = "gshApiBase";
const TOKEN_KEY = "gshToken";
const PROFILE_KEY = "latestLinkedInProfile";

const apiBaseInput = document.getElementById("apiBase");
const tokenInput = document.getElementById("token");
const generateBtn = document.getElementById("generateBtn");
const profileHint = document.getElementById("profileHint");
const resultsEl = document.getElementById("results");
const errorEl = document.getElementById("error");

function renderHooks(data, profile) {
  resultsEl.innerHTML = "";
  const hooks = data.structured_hooks || [];
  profileHint.textContent = profile?.name ? `${profile.name} • ${profile.company || "Unknown company"}` : "LinkedIn profile detected";

  hooks.forEach((h) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="meta">${h.angle} • ${h.quality_label || "Score"} ${h.quality_score || "-"}</div>
      <div>${h.hook}</div>
      <button class="copy">Copy hook</button>
    `;
    card.querySelector(".copy").addEventListener("click", async () => {
      await navigator.clipboard.writeText(h.hook);
      card.querySelector(".copy").textContent = "Copied";
      setTimeout(() => { card.querySelector(".copy").textContent = "Copy hook"; }, 1000);
    });
    resultsEl.appendChild(card);
  });
}

async function init() {
  const stored = await chrome.storage.local.get([API_BASE_KEY, TOKEN_KEY, PROFILE_KEY]);
  apiBaseInput.value = stored[API_BASE_KEY] || "http://localhost:3000";
  tokenInput.value = stored[TOKEN_KEY] || "";
  if (stored[PROFILE_KEY]?.name) {
    profileHint.textContent = `${stored[PROFILE_KEY].name} • ${stored[PROFILE_KEY].company || "Unknown company"}`;
  }
}

async function saveSettings() {
  await chrome.storage.local.set({
    [API_BASE_KEY]: apiBaseInput.value.trim() || "http://localhost:3000",
    [TOKEN_KEY]: tokenInput.value.trim(),
  });
}

generateBtn.addEventListener("click", async () => {
  errorEl.textContent = "";
  await saveSettings();
  generateBtn.disabled = true;
  generateBtn.textContent = "Generating...";

  chrome.runtime.sendMessage({ type: "GENERATE_HOOKS" }, (resp) => {
    generateBtn.disabled = false;
    generateBtn.textContent = "Generate Hooks";

    if (!resp?.ok) {
      errorEl.textContent = resp?.error || "Failed to generate hooks";
      return;
    }

    renderHooks(resp.data, resp.profile);
  });
});

init();
