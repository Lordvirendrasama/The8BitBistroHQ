import { NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase/init';
import { collection, getDocs, query, where } from 'firebase/firestore';
import type { Station, Bill, GamingPackage } from '@/lib/types';

export const dynamic = 'force-dynamic'; // Ensures this route is always evaluated dynamically

export async function GET(request: Request) {
  // Simple API key check for basic security
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  
  if (secret !== 'bistro-widget-secret') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db } = initializeFirebase();
    
    // 1. Get active stations
    const stationsSnapshot = await getDocs(collection(db, 'stations'));
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const stations = stationsSnapshot.docs
      .map(doc => doc.data() as Station)
      .filter(s => s.status === 'in-use' || s.status === 'paused')
      .filter(s => {
          if (!s.startTime) return false;
          const startTimeMs = new Date(s.startTime).getTime();
          // Filter out stale sessions older than 24 hours
          return (Date.now() - startTimeMs) < ONE_DAY_MS;
      });
      
    // 2. Get today's revenue
    // Get start of today (midnight)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfTodayIso = today.toISOString();
    
    const billsQuery = query(
        collection(db, 'bills'),
        where('timestamp', '>=', startOfTodayIso)
    );
    const billsSnapshot = await getDocs(billsQuery);
    
    let dailyRevenue = 0;
    billsSnapshot.docs.forEach(doc => {
        const bill = doc.data() as Bill;
        dailyRevenue += (bill.totalAmount || 0);
    });

    // 3. Fetch gaming packages to calculate projected revenue
    const packagesSnapshot = await getDocs(collection(db, 'gamingPackages'));
    const gamingPackages = packagesSnapshot.docs.map(doc => doc.data() as GamingPackage);

    // Calculate Projected Revenue (Daily Revenue + Active Sessions values)
    let projectedRevenue = dailyRevenue;
    stations.forEach(station => {
        // Add current orders/food/extra time
        const currentBillSum = (station.currentBill || []).reduce((s, i) => s + (i.price * i.quantity), 0);
        projectedRevenue += currentBillSum;

        // Add package price if not already itemized
        if (station.packageName && station.packageName !== 'Walk-in Order') {
            const pureName = station.packageName.replace(/^(Recharge: |Buy Recharge: )/i, '').trim().toLowerCase();
            const isItemized = (station.currentBill || []).some(item => {
                const nameLower = item.name.toLowerCase();
                return (
                    nameLower.includes(pureName) ||
                    nameLower.startsWith('time:') ||
                    nameLower.startsWith('buy recharge:') ||
                    nameLower.startsWith('recharge:')
                );
            });

            if (!isItemized) {
                const pkg = gamingPackages.find(p => p.name.toLowerCase() === pureName);
                if (pkg) {
                    const playerCount = station.members?.length || 1;
                    const capacity = pkg.playerCapacity || 1;
                    const instances = Math.ceil(playerCount / capacity);
                    if (!station.packageName.startsWith('Recharge: ')) {
                        projectedRevenue += (pkg.price * instances);
                    }
                }
            }
        }
        
        // Subtract discount
        projectedRevenue -= (station.discount || 0);
    });
    
    // Format timers for the widget
    const formatToIst = (dateStr: string | null | undefined): string | null => {
        if (!dateStr) return null;
        try {
            const date = new Date(dateStr);
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: 'Asia/Kolkata',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });
            
            const parts = formatter.formatToParts(date);
            const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
            
            // Format to Kustom native format: yyyy'y'MM'M'dd'd'HH'h'mm'm'ss's'
            return `${partMap.year}y${partMap.month}M${partMap.day}d${partMap.hour}h${partMap.minute}m${partMap.second}s`;
        } catch (e) {
            return null;
        }
    };

    const timers = stations.map(s => {
        let remainingSeconds = 0;
        let isExpired = false;

        if (s.status === 'paused' && s.remainingTimeOnPause != null) {
            remainingSeconds = s.remainingTimeOnPause;
        } else if (s.endTime) {
            remainingSeconds = Math.floor((new Date(s.endTime).getTime() - Date.now()) / 1000);
        }
        
        if (remainingSeconds < 0 && s.endTime) {
            isExpired = true;
            remainingSeconds = 0;
        }
        
        return {
            name: s.name,
            status: s.status,
            startTime: s.startTime,
            endTime: s.endTime,
            startTimeLocal: formatToIst(s.startTime),
            endTimeLocal: formatToIst(s.endTime),
            remainingSeconds,
            isExpired,
            type: s.type,
            players: s.members?.length || 0,
            packageName: s.packageName
        };
    });
    
    return NextResponse.json({
        dailyRevenue,
        projectedRevenue: Math.floor(projectedRevenue),
        activeTimers: timers,
        lastUpdatedLocal: formatToIst(new Date().toISOString()),
        timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
      console.error('Widget API Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
