import { app } from '../../main/app';
import * as taskApi from '../../main/services/taskApi';

import { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import request from 'supertest';

jest.mock('../../main/services/taskApi', () => ({
  ...jest.requireActual('../../main/services/taskApi'),
  listTasks: jest.fn(),
  getTask: jest.fn(),
  createTask: jest.fn(),
  updateTaskStatus: jest.fn(),
  deleteTask: jest.fn(),
}));

const api = jest.mocked(taskApi);

const task = (overrides: Partial<taskApi.Task> = {}): taskApi.Task => ({
  id: 7,
  title: 'Review case',
  description: 'Check the bundle',
  status: 'TODO',
  dueDate: '2099-07-01T08:30:00Z',
  version: 0,
  createdAt: '2026-10-23T09:00:00Z',
  updatedAt: '2026-10-23T09:00:00Z',
  ...overrides,
});

function apiError(status?: number, data: unknown = {}): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  if (status === undefined) {
    return new AxiosError('connect ECONNREFUSED 127.0.0.1:4000', 'ECONNREFUSED', config);
  }
  return new AxiosError(
    `Request failed with status code ${status}`,
    'ERR_BAD_REQUEST',
    config,
    {},
    {
      status,
      statusText: '',
      headers: {},
      config,
      data,
    }
  );
}

async function csrf(path: string): Promise<{ cookies: string[]; token: string }> {
  const res = await request(app).get(path);
  const token = /name="_csrf" value="([^"]+)"/.exec(res.text)?.[1];
  if (!token) {
    throw new Error(`No CSRF token on ${path}`);
  }
  const setCookie = res.headers['set-cookie'] as unknown as string[];
  return { cookies: setCookie.map(cookie => cookie.split(';')[0]), token };
}

async function postForm(
  formPath: string,
  action: string,
  fields: Record<string, string>,
  expectedStatus: number
): Promise<request.Response> {
  const { cookies, token } = await csrf(formPath);
  return request(app)
    .post(action)
    .set('Cookie', cookies)
    .type('form')
    .send({ ...fields, _csrf: token })
    .expect(expectedStatus);
}

const validTask = {
  title: 'Review case',
  description: 'Check the bundle',
  'dueDate-day': '1',
  'dueDate-month': '7',
  'dueDate-year': '2099',
  dueTime: '09:30',
};

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

describe('GET /tasks', () => {
  test('lists tasks with a link, status tag and UK due date', async () => {
    api.listTasks.mockResolvedValue([task(), task({ id: 8, title: 'File bundle', status: 'DONE' })]);

    const res = await request(app).get('/tasks').expect(200);

    expect(res.text).toContain('<a class="govuk-link" href="/tasks/7">Review case</a>');
    expect(res.text).toContain('govuk-tag--grey');
    expect(res.text).toContain('govuk-tag--green');
    expect(res.text).toContain('1 July 2099 at 09:30');
    expect(res.text).toContain('href="/tasks/new"');
  });

  test('tags tasks that are past their due date as overdue, unless done', async () => {
    api.listTasks.mockResolvedValue([
      task({ dueDate: '2020-01-01T09:00:00Z' }),
      task({ id: 8, dueDate: '2020-01-01T09:00:00Z', status: 'DONE' }),
    ]);

    const res = await request(app).get('/tasks').expect(200);

    expect(res.text.match(/>\s*Overdue\s*</g)).toHaveLength(1);
  });

  test('shows an empty state when there are no tasks', async () => {
    api.listTasks.mockResolvedValue([]);

    const res = await request(app).get('/tasks').expect(200);

    expect(res.text).toContain('You have no tasks.');
    expect(res.text).not.toContain('govuk-table');
  });

  test('shows the service problem page when the backend is down', async () => {
    api.listTasks.mockRejectedValue(apiError());

    const res = await request(app).get('/tasks').expect(500);

    expect(res.text).toContain('Sorry, there is a problem with the service');
  });
});

