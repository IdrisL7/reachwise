(() => {
  const isProfile = /\/in\//.test(window.location.pathname);
  if (!isProfile) return;

  const text = (sel) => document.querySelector(sel)?.textContent?.trim() || "";
  const name = text("h1");
  const title = text(".text-body-medium.break-words");
  const companyEl = Array.from(document.querySelectorAll("a[href*='/company/']"))[0];
  const company = companyEl?.textContent?.trim() || "";
  const companyUrl = companyEl?.href || "";

  chrome.runtime.sendMessage({
    type: "LINKEDIN_PROFILE_DETECTED",
    payload: {
      profileUrl: window.location.href,
      name,
      title,
      company,
      companyUrl,
    },
  });
})();
