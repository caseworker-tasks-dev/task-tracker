import { app } from '../../main/app';

import request from 'supertest';

/* eslint-disable jest/expect-expect */
describe('Home page', () => {
  describe('on GET', () => {
    test('should redirect to the task list', async () => {
      await request(app).get('/').expect(302).expect('Location', '/tasks');
    });
  });
});
