import {
  Task,
  TaskStatus,
  apiFieldErrors,
  apiStatus,
  createTask,
  deleteTask,
  getTask,
  listTasks,
  updateTaskStatus,
} from '../services/taskApi';
import { DatePart, formatDateTime, isOverdue, parseDueDate } from '../utils/dates';
import { FieldErrors, toErrorSummary, toFieldErrors } from '../utils/errors';
import { STATUSES, isTaskStatus, statusTag } from '../utils/status';

import { Application, Request, Response, Router } from 'express';

const FLASH_COOKIE = 'flash';
const FLASH_MESSAGES: Record<string, string> = {
  created: 'Task created',
  updated: 'Status updated',
  deleted: 'Task deleted',
};

function setFlash(req: Request, res: Response, key: keyof typeof FLASH_MESSAGES): void {
  res.cookie(FLASH_COOKIE, key, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: 60_000 });
}

function takeFlash(req: Request, res: Response): string | undefined {
  const key = req.cookies?.[FLASH_COOKIE];
  if (key !== undefined) {
    res.clearCookie(FLASH_COOKIE);
  }
  return typeof key === 'string' ? FLASH_MESSAGES[key] : undefined;
}

function field(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function taskView(task: Task, now = new Date()) {
  return {
    ...task,
    tag: statusTag(task.status),
    overdue: task.status !== 'DONE' && isOverdue(task.dueDate, now),
    dueDateText: formatDateTime(task.dueDate),
    createdAtText: formatDateTime(task.createdAt),
    updatedAtText: formatDateTime(task.updatedAt),
  };
}

function renderTaskNotFound(res: Response): void {
  res.status(404).render('tasks/not-found');
}

async function findTask(id: string, res: Response): Promise<Task | undefined> {
  try {
    return await getTask(id);
  } catch (err) {
    if (apiStatus(err) === 404) {
      renderTaskNotFound(res);
      return undefined;
    }
    throw err;
  }
}

function renderNewTask(
  res: Response,
  values: Record<string, string>,
  errors: FieldErrors = {},
  invalidParts: DatePart[] = []
): void {
  res.status(Object.keys(errors).length ? 400 : 200).render('tasks/new', {
    values,
    errors,
    errorSummary: toErrorSummary(errors),
    invalidParts,
    statuses: STATUSES,
  });
}

function renderStatusForm(res: Response, task: Task, httpStatus: number, selected?: string, errors: FieldErrors = {}) {
  res.status(httpStatus).render('tasks/status', {
    task: taskView(task),
    selected: selected ?? task.status,
    errors,
    errorSummary: toErrorSummary(errors),
    statuses: STATUSES,
  });
}

const router = Router();

router.param('id', (req, res, next, id) => {
  if (/^\d+$/.test(id)) {
    return next();
  }
  renderTaskNotFound(res);
});

router.get('/', async (req, res) => {
  const now = new Date();
  const tasks = await listTasks();
  res.render('tasks/list', { tasks: tasks.map(task => taskView(task, now)), flash: takeFlash(req, res) });
});

router.get('/new', (req, res) => {
  renderNewTask(res, {});
});

router.post('/', async (req, res) => {
  const values = {
    title: field(req.body.title),
    description: field(req.body.description),
    status: field(req.body.status),
    day: field(req.body['dueDate-day']),
    month: field(req.body['dueDate-month']),
    year: field(req.body['dueDate-year']),
    time: field(req.body.dueTime),
  };
  const due = parseDueDate(values);

  try {
    const task = await createTask({
      title: values.title,
      description: values.description.trim() || undefined,
      status: isTaskStatus(values.status) ? values.status : undefined,
      dueDate: due.ok ? due.iso : undefined,
    });
    setFlash(req, res, 'created');
    res.redirect(303, `/tasks/${task.id}`);
  } catch (err) {
    const apiErrors = apiFieldErrors(err);
    if (!apiErrors) {
      throw err;
    }
    const errors = toFieldErrors(apiErrors);
    let invalidParts: DatePart[] = errors.dueDate ? ['day', 'month', 'year'] : [];
    if (!due.ok) {
      delete errors.dueDate;
      Object.assign(errors, due.errors);
      invalidParts = due.invalidParts;
    }
    renderNewTask(res, values, errors, invalidParts);
  }
});

router.get('/:id', async (req, res) => {
  const task = await findTask(req.params.id, res);
  if (task) {
    res.render('tasks/view', { task: taskView(task), flash: takeFlash(req, res) });
  }
});

router.get('/:id/status', async (req, res) => {
  const task = await findTask(req.params.id, res);
  if (task) {
    renderStatusForm(res, task, 200);
  }
});

router.post('/:id/status', async (req, res) => {
  const status: TaskStatus | undefined = isTaskStatus(req.body.status) ? req.body.status : undefined;
  const version = /^\d+$/.test(field(req.body.version)) ? Number(req.body.version) : undefined;
  if (!status) {
    const task = await findTask(req.params.id, res);
    if (task) {
      renderStatusForm(res, task, 400, undefined, { status: 'Select a status' });
    }
    return;
  }

  try {
    await updateTaskStatus(req.params.id, status, version);
  } catch (err) {
    if (apiStatus(err) === 404) {
      return renderTaskNotFound(res);
    }
    if (apiStatus(err) === 409) {
      const task = await findTask(req.params.id, res);
      if (task) {
        renderStatusForm(res, task, 409, status, {
          status: 'This task was changed by someone else. Check its status and try again.',
        });
      }
      return;
    }
    throw err;
  }
  setFlash(req, res, 'updated');
  res.redirect(303, `/tasks/${req.params.id}`);
});

router.get('/:id/delete', async (req, res) => {
  const task = await findTask(req.params.id, res);
  if (task) {
    res.render('tasks/delete', { task: taskView(task) });
  }
});

router.post('/:id/delete', async (req, res) => {
  try {
    await deleteTask(req.params.id);
  } catch (err) {
    if (apiStatus(err) === 404) {
      return renderTaskNotFound(res);
    }
    throw err;
  }
  setFlash(req, res, 'deleted');
  res.redirect(303, '/tasks');
});

export default function (app: Application): void {
  app.use('/tasks', router);
}
