import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns the "Business Date" (YYYY-MM-DD) in local time.
 * If before 5:00 AM, it returns the previous calendar day.
 * 
 * @param date The date to evaluate
 * @param ignoreOffset If true, returns the date part without the 5 AM rollover logic (used for calendar selections)
 */
export function getBusinessDate(date: Date = new Date(), ignoreOffset: boolean = false): string {
  const d = new Date(date);
  
  if (!ignoreOffset && d.getHours() < 5) {
    d.setDate(d.getDate() - 1);
  }
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Checks if a given date string or object belongs to the current Business Day.
 */
export function isBusinessToday(date: Date | string): boolean {
  const target = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(target.getTime())) return false;
  
  const todayBusinessDate = getBusinessDate(new Date());
  const targetBusinessDate = getBusinessDate(target);
  
  return todayBusinessDate === targetBusinessDate;
}

/**
 * Formats any date string or Date object into DD/MM/YYYY format.
 */
export function formatDateDDMMYYYY(date: Date | string): string {
  if (!date) return '';
  if (typeof date === 'string' && date.includes('-')) {
    const parts = date.split('T')[0].split('-');
    if (parts.length === 3) {
      // YYYY-MM-DD -> DD/MM/YYYY
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return String(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}
