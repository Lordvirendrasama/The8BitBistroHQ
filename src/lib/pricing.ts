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
 */
export function calculatePlayerPrice(
  stationType: StationType,
  playerCount: number,
  durationMinutes: number,
  date: Date = new Date()
): number {
  const rates = getRateDetails(stationType, date);
  const isMulti = playerCount > 1;

  if (durationMinutes <= 30) {
    return isMulti ? rates.halfHourMulti : rates.halfHourSolo;
  }

  const hours = durationMinutes / 60;
  const ratePerHour = isMulti ? rates.hourlyMulti : rates.hourlySolo;
  return Math.round(hours * ratePerHour);
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

