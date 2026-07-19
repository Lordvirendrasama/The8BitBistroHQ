let clientServerOffset = 0;
let isSynced = false;

export async function syncTime() {
  try {
    const start = Date.now();
    const res = await fetch(`/api/server-time?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    const end = Date.now();
    
    // Estimate one-way network latency
    const latency = (end - start) / 2;
    
    // Calculate the difference between server time (adjusted for latency) and client clock
    clientServerOffset = (data.serverTime + latency) - end;
    isSynced = true;
    
    console.log(`[TimeSync] Synchronized client-server clock. Offset: ${clientServerOffset}ms, Latency: ${latency}ms`);
  } catch (err) {
    console.error('[TimeSync] Failed to sync time:', err);
  }
}

export function getSyncedNow(): number {
  return Date.now() + clientServerOffset;
}

export function getSyncedDate(): Date {
  return new Date(getSyncedNow());
}
