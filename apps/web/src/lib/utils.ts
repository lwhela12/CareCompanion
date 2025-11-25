import { format, parse } from 'date-fns';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatLocalDate(date: Date = new Date()) {
  return format(date, 'yyyy-MM-dd');
}

export function formatLocalDateTime(date: Date = new Date()) {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export function toLocalISOString(date: Date) {
  return format(date, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

export function dateInputToLocalISOString(dateString: string | undefined | null) {
  if (!dateString) return undefined;
  const parsed = parse(dateString, 'yyyy-MM-dd', new Date());
  return toLocalISOString(parsed);
}

export function startEndOfLocalDay(date: Date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  return {
    start: toLocalISOString(start),
    end: toLocalISOString(end),
  };
}

export function localDayBounds(date: Date = new Date()) {
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const endDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  return {
    startDate,
    endDate,
    startISO: toLocalISOString(startDate),
    endISO: toLocalISOString(endDate),
  };
}
