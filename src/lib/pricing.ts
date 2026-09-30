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
        halfHourSolo: 80,
        halfHourMulti: 60,
        isHappyHour: happy,
      };

    case 'ps4':
      return {
        hourlySolo: happy ? 60 : 100,
        hourlyMulti: happy ? 50 : 70,
        halfHourSolo: 60,
        halfHourMulti: 50,
        isHappyHour: happy,
      };

    case 'boardgame':
      return {
        hourlySolo: happy ? 20 : 50,
        hourlyMulti: happy ? 20 : 50,
        halfHourSolo: 30,
        halfHourMulti: 30,
        isHappyHour: happy,
      };

    case 'retrogaming':
      return {
        hourlySolo: happy ? 20 : 50,
        hourlyMulti: happy ? 20 : 50,
        halfHourSolo: 30,
        halfHourMulti: 30,
        isHappyHour: happy,
      };

    default:
      return {
        hourlySolo: happy ? 80 : 150,
        hourlyMulti: happy ? 60 : 120,
        halfHourSolo: 80,
        halfHourMulti: 60,
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
 * Generates quick play packages dynamically based on station type and current time (Happy Hour vs Normal Rate).
 */
export function generateDynamicQuickPlayPackages(
  stationType: StationType,
  playerCount: number = 1,
  date: Date = new Date()
): GamingPackage[] {
  const rates = getRateDetails(stationType, date);
  const isMulti = playerCount > 1;
  const happyTag = rates.isHappyHour ? ' (Happy Hour)' : '';

  const halfHourPrice = isMulti ? rates.halfHourMulti : rates.halfHourSolo;
  const oneHourPrice = isMulti ? rates.hourlyMulti : rates.hourlySolo;
  const twoHourPrice = oneHourPrice * 2;

  const typeLabel =
    stationType === 'ps5'
      ? 'PS5'
      : stationType === 'ps4'
      ? 'PS4'
      : stationType === 'boardgame'
      ? 'Board Games'
      : 'Retro Gaming';

  return [
    {
      id: `qp-30m-${stationType}-${rates.isHappyHour ? 'hh' : 'norm'}`,
      name: `30 Min Session${happyTag}`,
      duration: 1800,
      price: halfHourPrice,
      validity: 1,
      isPriorityOffer: false,
    },
    {
      id: `qp-1h-${stationType}-${rates.isHappyHour ? 'hh' : 'norm'}`,
      name: `1 Hour Session${happyTag}`,
      duration: 3600,
      price: oneHourPrice,
      validity: 1,
      isPriorityOffer: true,
    },
    {
      id: `qp-2h-${stationType}-${rates.isHappyHour ? 'hh' : 'norm'}`,
      name: `2 Hour Session${happyTag}`,
      duration: 7200,
      price: twoHourPrice,
      validity: 1,
      isPriorityOffer: false,
    },
  ];
}
