import { toErrorSummary, toFieldErrors } from '../../main/utils/errors';

describe('toFieldErrors', () => {
  test('rewrites the API messages as GOV.UK messages', () => {
    expect(
      toFieldErrors({
        title: 'must not be blank',
        description: 'size must be between 0 and 4000',
        status: 'must be one of [TODO, IN_PROGRESS, DONE]',
        dueDate: 'must be a date in the present or in the future',
      })
    ).toEqual({
      title: 'Enter a title',
      description: 'Description must be 4000 characters or fewer',
      status: 'Select a status',
      dueDate: 'Due date and time must be in the future',
    });
  });

  test('maps a missing due date and an over-long title', () => {
    expect(toFieldErrors({ dueDate: 'must not be null', title: 'size must be between 0 and 255' })).toEqual({
      dueDate: 'Enter the due date',
      title: 'Title must be 255 characters or fewer',
    });
  });

  test('keeps unknown messages, prefixed with the field name', () => {
    expect(toFieldErrors({ title: 'is rude', priority: 'is wrong' })).toEqual({
      title: 'Title is rude',
      priority: 'priority is wrong',
    });
  });
});

describe('toErrorSummary', () => {
  test('orders errors like the form and links each to its field', () => {
    expect(
      toErrorSummary({ dueTime: 'Enter the due time', dueDate: 'Enter the due date', title: 'Enter a title' })
    ).toEqual([
      { text: 'Enter a title', href: '#title' },
      { text: 'Enter the due date', href: '#dueDate-day' },
      { text: 'Enter the due time', href: '#dueTime' },
    ]);
  });

  test('puts unknown fields last and links them by name', () => {
    expect(toErrorSummary({ priority: 'Bad', status: 'Select a status' })).toEqual([
      { text: 'Select a status', href: '#status' },
      { text: 'Bad', href: '#priority' },
    ]);
  });

  test('returns an empty list when there are no errors', () => {
    expect(toErrorSummary({})).toEqual([]);
  });
});
