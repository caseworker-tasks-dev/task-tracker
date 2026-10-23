export type FieldErrors = Record<string, string>;

export interface ErrorSummaryItem {
  text: string;
  href: string;
}

interface FieldConfig {
  id: string;
  label: string;
  messages: [RegExp, string][];
}

const FIELDS: Record<string, FieldConfig> = {
  title: {
    id: 'title',
    label: 'Title',
    messages: [
      [/blank|null/, 'Enter a title'],
      [/size/, 'Title must be 255 characters or fewer'],
    ],
  },
  description: {
    id: 'description',
    label: 'Description',
    messages: [[/size/, 'Description must be 4000 characters or fewer']],
  },
  status: {
    id: 'status',
    label: 'Status',
    messages: [[/null|one of/, 'Select a status']],
  },
  dueDate: {
    id: 'dueDate-day',
    label: 'Due date',
    messages: [
      [/null/, 'Enter the due date'],
      [/future/, 'Due date and time must be in the future'],
      [/date-time/, 'Due date must be a real date'],
    ],
  },
  dueTime: {
    id: 'dueTime',
    label: 'Due time',
    messages: [],
  },
};

const FIELD_ORDER = Object.keys(FIELDS);

/**
 * Rewrites the API's validation messages (e.g. "must not be blank") as GOV.UK-style messages.
 * Unknown fields and messages are kept, prefixed with the field name, so nothing is silently dropped.
 */
export function toFieldErrors(apiErrors: Record<string, string>): FieldErrors {
  return Object.fromEntries(
    Object.entries(apiErrors).map(([field, message]) => {
      const config = FIELDS[field];
      const friendly = config?.messages.find(([pattern]) => pattern.test(message))?.[1];
      return [field, friendly ?? `${config?.label ?? field} ${message}`];
    })
  );
}

export function toErrorSummary(errors: FieldErrors): ErrorSummaryItem[] {
  const rank = (field: string) => (FIELD_ORDER.includes(field) ? FIELD_ORDER.indexOf(field) : FIELD_ORDER.length);
  return Object.keys(errors)
    .sort((a, b) => rank(a) - rank(b))
    .map(field => ({ text: errors[field], href: `#${FIELDS[field]?.id ?? field}` }));
}
