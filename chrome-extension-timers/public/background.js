chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['assets/index.js']
    });
  } catch (err) {
    console.error('Failed to execute script:', err);
  }
});


