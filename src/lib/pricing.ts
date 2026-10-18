import type { Station, GamingPackage } from './types';

export type StationType = 'ps5' | 'ps4' | 'boardgame' | 'retrogaming';

/**
 * Checks if a given date/time falls within Happy Hours (8:00 AM to 1:00 PM).
 */
export function isHappyHour(date: Date = new Date()): boolean {
  const hours = date.getHours();
  return hours >= 8 && hours < 13;
}

export interface RateDetail {
  hourlySolo: number;
  hourlyMulti: number;
  halfHourSolo: number;
  halfHourMulti: number;
  isHappyHour: boolean;
}

/**
 * Get applicable rate breakdown based on station type and time of day.
 */
export function getRateDetails(stationType: StationType, date: Date = new Date()): RateDetail {
  const happy = isHappyHour(date);

  switch (stationType) {
    case 'ps5':
      return {
        hourlySolo: happy ? 80 : 150,
        hourlyMulti: happy ? 60 : 120,
        halfHourSolo: happy ? 80 : 80,
        halfHourMulti: happy ? 60 : 60,
        isHappyHour: happy,
      };

    case 'ps4':
      return {
        hourlySolo: happy ? 60 : 100,
        hourlyMulti: happy ? 50 : 70,
        halfHourSolo: happy ? 60 : 60,
        halfHourMulti: happy ? 50 : 50,
        isHappyHour: happy,
      };

    case 'boardgame':
      return {
        hourlySolo: happy ? 30 : 50,
        hourlyMulti: happy ? 30 : 50,
        halfHourSolo: happy ? 30 : 30,
        halfHourMulti: happy ? 30 : 30,
        isHappyHour: happy,
      };

    case 'retrogaming':
      return {
        hourlySolo: happy ? 30 : 50,
        hourlyMulti: happy ? 30 : 50,
        halfHourSolo: happy ? 30 : 30,
        halfHourMulti: happy ? 30 : 30,
        isHappyHour: happy,
      };

    default:
      return {
        hourlySolo: happy ? 80 : 150,
        hourlyMulti: happy ? 60 : 120,
        halfHourSolo: happy ? 80 : 80,
        halfHourMulti: happy ? 60 : 60,
        isHappyHour: happy,
      };
  }
}

/**
 * Calculates per-player walk-in charge for a session duration.
 * Charges follow 30-minute block cycles within each hour:
 * - 1st 30 mins of an hour: 30-min rate (halfHourSolo/Multi)
 * - 2nd 30 mins of an hour: completes the full hour rate (hourlySolo/Multi)
 */
export function calculatePlayerPrice(
  stationType: StationType,
  playerCount: number,
  durationMinutes: number,
  date: Date = new Date()
): number {
  if (durationMinutes <= 0) return 0;
  const rates = getRateDetails(stationType, date);
  const isMulti = playerCount > 1;

  const halfHourRate = isMulti ? rates.halfHourMulti : rates.halfHourSolo;
  const hourlyRate = isMulti ? rates.hourlyMulti : rates.hourlySolo;

  const fullHours = Math.floor(durationMinutes / 60);
  const remainingMins = durationMinutes % 60;

  let basePrice = fullHours * hourlyRate;

  if (remainingMins > 0) {
    if (remainingMins <= 30) {
      basePrice += halfHourRate;
    } else {
      basePrice += hourlyRate;
    }
  }

  return Math.round(basePrice);
}

/**
 * Calculates total session group charge (per-player price * playerCount).
 */
export function calculateGroupPrice(
  stationType: StationType,
  playerCount: number,
  durationMinutes: number,
  date: Date = new Date()
): number {
  const count = Math.max(1, playerCount);
  const perPlayerPrice = calculatePlayerPrice(stationType, count, durationMinutes, date);
  return perPlayerPrice * count;
}

/**
 * Calculates incremental cost when extending an existing session.
 * For example: extending from 30m to 60m on PS5 solo charges 150 - 80 = ₹70, instead of full 30m rate ₹80.
 */
