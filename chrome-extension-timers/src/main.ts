import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, updateDoc, type Unsubscribe } from 'firebase/firestore';

declare const chrome: any;

const firebaseConfig = {
  projectId: "museview-gag3p",
  appId: "1:529984145400:web:1fef8c161e5b2ca229b80d",
  apiKey: "AIzaSyCmN6MkteozF-6OCk8OJ8Pk_J42-pkGUZg",
  authDomain: "museview-gag3p.firebaseapp.com",
  storageBucket: "museview-gag3p.firebasestorage.app",
  messagingSenderId: "529984145400"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

declare global {
  interface Window {
    __tebbPipWindow?: Window | null;
    __tebbUnsubscribe?: Unsubscribe | null;
  }
}

async function togglePip() {
  if (!('documentPictureInPicture' in window)) {
    alert('Document Picture-in-Picture is not supported in this browser.');
    return;
  }

  // Toggle off if already open
  if (window.__tebbPipWindow && !window.__tebbPipWindow.closed) {
    window.__tebbPipWindow.close();
    window.__tebbPipWindow = null;
    return;
  }
  if ((window as any).documentPictureInPicture.window) {
    (window as any).documentPictureInPicture.window.close();
    window.__tebbPipWindow = null;
    return;
  }

  try {
    const pipWindow = await (window as any).documentPictureInPicture.requestWindow({
      width: 260,
      height: 340
    });
    window.__tebbPipWindow = pipWindow;

    // Load extension CSS into PiP window
    const cssUrl = chrome.runtime.getURL('assets/index.css');
    const cssText = await fetch(cssUrl).then((r: any) => r.text()).catch(() => '');
    
    const style = pipWindow.document.createElement('style');
    style.textContent = `
      body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow-x: hidden; overflow-y: auto; background: #1a1a1a; color: #fff; font-family: system-ui, -apple-system, sans-serif; }
      ${cssText}
    `;
    pipWindow.document.head.appendChild(style);

    // Set DOM structure inside PiP window
    pipWindow.document.body.innerHTML = `
      <div id="app">
        <button id="minimize-btn" title="Toggle Minimize">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
        </button>
        <div class="header">
          <h1>Active Stations</h1>
        </div>
        <div id="timers-container">
          <div class="loading">Loading timers...</div>
        </div>
      </div>
    `;

    const timersContainer = pipWindow.document.getElementById('timers-container');
    const minimizeBtn = pipWindow.document.getElementById('minimize-btn');

    let activeStations: any[] = [];
    let intervalId: number | null = null;
    const expandedBills = new Set<string>();

    const clockIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clock"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

    function formatTime(ms: number) {
      if (ms < 0) ms = 0;
      const totalSeconds = Math.floor(ms / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    function updateTimersUI() {
      if (!timersContainer || pipWindow.closed) return;

      if (activeStations.length === 0) {
        timersContainer.innerHTML = '<div class="no-stations">No active stations</div>';
        return;
      }

      const now = Date.now();
      const html = activeStations.map(station => {
        const isPaused = (station.status || '').toLowerCase() === 'paused' || station.remainingTimeOnPause != null || (station.members || []).some((m: any) => m.status === 'paused');

        let remainingTime = 0;
        if (isPaused) {
          let pauseSecs = station.remainingTimeOnPause;
          if (pauseSecs == null && station.members && station.members.length > 0) {
            const memberPauses = station.members
              .filter((m: any) => m.remainingTimeOnPause != null)
              .map((m: any) => m.remainingTimeOnPause);
            if (memberPauses.length > 0) {
              pauseSecs = Math.max(...memberPauses);
            }
          }
          remainingTime = (pauseSecs || 0) * 1000;
        } else {
          const memberEndTimes = (station.members || [])
            .filter((m: any) => m.status !== 'finished' && m.endTime)
            .map((m: any) => new Date(m.endTime).getTime());
          
          if (memberEndTimes.length > 0) {
            const latestEnd = Math.max(...memberEndTimes);
            const diff = latestEnd - now;
            remainingTime = diff > 0 ? diff : 0;
          } else if (station.endTime) {
            const diff = new Date(station.endTime).getTime() - now;
            remainingTime = diff > 0 ? diff : 0;
          }
        }

        const isUp = !isPaused && remainingTime <= 0;
        const isLow = !isPaused && remainingTime < 5 * 60 * 1000 && remainingTime > 0;

        let statusClass = 'status-good';
        if (isPaused) statusClass = 'status-paused';
        else if (isUp) statusClass = 'status-up';
        else if (isLow) statusClass = 'status-low';

        const isPS5 = station.name?.toLowerCase().includes('ps5') || station.type === 'ps5';
        
        const pauseBtnHtml = isPaused 
          ? `<button data-action="resume" data-station="${station.id}" class="action-btn btn-resume">Resume</button>`
          : `<button data-action="pause" data-station="${station.id}" class="action-btn btn-pause">Pause</button>`;
        
        const ps5Controls = isPS5 ? `
          <div class="controls">
            ${pauseBtnHtml}
            <button data-action="add-time" data-station="${station.id}" class="action-btn btn-time">+ Time</button>
            <button data-action="stop" data-station="${station.id}" class="action-btn btn-stop">Stop</button>
          </div>
        ` : '';
        
        let billHtml = '';
        const hasBill = station.currentBill && station.currentBill.length > 0;
        
        if (hasBill) {
          if (expandedBills.has(station.id)) {
            const billItemsHtml = (station.currentBill || []).map((item: any) => `
              <div class="bill-item">
                <span>${item.name} (x${item.quantity})</span>
                <span>₹${item.price * item.quantity}</span>
              </div>
            `).join('');
            billHtml = `
              <div class="bill-container">
                <div class="bill-header">Current Bill <button data-action="show-bill" data-station="${station.id}">Hide</button></div>
                ${billItemsHtml}
              </div>
            `;
          } else {
            billHtml = `<button data-action="show-bill" data-station="${station.id}" class="show-bill-btn">Bill</button>`;
          }
        }

        const pauseLabel = isPaused ? `<span style="font-size: 10px; margin-left: 4px; opacity: 0.85;">(PAUSED)</span>` : '';

        return `
          <div class="timer-card ${statusClass}">
            <div class="timer-main">
              <span class="station-name">${station.name || station.id}</span>
              <span class="timer-value">
                ${clockIcon}
                ${formatTime(remainingTime)} ${pauseLabel}
              </span>
            </div>
            ${ps5Controls}
            ${billHtml}
          </div>
        `;
      }).join('');

      timersContainer.innerHTML = html;
    }

    if (timersContainer) {
      timersContainer.addEventListener('click', async (e: Event) => {
        const target = e.target as HTMLElement;
        const btn = target.closest('button');
        if (!btn) return;
        
        const action = btn.dataset.action;
        const stationId = btn.dataset.station;
        if (!action || !stationId) return;

        const station = activeStations.find(s => s.id === stationId);
        if (!station) return;

        if (action === 'pause') {
          const remaining = station.endTime ? new Date(station.endTime).getTime() - Date.now() : 0;
          const currentMembers = station.members || [];
          const updatedMembers = currentMembers.map((m: any) => {
            if (!m.endTime || m.status === 'finished') return m;
            const remainingM = new Date(m.endTime).getTime() - Date.now();
            return {
              ...m,
              status: 'paused',
              remainingTimeOnPause: Math.max(0, Math.floor(remainingM / 1000))
            };
          });
          await updateDoc(doc(db, 'stations', stationId), {
            status: 'paused',
            pauseStartTime: new Date().toISOString(),
            remainingTimeOnPause: Math.max(0, Math.floor(remaining / 1000)),
            members: updatedMembers
          });
        } else if (action === 'resume') {
          const currentMembers = station.members || [];
          const updatedMembers = currentMembers.map((m: any) => {
            if (m.remainingTimeOnPause == null || m.status === 'finished') return m;
            return {
              ...m,
              status: 'active',
              endTime: new Date(Date.now() + m.remainingTimeOnPause * 1000).toISOString(),
              remainingTimeOnPause: null
            };
          });
          const newStationEndTime = station.remainingTimeOnPause 
            ? new Date(Date.now() + station.remainingTimeOnPause * 1000).toISOString()
            : null;
          await updateDoc(doc(db, 'stations', stationId), {
            status: 'in-use',
            endTime: newStationEndTime,
            pauseStartTime: null,
            remainingTimeOnPause: null,
            members: updatedMembers
          });
        } else if (action === 'add-time') {
          window.open(`https://the8bitbistrohq.vercel.app/dashboard?addTimeId=${stationId}`, '_blank');
        } else if (action === 'stop') {
          window.open(`https://the8bitbistrohq.vercel.app/dashboard?checkoutId=${stationId}`, '_blank');
        } else if (action === 'show-bill') {
          if (expandedBills.has(stationId)) expandedBills.delete(stationId);
          else expandedBills.add(stationId);
          updateTimersUI();
        }
      });
    }

    // Handle minimize button
    let isMinimized = false;
    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', () => {
        isMinimized = !isMinimized;
        pipWindow.document.body.classList.toggle('minimized', isMinimized);
        if (isMinimized) {
          pipWindow.resizeTo(180, 100);
          minimizeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>`;
          minimizeBtn.title = "Maximize";
        } else {
          pipWindow.resizeTo(260, 340);
          minimizeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
          minimizeBtn.title = "Minimize";
        }
      });
    }

    // Subscribe to Firestore collection
    const q = collection(db, 'stations');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const stations: any[] = [];
      snapshot.forEach((doc) => {
        stations.push({ id: doc.id, ...doc.data() });
      });

      activeStations = stations.filter(s => {
        const st = (s.status || '').toLowerCase();
        return st === 'in-use' || st === 'paused' || st === 'finishing';
      });

      updateTimersUI();
      if (!intervalId) {
        intervalId = setInterval(updateTimersUI, 1000) as unknown as number;
      }
    }, (error) => {
      console.error("Error fetching stations:", error);
      if (timersContainer) {
        timersContainer.innerHTML = `<div class="no-stations">Error loading data: ${error?.message || 'Access denied'}</div>`;
      }
    });

    window.__tebbUnsubscribe = unsubscribe;

    // Clean up when PiP window closes
    pipWindow.addEventListener('pagehide', () => {
      if (intervalId) clearInterval(intervalId);
      if (unsubscribe) unsubscribe();
      window.__tebbPipWindow = null;
    });

  } catch (err) {
    console.error('Failed to open PiP window:', err);
  }
}

togglePip();



