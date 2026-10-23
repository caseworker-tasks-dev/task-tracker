const TIME_ZONE = 'Europe/London';

const displayFormat = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, dateStyle: 'long', timeStyle: 'short' });

const partsFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
  timeZoneName: 'longOffset',
});

export type DatePart = 'day' | 'month' | 'year';

export interface DueDateInput {
  day: string;
  month: string;
  year: string;
  time: string;
}

export interface DueDateErrors {
  dueDate?: string;
  dueTime?: string;
}

export type DueDateResult = { ok: true; iso: string } | { ok: false; errors: DueDateErrors; invalidParts: DatePart[] };

interface LondonParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  offsetMinutes: number;
}

function londonParts(instant: number): LondonParts {
  const parts = Object.fromEntries(partsFormat.formatToParts(new Date(instant)).map(p => [p.type, p.value]));
  const offset = /GMT([+-])(\d{2}):(\d{2})/.exec(parts.timeZoneName);
  const offsetMinutes = offset ? (offset[1] === '-' ? -1 : 1) * (Number(offset[2]) * 60 + Number(offset[3])) : 0;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    offsetMinutes,
  };
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? '-' : '+';
  const absolute = Math.abs(offsetMinutes);
  return `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

function listParts(parts: DatePart[]): string {
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

function validateDate(input: DueDateInput): { error: string; invalidParts: DatePart[] } | undefined {
  const values: Record<DatePart, string> = {
    day: input.day.trim(),
    month: input.month.trim(),
    year: input.year.trim(),
  };
  const missing = (Object.keys(values) as DatePart[]).filter(part => values[part] === '');

  if (missing.length === 3) {
    return { error: 'Enter the due date', invalidParts: missing };
  }
  if (missing.length > 0) {
    return { error: `Due date must include a ${listParts(missing)}`, invalidParts: missing };
  }
  if (!/^\d{4}$/.test(values.year)) {
    return { error: 'Year must include 4 numbers', invalidParts: ['year'] };
  }

  const day = Number(values.day);
  const month = Number(values.month);
  const year = Number(values.year);
  const isRealDate =
    /^\d{1,2}$/.test(values.day) &&
    /^\d{1,2}$/.test(values.month) &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= new Date(Date.UTC(year, month, 0)).getUTCDate();

  return isRealDate ? undefined : { error: 'Due date must be a real date', invalidParts: ['day', 'month', 'year'] };
}

/**
 * Turns the due date and time fields into an ISO 8601 date-time with the UK offset
 * that applies on that date (+00:00 in GMT, +01:00 in BST).
 */
export function parseDueDate(input: DueDateInput): DueDateResult {
  const errors: DueDateErrors = {};
  let invalidParts: DatePart[] = [];

  const dateError = validateDate(input);
  if (dateError) {
    errors.dueDate = dateError.error;
    invalidParts = dateError.invalidParts;
  }

  const time = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(input.time.trim());
  if (input.time.trim() === '') {
    errors.dueTime = 'Enter the due time';
  } else if (!time) {
    errors.dueTime = 'Enter the due time in 24-hour format, like 14:30';
  }

  if (errors.dueDate || errors.dueTime || !time) {
    return { ok: false, errors, invalidParts };
  }

  const year = Number(input.year);
  const month = Number(input.month);
  const day = Number(input.day);
  const hour = Number(time[1]);
  const minute = Number(time[2]);

  const wallClock = Date.UTC(year, month - 1, day, hour, minute);
  const guess = wallClock - londonParts(wallClock).offsetMinutes * 60_000;
  const offsetMinutes = londonParts(guess).offsetMinutes;
  const actual = londonParts(wallClock - offsetMinutes * 60_000);

  if (actual.hour !== hour || actual.minute !== minute || actual.day !== day) {
    return {
      ok: false,
      errors: { dueTime: 'That time does not exist on this date because the clocks go forward' },
      invalidParts: [],
    };
  }

  return {
    ok: true,
    iso: `${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00${formatOffset(offsetMinutes)}`,
  };
}

export function formatDateTime(iso: string): string {
  return displayFormat.format(new Date(iso));
}

export function isOverdue(iso: string, now: Date = new Date()): boolean {
  return new Date(iso).getTime() < now.getTime();
}