export function calculateExtensionPrice(
  stationType: StationType,
  playerCount: number,
  currentMinutes: number,
  additionalMinutes: number,
  date: Date = new Date()
): number {
  if (additionalMinutes <= 0) return 0;
  const count = Math.max(1, playerCount);
  const currentTotalCost = currentMinutes > 0 
    ? calculateGroupPrice(stationType, count, currentMinutes, date) 
    : 0;
  const newTotalCost = calculateGroupPrice(stationType, count, currentMinutes + additionalMinutes, date);
  return Math.max(0, newTotalCost - currentTotalCost);
}


/**
 * Generates quick play packages dynamically based on station type and current time (Happy Hour vs Normal Rate).
 */
export function generateDynamicQuickPlayPackages(
  stationType: StationType,
  playerCount: number = 1,
  date: Date = new Date()
): GamingPackage[] {
  const rates = getRateDetails(stationType, date);
  const count = Math.max(1, playerCount);
  const isMulti = count > 1;
  const happyTag = rates.isHappyHour ? ' (Happy Hour)' : '';

  const halfHourPerPlayer = isMulti ? rates.halfHourMulti : rates.halfHourSolo;
  const oneHourPerPlayer = isMulti ? rates.hourlyMulti : rates.hourlySolo;

  const stationLabels: Record<StationType, string> = {
    ps5: 'PS5',
    ps4: 'PS4',
    retrogaming: 'RETRO PASS',
    boardgame: 'BOARD GAME',
  };
  const label = stationLabels[stationType] || stationType.toUpperCase();

  return [
    {
      id: `qp-30m-${stationType}-${rates.isHappyHour ? 'hh' : 'norm'}`,
      name: `${label} 30 MIN SESSION${happyTag}`,
      duration: 1800,
      price: halfHourPerPlayer,
      validity: 1,
      isPriorityOffer: false,
    },
    {
      id: `qp-1h-${stationType}-${rates.isHappyHour ? 'hh' : 'norm'}`,
      name: `${label} 1 HOUR SESSION${happyTag}`,
      duration: 3600,
      price: oneHourPerPlayer,
      validity: 1,
      isPriorityOffer: true,
    },
    {
      id: `qp-2h-${stationType}-${rates.isHappyHour ? 'hh' : 'norm'}`,
      name: `${label} 2 HOUR SESSION${happyTag}`,
      duration: 7200,
      price: oneHourPerPlayer * 2,
      validity: 1,
      isPriorityOffer: false,
    },
  ];
}

/**
 * Returns the loyalty Bits multiplier based on member tier.
 * Red: 1x, Green: 1.5x, Gold: 2x
 */
export function getTierMultiplier(tier?: string): number {
  if (!tier) return 1;
  const normalized = tier.trim().toLowerCase();
  if (normalized === 'gold') return 2;
  if (normalized === 'green') return 1.5;
  return 1;
}

export interface FilterRechargePackagesOptions {
  packages: GamingPackage[];
  stationType?: StationType | string;
  playerCount: number;
  date?: Date;
  currentTime?: string; // "HH:mm"
}

/**
 * Filters and sorts recharge packages for station session setup:
 * 1. Matches station type (PS5, PS4, board games, retro).
 * 2. Matches player capacity:
 *    - 1 player: Shows only Solo session rates + multi-hour bulk passes (hides Duo rates).
 *    - 2 players: Shows Duo session rates + multi-hour bulk passes (hides Solo rates).
 * 3. Enforces time and day availability windows (e.g. hides Happy Hour rates when outside active hours).
 * 4. Sorts standard session rates first (30m, 1h ascending), followed by bulk multi-hour passes.
 */
