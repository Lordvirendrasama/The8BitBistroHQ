import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extracts year, month, day, hours, minutes in Asia/Kolkata timezone.
 */
export function getKolkataDateParts(date: Date | string | number = new Date()): {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  let d: Date;
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    const [y, m, dayNum] = date.trim().split('-').map(Number);
    // Treat YYYY-MM-DD as noon in IST (06:30 UTC) to prevent midnight shift
    d = new Date(Date.UTC(y, m - 1, dayNum, 6, 30, 0));
  } else {
    d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  }

  if (isNaN(d.getTime())) {
    d = new Date();
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  const map: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = parseInt(part.value, 10);
    }
  }

  return {
    year: map.year ?? 2026,
    month: map.month ?? 1, // 1-12
    day: map.day ?? 1, // 1-31
    hours: (map.hour === 24 || map.hour === undefined) ? 0 : map.hour, // 0-23
    minutes: map.minute ?? 0,
    seconds: map.second ?? 0,
  };
}

/**
 * Returns the "Business Date" (YYYY-MM-DD) in configured timezone Asia/Kolkata.
 * If before 5:00 AM IST, it counts towards the previous calendar business day.
 * 
 * @param date The date to evaluate
 * @param ignoreOffset If true, returns the date part without the 5 AM rollover logic (used for calendar selections)
 */
export function getBusinessDate(date: Date | string | number = new Date(), ignoreOffset: boolean = false): string {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    return date.trim();
  }

  const parts = getKolkataDateParts(date);
  let { year, month, day, hours } = parts;

  // 5:00 AM Rollover in Asia/Kolkata
  if (!ignoreOffset && hours < 5) {
    const tempDate = new Date(Date.UTC(year, month - 1, day - 1));
    year = tempDate.getUTCFullYear();
    month = tempDate.getUTCMonth() + 1;
    day = tempDate.getUTCDate();
  }

  const yearStr = String(year);
  const monthStr = String(month).padStart(2, '0');
  const dayStr = String(day).padStart(2, '0');

  return `${yearStr}-${monthStr}-${dayStr}`;
}

/**
 * Checks if a given date string or object belongs to the current Business Day in Asia/Kolkata.
 */
export function isBusinessToday(date: Date | string): boolean {
  if (!date) return false;
  const todayBusinessDate = getBusinessDate(new Date());
  const targetBusinessDate = getBusinessDate(date);
  return todayBusinessDate === targetBusinessDate;
}

/**
 * Formats any date string or Date object into DD/MM/YYYY format in Asia/Kolkata.
 */
export function formatDateDDMMYYYY(date: Date | string): string {
  if (!date) return '';
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    const parts = date.trim().split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  const parts = getKolkataDateParts(date);
  const day = String(parts.day).padStart(2, '0');
  const month = String(parts.month).padStart(2, '0');
  const year = parts.year;
  return `${day}/${month}/${year}`;
}

