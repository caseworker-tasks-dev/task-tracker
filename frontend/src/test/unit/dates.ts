import { DueDateInput, formatDateTime, isOverdue, parseDueDate } from '../../main/utils/dates';

const input = (overrides: Partial<DueDateInput> = {}): DueDateInput => ({
  day: '15',
  month: '1',
  year: '2030',
  time: '09:30',
  ...overrides,
});

describe('parseDueDate', () => {
  test('uses +00:00 for a date in GMT', () => {
    expect(parseDueDate(input())).toEqual({ ok: true, iso: '2030-01-15T09:30:00+00:00' });
  });

  test('uses +01:00 for a date in BST', () => {
    expect(parseDueDate(input({ day: '1', month: '7' }))).toEqual({ ok: true, iso: '2030-07-01T09:30:00+01:00' });
  });

  test('switches offset on the day the clocks go forward', () => {
    expect(parseDueDate(input({ day: '31', month: '3', time: '00:30' }))).toEqual({
      ok: true,
      iso: '2030-03-31T00:30:00+00:00',
    });
    expect(parseDueDate(input({ day: '31', month: '3', time: '02:30' }))).toEqual({
      ok: true,
      iso: '2030-03-31T02:30:00+01:00',
    });
  });

  test('rejects a time skipped when the clocks go forward', () => {
    const result = parseDueDate(input({ day: '31', month: '3', time: '01:30' }));

    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.dueTime).toMatch(/clocks go forward/);
  });

  test('accepts the repeated hour when the clocks go back', () => {
    expect(parseDueDate(input({ day: '27', month: '10', time: '01:30' }))).toEqual({
      ok: true,
      iso: '2030-10-27T01:30:00+00:00',
    });
  });

  test('accepts single-digit hours and pads the output', () => {
    expect(parseDueDate(input({ day: '5', month: '3', time: '9:05' }))).toEqual({
      ok: true,
      iso: '2030-03-05T09:05:00+00:00',
    });
  });

  test.each([
    ['31 February', { day: '31', month: '2' }],
    ['29 February in a non-leap year', { day: '29', month: '2', year: '2031' }],
    ['month 13', { month: '13' }],
    ['day 0', { day: '0' }],
    ['letters in the day', { day: 'ab' }],
  ])('rejects %s as not a real date', (_name, overrides) => {
    expect(parseDueDate(input(overrides))).toEqual({
      ok: false,
      errors: { dueDate: 'Due date must be a real date' },
      invalidParts: ['day', 'month', 'year'],
    });
  });

  test('accepts 29 February in a leap year', () => {
    expect(parseDueDate(input({ day: '29', month: '2', year: '2032' })).ok).toBe(true);
  });

  test('asks for the whole date when every part is empty', () => {
    expect(parseDueDate(input({ day: '', month: ' ', year: '' }))).toEqual({
      ok: false,
      errors: { dueDate: 'Enter the due date' },
      invalidParts: ['day', 'month', 'year'],
    });
  });

  test('names only the missing parts', () => {
    expect(parseDueDate(input({ month: '' }))).toMatchObject({
      errors: { dueDate: 'Due date must include a month' },
      invalidParts: ['month'],
    });
    expect(parseDueDate(input({ day: '', year: '' }))).toMatchObject({
      errors: { dueDate: 'Due date must include a day and year' },
      invalidParts: ['day', 'year'],
    });
  });

  test('requires a 4-digit year', () => {
    expect(parseDueDate(input({ year: '30' }))).toMatchObject({
      errors: { dueDate: 'Year must include 4 numbers' },
      invalidParts: ['year'],
    });
  });

  test.each([
    ['', 'Enter the due time'],
    ['25:00', 'Enter the due time in 24-hour format, like 14:30'],
    ['930', 'Enter the due time in 24-hour format, like 14:30'],
    ['9.30am', 'Enter the due time in 24-hour format, like 14:30'],
  ])('rejects time %p', (time, message) => {
    expect(parseDueDate(input({ time }))).toEqual({ ok: false, errors: { dueTime: message }, invalidParts: [] });
  });

  test('reports date and time errors together', () => {
    expect(parseDueDate(input({ day: '31', month: '2', time: '' }))).toMatchObject({
      errors: { dueDate: 'Due date must be a real date', dueTime: 'Enter the due time' },
    });
  });
});

describe('formatDateTime', () => {
  test('shows UK local time in winter', () => {
    expect(formatDateTime('2030-01-15T09:30:00Z')).toBe('15 January 2030 at 09:30');
  });

  test('shows UK local time in summer', () => {
    expect(formatDateTime('2030-07-01T08:30:00Z')).toBe('1 July 2030 at 09:30');
  });
});

describe('isOverdue', () => {
  const now = new Date('2030-06-01T12:00:00Z');

  test('is true for a past due date', () => {
    expect(isOverdue('2030-06-01T11:59:00Z', now)).toBe(true);
  });

  test('is false for a future due date', () => {
    expect(isOverdue('2030-06-01T12:01:00Z', now)).toBe(false);
  });
});
