import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, onSnapshot } from 'firebase/firestore';

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
}

const timersContainer = document.getElementById('timers-container');
let activeStations: Station[] = [];
let intervalId: number | null = null;

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
    
    let statusClass = 'status-good';
    if (isUp) statusClass = 'status-up';
    else if (isLow) statusClass = 'status-low';

    return `
      <div class="timer-card ${statusClass}">
        <span class="station-name">${station.name || station.id}</span>
        <span class="timer-value">
          ${clockIcon}
          ${formatTime(remainingTime)}
        </span>
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
    
    startTimerLoop();
  }, (error) => {
    console.error("Error fetching stations:", error);
    if (timersContainer) {
      timersContainer.innerHTML = '<div class="no-stations">Error loading data. Make sure you are logged in or rules allow access.</div>';
    }
  });
}

init();

// Notify parent frame of height changes for PIP window resizing
const resizeObserver = new ResizeObserver(() => {
  const height = document.body.scrollHeight;
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'resize', height }, '*');
  }
});
resizeObserver.observe(document.body);
