import { TaskStatus } from '../services/taskApi';

export const STATUSES: { value: TaskStatus; text: string; tagClass: string }[] = [
  { value: 'TODO', text: 'To do', tagClass: 'govuk-tag--grey' },
  { value: 'IN_PROGRESS', text: 'In progress', tagClass: 'govuk-tag--blue' },
  { value: 'DONE', text: 'Done', tagClass: 'govuk-tag--green' },
];

export function isTaskStatus(value: unknown): value is TaskStatus {
  return STATUSES.some(status => status.value === value);
}

export function statusTag(status: TaskStatus): { text: string; classes: string } {
  const match = STATUSES.find(s => s.value === status) ?? STATUSES[0];
  return { text: match.text, classes: match.tagClass };
}
