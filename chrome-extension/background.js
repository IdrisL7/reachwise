const API_BASE_KEY = "gshApiBase";
const TOKEN_KEY = "gshToken";
const PROFILE_KEY = "latestLinkedInProfile";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "LINKEDIN_PROFILE_DETECTED") {
    chrome.storage.local.set({ [PROFILE_KEY]: message.payload });
    sendResponse({ ok: true });
  }

  if (message?.type === "GENERATE_HOOKS") {
    (async () => {
      try {
        const storage = await chrome.storage.local.get([API_BASE_KEY, TOKEN_KEY, PROFILE_KEY]);
        const base = storage[API_BASE_KEY] || "http://localhost:3000";
        const token = storage[TOKEN_KEY];
        const profile = storage[PROFILE_KEY];

        if (!profile?.companyUrl && !profile?.company) {
          throw new Error("No LinkedIn company data found on this tab");
        }

        const res = await fetch(`${base}/api/generate-hooks`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            url: profile.companyUrl || undefined,
            companyName: profile.company || undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to generate hooks");
        sendResponse({ ok: true, data, profile });
      } catch (error) {
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true;
  }
});
