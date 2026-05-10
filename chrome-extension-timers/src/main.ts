import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "museview-gag3p",
  appId: "1:529984145400:web:1fef8c161e5b2ca229b80d",
  apiKey: "AIzaSyCmN6MkteozF-6OCk8OJ8Pk_J42-pkGUZg",
  authDomain: "museview-gag3p.firebaseapp.com",
  storageBucket: "museview-gag3p.firebasestorage.app",
  measurementId: "",
  messagingSenderId: "529984145400"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const clockIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clock"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

interface Station {
  id: string;
  name: string;
  status: string;
  endTime?: string;
  remainingTimeOnPause?: number;
  type?: string;
  currentBill?: any[];
  members?: any[];
}

const timersContainer = document.getElementById('timers-container');
let activeStations: Station[] = [];
let intervalId: number | null = null;
let isInitialLoad = true;
const announcedState: Record<string, { endTime?: string, lowAnnounced: boolean, upAnnounced: boolean }> = {};
const expandedBills = new Set<string>();

async function handlePause(stationId: string, stationRemaining: number, currentMembers: any[]) {
  const now = new Date().toISOString();
  const updatedMembers = currentMembers.map(m => {
      if (!m.endTime || m.status === 'finished') return m;
      const remaining = new Date(m.endTime).getTime() - Date.now();
      return { 
          ...m, 
          status: 'paused',
          remainingTimeOnPause: Math.max(0, Math.floor(remaining / 1000)) 
      };
  });

  await updateDoc(doc(db, 'stations', stationId), {
      status: 'paused',
      pauseStartTime: now,
      remainingTimeOnPause: Math.max(0, Math.floor(stationRemaining / 1000)),
      members: updatedMembers
  });
}

async function handleResume(stationId: string, currentMembers: any[], stationRemainingTimeOnPause: number | null) {
  const updatedMembers = currentMembers.map(m => {
      if (m.remainingTimeOnPause == null || m.status === 'finished') return m;
      return {
          ...m,
          status: 'active',
          endTime: new Date(Date.now() + m.remainingTimeOnPause * 1000).toISOString(),
          remainingTimeOnPause: null
      };
  });
  
  const newStationEndTime = stationRemainingTimeOnPause 
    ? new Date(Date.now() + stationRemainingTimeOnPause * 1000).toISOString()
    : null;

  await updateDoc(doc(db, 'stations', stationId), {
      status: 'in-use',
      endTime: newStationEndTime,
      pauseStartTime: null,
      remainingTimeOnPause: null,
      members: updatedMembers
  });
}

if (timersContainer) {
  timersContainer.addEventListener('click', (e) => {
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
       handlePause(stationId, remaining, station.members || []);
    } else if (action === 'resume') {
       handleResume(stationId, station.members || [], station.remainingTimeOnPause || null);
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

function speak(text: string) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  }
}

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
  if (!timersContainer) return;

  if (activeStations.length === 0) {
    timersContainer.innerHTML = '<div class="no-stations">No active stations</div>';
    return;
  }

  const html = activeStations.map(station => {
    let remainingTime = 0;
    
    if (station.status === 'paused') {
      remainingTime = (station.remainingTimeOnPause || 0) * 1000;
    } else if (station.endTime) {
      const end = new Date(station.endTime).getTime();
      const now = Date.now();
      const diff = end - now;
      remainingTime = diff > 0 ? diff : 0;
    }

    const isUp = remainingTime <= 0;
    const isLow = remainingTime < 5 * 60 * 1000 && remainingTime > 0;
    
    if (announcedState[station.id]) {
      if (isUp && !announcedState[station.id].upAnnounced) {
        speak(`Time is up for ${station.name || station.id}`);
        announcedState[station.id].upAnnounced = true;
      } else if (isLow && !announcedState[station.id].lowAnnounced) {
        speak(`5 minutes remaining for ${station.name || station.id}`);
        announcedState[station.id].lowAnnounced = true;
      }
    }
    
    let statusClass = 'status-good';
    if (isUp) statusClass = 'status-up';
    else if (isLow) statusClass = 'status-low';

    const isPaused = station.status === 'paused';
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

    return `
      <div class="timer-card ${statusClass}">
        <div class="timer-main">
          <span class="station-name">${station.name || station.id}</span>
          <span class="timer-value">
            ${clockIcon}
            ${formatTime(remainingTime)}
          </span>
        </div>
        ${ps5Controls}
        ${billHtml}
      </div>
    `;
  }).join('');

  timersContainer.innerHTML = html;
}

function startTimerLoop() {
  if (intervalId) clearInterval(intervalId);
  updateTimersUI();
  intervalId = setInterval(updateTimersUI, 1000) as unknown as number;
}

function init() {
  if (timersContainer) {
    timersContainer.innerHTML = '<div class="loading">Loading timers...</div>';
  }

  const q = query(
    collection(db, 'stations'),
    where('status', 'in', ['in-use', 'paused'])
  );

  onSnapshot(q, (snapshot) => {
    const stations: Station[] = [];
    snapshot.forEach((doc) => {
      stations.push({ id: doc.id, ...doc.data() } as Station);
    });
    
    // Sort logic if needed, right now we just use them as is or filter those without end time
    activeStations = stations.filter(s => !!s.endTime || s.status === 'paused');
    
    activeStations.forEach(station => {
      if (!announcedState[station.id] || announcedState[station.id].endTime !== station.endTime) {
        let remainingTime = 0;
        if (station.status === 'paused') {
          remainingTime = (station.remainingTimeOnPause || 0) * 1000;
        } else if (station.endTime) {
          const end = new Date(station.endTime).getTime();
          const now = Date.now();
          const diff = end - now;
          remainingTime = diff > 0 ? diff : 0;
        }
        
        announcedState[station.id] = {
          endTime: station.endTime,
          lowAnnounced: isInitialLoad ? remainingTime <= 5 * 60 * 1000 : false,
          upAnnounced: isInitialLoad ? remainingTime <= 0 : false
        };
      }
    });

    isInitialLoad = false;
    
    startTimerLoop();
  }, (error) => {
    console.error("Error fetching stations:", error);
    if (timersContainer) {
      timersContainer.innerHTML = '<div class="no-stations">Error loading data. Make sure you are logged in or rules allow access.</div>';
    }
  });
}

init();