describe('POST /tasks', () => {
  test('creates the task with a UK-offset due date and redirects to it', async () => {
    api.createTask.mockResolvedValue(task());

    const res = await postForm('/tasks/new', '/tasks', { ...validTask, status: 'IN_PROGRESS' }, 303);

    expect(res.headers.location).toBe('/tasks/7');

    expect(api.createTask).toHaveBeenCalledWith({
      title: 'Review case',
      description: 'Check the bundle',
      status: 'IN_PROGRESS',
      dueDate: '2099-07-01T09:30:00+01:00',
    });
  });

  test('re-renders the form with API errors, the error summary and the typed values', async () => {
    api.createTask.mockRejectedValue(
      apiError(400, {
        errors: { title: 'must not be blank', dueDate: 'must be a date in the present or in the future' },
      })
    );

    const res = await postForm('/tasks/new', '/tasks', { ...validTask, title: ' ', description: 'Kept' }, 400);

    expect(res.text).toContain('<title>Error: Create a task');
    expect(res.text).toContain('govuk-error-summary');
    expect(res.text).toContain('<a href="#title">Enter a title</a>');
    expect(res.text).toContain('<a href="#dueDate-day">Due date and time must be in the future</a>');
    expect(res.text).toMatch(/id="title-error"[\s\S]*Enter a title/);
    expect(res.text).toContain('>Kept</textarea>');
    expect(res.text).toContain('value="2099"');
  });

  test('explains which part of the date is wrong instead of the API message', async () => {
    api.createTask.mockRejectedValue(apiError(400, { errors: { dueDate: 'must not be null' } }));

    const res = await postForm(
      '/tasks/new',
      '/tasks',
      { ...validTask, 'dueDate-day': '31', 'dueDate-month': '2' },
      400
    );

    expect(api.createTask).toHaveBeenCalledWith(expect.objectContaining({ dueDate: undefined }));
    expect(res.text).toContain('Due date must be a real date');
    expect(res.text).not.toContain('Enter the due date');
  });

  test('rejects a form without a CSRF token', async () => {
    await request(app).post('/tasks').type('form').send(validTask).expect(403);

    expect(api.createTask).not.toHaveBeenCalled();
  });
});

describe('GET /tasks/:id', () => {
  test('shows the task details', async () => {
    api.getTask.mockResolvedValue(task());

    const res = await request(app).get('/tasks/7').expect(200);

    expect(res.text).toContain('Check the bundle');
    expect(res.text).toContain('href="/tasks/7/status"');
    expect(res.text).toContain('href="/tasks/7/delete"');
  });

  test('escapes HTML in user-entered text', async () => {
    api.getTask.mockResolvedValue(task({ title: '<script>alert(1)</script>' }));

    const res = await request(app).get('/tasks/7').expect(200);

    expect(res.text).not.toContain('<script>alert(1)</script>');
    expect(res.text).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  test('shows the task not found page when the API returns 404', async () => {
    api.getTask.mockRejectedValue(apiError(404));

    const res = await request(app).get('/tasks/99').expect(404);

    expect(res.text).toContain('Task not found');
  });

  test('shows the task not found page for a non-numeric ID without calling the API', async () => {
    await request(app).get('/tasks/abc').expect(404);

    expect(api.getTask).not.toHaveBeenCalled();
  });
});

describe('POST /tasks/:id/status', () => {
  beforeEach(() => api.getTask.mockResolvedValue(task()));

  test('updates the status and redirects to the task', async () => {
    api.updateTaskStatus.mockResolvedValue(task({ status: 'DONE' }));

    const res = await postForm('/tasks/7/status', '/tasks/7/status', { status: 'DONE' }, 303);

    expect(res.headers.location).toBe('/tasks/7');

    expect(api.updateTaskStatus).toHaveBeenCalledWith('7', 'DONE');
  });

  test('asks for a status when none is chosen', async () => {
    const res = await postForm('/tasks/7/status', '/tasks/7/status', {}, 400);

    expect(res.text).toContain('<a href="#status">Select a status</a>');
    expect(api.updateTaskStatus).not.toHaveBeenCalled();
  });

  test('explains a conflicting change when the API returns 409', async () => {
    api.updateTaskStatus.mockRejectedValue(apiError(409));

    const res = await postForm('/tasks/7/status', '/tasks/7/status', { status: 'DONE' }, 409);

    expect(res.text).toContain('This task was changed by someone else');
  });
});

describe('POST /tasks/:id/delete', () => {
  beforeEach(() => api.getTask.mockResolvedValue(task()));

  test('asks for confirmation before deleting', async () => {
    const res = await request(app).get('/tasks/7/delete').expect(200);

    expect(res.text).toContain('Are you sure you want to delete this task?');
    expect(res.text).toContain('govuk-button--warning');
  });

  test('deletes the task and redirects to the list', async () => {
    const res = await postForm('/tasks/7/delete', '/tasks/7/delete', {}, 303);

    expect(res.headers.location).toBe('/tasks');

    expect(api.deleteTask).toHaveBeenCalledWith('7');
  });

  test('shows the task not found page when the task has already gone', async () => {
    api.deleteTask.mockRejectedValue(apiError(404));

    const res = await postForm('/tasks/7/delete', '/tasks/7/delete', {}, 404);

    expect(res.text).toContain('Task not found');
  });
});

describe('security headers and unknown pages', () => {
  test('sends a CSP whose script nonce matches the inline script', async () => {
    api.listTasks.mockResolvedValue([]);

    const res = await request(app).get('/tasks').expect(200);

    const nonce = /'nonce-([^']+)'/.exec(res.headers['content-security-policy'])?.[1];
    expect(nonce).toBeDefined();
    expect(res.text).toContain(`<script nonce="${nonce}">`);
  });

  test('shows the page not found page for an unknown path', async () => {
    const res = await request(app).get('/no-such-page').expect(404);

    expect(res.text).toContain('Page not found');
  });
});
