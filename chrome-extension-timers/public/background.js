chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: async () => {
      if (!('documentPictureInPicture' in window)) {
        alert('Document Picture-in-Picture is not supported in this browser.');
        return;
      }
      
      // If a PiP window is already open for this document, close it.
      if (window.documentPictureInPicture.window) {
        window.documentPictureInPicture.window.close();
        return;
      }

      try {
        const pipWindow = await window.documentPictureInPicture.requestWindow({
          width: 260,
          height: 300
        });

        // Add CSS to hide scrollbars and remove margins
        const style = pipWindow.document.createElement('style');
        style.textContent = `
          body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
          iframe { border: none; width: 100%; height: 100%; }
        `;
        pipWindow.document.head.appendChild(style);

        const iframe = pipWindow.document.createElement('iframe');
        iframe.src = chrome.runtime.getURL('index.html');
        pipWindow.document.body.appendChild(iframe);
        
        // Listen for resize messages from the iframe
        pipWindow.addEventListener('message', (e) => {
          if (e.data && e.data.type === 'resizePip') {
            if (e.data.isMinimized) {
              pipWindow.resizeTo(180, 100);
            } else {
              pipWindow.resizeTo(260, 300);
            }
          }
        });
        
      } catch (err) {
        console.error('Failed to open PiP window', err);
      }
    }
  });
});
