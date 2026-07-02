chrome.runtime.onInstalled.addListener(() => {
  void chrome.action.setTitle({ title: 'Squint — Cleanse my eyes' });
});
