import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns the "Business Date" (YYYY-MM-DD) in local time.
 * If before 5:00 AM, it returns the previous calendar day.
 */
export function getBusinessDate(date: Date = new Date()): string {
  const d = new Date(date);
  // Business day starts at 5:00 AM local time
  if (d.getHours() < 5) {
    d.setDate(d.getDate() - 1);
  }
  
  // Format as YYYY-MM-DD using local time components
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
