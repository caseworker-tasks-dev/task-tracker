import { app } from '../../main/app';
import * as taskApi from '../../main/services/taskApi';

import { AxeResults, RunOptions, source as axeSource } from 'axe-core';
import { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { toHaveNoViolations } from 'jest-axe';
import { JSDOM } from 'jsdom';
import request from 'supertest';

jest.mock('../../main/services/taskApi', () => ({
  ...jest.requireActual('../../main/services/taskApi'),
  listTasks: jest.fn(),
  getTask: jest.fn(),
  createTask: jest.fn(),
}));

expect.extend(toHaveNoViolations);

const api = jest.mocked(taskApi);

const task = (overrides: Partial<taskApi.Task> = {}): taskApi.Task => ({
  id: 7,
  title: 'Review case',
  description: 'Check the bundle',
  status: 'IN_PROGRESS',
  dueDate: '2020-07-01T08:30:00Z',
  version: 0,
  createdAt: '2026-10-23T09:00:00Z',
  updatedAt: '2026-10-23T09:00:00Z',
  ...overrides,
});

function apiError(status?: number, data: unknown = {}): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  if (status === undefined) {
    return new AxiosError('connect ECONNREFUSED', 'ECONNREFUSED', config);
  }
  return new AxiosError(
    'Request failed',
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

// Runs axe-core inside a standalone jsdom window, so the Express app itself stays in Jest's node environment.
async function axe(html: string): Promise<AxeResults> {
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
  dom.window.eval(axeSource);
  const windowAxe = (
    dom.window as unknown as { axe: { run(context: Document, options: RunOptions): Promise<AxeResults> } }
  ).axe;
  // Colour contrast needs real CSS layout, which jsdom does not do.
  const results = await windowAxe.run(dom.window.document, { rules: { 'color-contrast': { enabled: false } } });
  dom.window.close();
  return results;
}

async function createFormWithErrors(): Promise<string> {
  const form = await request(app).get('/tasks/new');
  const token = /name="_csrf" value="([^"]+)"/.exec(form.text)?.[1] ?? '';
  const cookies = (form.headers['set-cookie'] as unknown as string[]).map(cookie => cookie.split(';')[0]);
  const res = await request(app)
    .post('/tasks')
    .set('Cookie', cookies)
    .type('form')
    .send({ _csrf: token, title: '', 'dueDate-day': '31', 'dueDate-month': '2', 'dueDate-year': '2030', dueTime: '' })
    .expect(400);
  return res.text;
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  api.listTasks.mockResolvedValue([task(), task({ id: 8, title: 'File bundle', status: 'DONE' })]);
  api.getTask.mockResolvedValue(task());
  api.createTask.mockRejectedValue(
    apiError(400, { errors: { title: 'must not be blank', dueDate: 'must not be null' } })
  );
});

describe('accessibility', () => {
  test.each([
    ['task list', '/tasks', 200],
    ['create task form', '/tasks/new', 200],
    ['task details', '/tasks/7', 200],
    ['change status form', '/tasks/7/status', 200],
    ['delete confirmation', '/tasks/7/delete', 200],
    ['page not found', '/no-such-page', 404],
  ])('%s has no axe violations', async (_name, path, status) => {
    const res = await request(app).get(path).expect(status);

    expect(await axe(res.text)).toHaveNoViolations();
  });

  test('empty task list has no axe violations', async () => {
    api.listTasks.mockResolvedValue([]);

    const res = await request(app).get('/tasks').expect(200);

    expect(await axe(res.text)).toHaveNoViolations();
  });

  test('create task form with errors has no axe violations', async () => {
    expect(await axe(await createFormWithErrors())).toHaveNoViolations();
  });

  test('task not found page has no axe violations', async () => {
    api.getTask.mockRejectedValue(apiError(404));

    const res = await request(app).get('/tasks/99').expect(404);

    expect(await axe(res.text)).toHaveNoViolations();
  });

  test('service problem page has no axe violations', async () => {
    api.listTasks.mockRejectedValue(apiError());

    const res = await request(app).get('/tasks').expect(500);

    expect(await axe(res.text)).toHaveNoViolations();
  });
});
