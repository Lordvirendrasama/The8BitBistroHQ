(function() {
  let container = document.getElementById('tebb-timers-pip-container');

  if (container) {
    // Toggle off
    container.remove();
  } else {
    // Toggle on
    container = document.createElement('div');
    container.id = 'tebb-timers-pip-container';
    
    Object.assign(container.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: '260px',
      height: '300px', // Initial height, will be auto-resized
      border: '1px solid #333',
      borderRadius: '8px',
      boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
      zIndex: '2147483647',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      resize: 'both',
      backgroundColor: '#1a1a1a',
      fontFamily: 'sans-serif'
    });

    const header = document.createElement('div');
    Object.assign(header.style, {
      height: '28px',
      background: '#222',
      cursor: 'move',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 10px',
      color: '#888',
      fontSize: '11px',
      fontWeight: 'bold',
      userSelect: 'none',
      borderBottom: '1px solid #333',
      letterSpacing: '0.5px',
      textTransform: 'uppercase'
    });
    
    const title = document.createElement('span');
    title.textContent = 'TEBB Timers';
    
    const closeBtn = document.createElement('span');
    closeBtn.textContent = '✕';
    Object.assign(closeBtn.style, {
      cursor: 'pointer',
      fontSize: '14px',
      padding: '0 4px'
    });
    closeBtn.onclick = () => container.remove();

    header.appendChild(title);
    header.appendChild(closeBtn);

    const iframe = document.createElement('iframe');
    // Using chrome.runtime.getURL to get the extension's index.html
    iframe.src = chrome.runtime.getURL('index.html');
    Object.assign(iframe.style, {
      width: '100%',
      flex: '1',
      border: 'none',
      backgroundColor: 'transparent'
    });

    container.appendChild(header);
    container.appendChild(iframe);
    document.body.appendChild(container);

    // Dragging Logic
    let isDragging = false;
    let offsetX, offsetY;

    header.addEventListener('mousedown', (e) => {
      // Don't drag if clicking close button
      if (e.target === closeBtn) return;
      
      isDragging = true;
      const rect = container.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      iframe.style.pointerEvents = 'none'; // Prevent iframe from capturing mouse
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      container.style.left = (e.clientX - offsetX) + 'px';
      container.style.top = (e.clientY - offsetY) + 'px';
      container.style.bottom = 'auto';
      container.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        iframe.style.pointerEvents = 'auto';
      }
    });


  }
})();
