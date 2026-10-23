import axios, { isAxiosError } from 'axios';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueDate: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  status?: TaskStatus;
  dueDate?: string;
}

const client = axios.create({
  baseURL: process.env.BACKEND_URL ?? 'http://localhost:4000',
  timeout: 5000,
});

export async function listTasks(): Promise<Task[]> {
  const response = await client.get<Task[]>('/tasks');
  return response.data;
}

export async function getTask(id: string): Promise<Task> {
  const response = await client.get<Task>(`/tasks/${encodeURIComponent(id)}`);
  return response.data;
}

export async function createTask(payload: CreateTaskPayload): Promise<Task> {
  const response = await client.post<Task>('/tasks', payload);
  return response.data;
}

export async function updateTaskStatus(id: string, status: TaskStatus, version: number | undefined): Promise<Task> {
  const response = await client.patch<Task>(`/tasks/${encodeURIComponent(id)}/status`, { status, version });
  return response.data;
}

export async function deleteTask(id: string): Promise<void> {
  await client.delete(`/tasks/${encodeURIComponent(id)}`);
}

export function apiStatus(err: unknown): number | undefined {
  return isAxiosError(err) ? err.response?.status : undefined;
}

export function apiFieldErrors(err: unknown): Record<string, string> | undefined {
  if (apiStatus(err) !== 400 || !isAxiosError(err)) {
    return undefined;
  }
  const errors = err.response?.data?.errors;
  return errors && typeof errors === 'object' ? errors : undefined;
}