export function filterAndSortRechargePackages({
  packages,
  stationType,
  playerCount = 1,
  date = new Date(),
  currentTime,
}: FilterRechargePackagesOptions): GamingPackage[] {
  if (!packages || packages.length === 0) return [];

  const count = Math.max(1, playerCount);
  const now = date;
  const currentDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getDay()];
  const currentHHMM = currentTime || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const happy = isHappyHour(now);

  // 1. Base filter: Must be a recharge pack
  let list = packages.filter(p => p.isRechargePack);

  // 2. Station Type Filter
  if (stationType) {
    const sType = stationType.toLowerCase();
    list = list.filter(p => {
      const nameUpper = (p.name || '').toUpperCase();
      if (sType === 'ps5') {
        if (p.stationType === 'ps4' || nameUpper.includes('PS4') || p.isBoardGamePass || p.isRetroGamePass || p.stationType === 'boardgame' || p.stationType === 'retrogaming' || nameUpper.includes('BOARD') || nameUpper.includes('RETRO')) return false;
        return true;
      }
      if (sType === 'ps4') {
        if (p.stationType === 'ps5' || nameUpper.includes('PS5') || p.isBoardGamePass || p.isRetroGamePass || p.stationType === 'boardgame' || p.stationType === 'retrogaming' || nameUpper.includes('BOARD') || nameUpper.includes('RETRO')) return false;
        return p.stationType === 'ps4' || nameUpper.includes('PS4');
      }
      if (sType === 'boardgame') {
        return p.stationType === 'boardgame' || p.isBoardGamePass || nameUpper.includes('BOARD');
      }
      if (sType === 'retrogaming') {
        return p.stationType === 'retrogaming' || p.isRetroGamePass || nameUpper.includes('RETRO');
      }
      return true;
    });
  }

  // 3. Time Window and Availability Days Filter
  list = list.filter(p => {
    const nameUpper = (p.name || '').toUpperCase();

    // Check availableDays
    if (p.availableDays && p.availableDays.length > 0) {
      if (!p.availableDays.includes(currentDay)) {
        return false;
      }
    }

    // Check explicit startTime and endTime
    if (p.startTime && p.endTime) {
      if (p.startTime <= p.endTime) {
        if (currentHHMM < p.startTime || currentHHMM > p.endTime) return false;
      } else {
        // Overnight window
        if (currentHHMM < p.startTime && currentHHMM > p.endTime) return false;
      }
    } else if (p.startTime) {
      if (currentHHMM < p.startTime) return false;
    } else if (p.endTime) {
      if (currentHHMM > p.endTime) return false;
    }

    // Fallback for Happy Hour packages without explicit times
    if (!p.startTime && !p.endTime && nameUpper.includes('HAPPY HOUR')) {
      if (!happy) return false;
    }

    return true;
  });

  // 4. Player Count / Capacity Filtering
  list = list.filter(p => {
    const nameUpper = (p.name || '').toUpperCase();
    const isDuo = p.playerCapacity === 2 || nameUpper.includes('DUO') || nameUpper.includes('2 PLAYER') || nameUpper.includes('2P') || nameUpper.includes('TWO PLAYER');
    const isSolo = (p.playerCapacity === 1 || nameUpper.includes('SOLO') || nameUpper.includes('1 PLAYER') || nameUpper.includes('1P') || nameUpper.includes('SINGLE')) && !isDuo;
    
    // Bulk passes (duration >= 4 hours / 14400s or validity > 1 day) are accessible for wallet recharge regardless of session size unless explicitly marked duo
    const isBulk = p.duration >= 14400 || (p.validity && p.validity > 1);

    if (count === 1) {
      // 1 Player: Exclude Duo packages
      if (isDuo) return false;
      return true;
    }

    if (count === 2) {
      // 2 Players: Exclude Solo session packages (keep bulk passes and Duo packages)
      if (isSolo && !isBulk) return false;
      if (p.playerCapacity === 1 && !isBulk) return false;
      return true;
    }

    // For 3+ players: Exclude Solo and Duo session packages
    if (count > 2) {
      if ((isSolo || isDuo) && !isBulk) return false;
      if ((p.playerCapacity === 1 || p.playerCapacity === 2) && !isBulk) return false;
      return true;
    }

    return true;
  });

  // 5. Sorting: Standard session packs first (by duration asc), then bulk recharge passes (by duration asc)
  return list.sort((a, b) => {
    const aIsBulk = a.duration >= 14400 || (a.validity && a.validity > 1);
    const bIsBulk = b.duration >= 14400 || (b.validity && b.validity > 1);

    if (aIsBulk !== bIsBulk) {
      return aIsBulk ? 1 : -1; // non-bulk (session) first, bulk last
    }

    // Within same group: priority offer first if any
    if (a.isPriorityOffer && !b.isPriorityOffer) return -1;
    if (!a.isPriorityOffer && b.isPriorityOffer) return 1;

    // Otherwise by duration ascending (30m -> 1h -> 2h etc.)
    if (a.duration !== b.duration) {
      return a.duration - b.duration;
    }

    return a.price - b.price;
  });
}

