import { randomBytes, randomUUID } from 'crypto';
import * as path from 'path';

import { HTTPError } from './HttpError';
import { Nunjucks } from './modules/nunjucks';

import cookieParser from 'cookie-parser';
import { doubleCsrf } from 'csrf-csrf';
import express from 'express';
import { glob } from 'glob';
import helmet from 'helmet';
import favicon from 'serve-favicon';

const { setupDev } = require('./development');

const env = process.env.NODE_ENV || 'development';
const developmentMode = env === 'development';

if (env === 'production' && !process.env.CSRF_SECRET) {
  throw new Error('CSRF_SECRET must be set in production');
}
const csrfSecret = process.env.CSRF_SECRET ?? randomBytes(32).toString('hex');
const VISITOR_COOKIE = 'task-tracker.vid';

const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => csrfSecret,
  getSessionIdentifier: req => req.cookies[VISITOR_COOKIE] ?? '',
  getCsrfTokenFromRequest: req => req.body?._csrf,
});

export const app = express();
app.locals.ENV = env;
app.locals.serviceName = 'Task tracker';
app.locals.serviceUrl = '/tasks';

new Nunjucks(developmentMode).enableFor(app);

app.use((req, res, next) => {
  res.locals.cspNonce = randomBytes(16).toString('base64');
  next();
});
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        scriptSrc: [
          "'self'",
          (req, res) => `'nonce-${(res as express.Response).locals.cspNonce}'`,
          ...(developmentMode ? ["'unsafe-eval'"] : []),
        ],
        upgradeInsecureRequests: null,
      },
    },
  })
);
app.use(favicon(path.join(__dirname, '/public/assets/images/favicon.ico')));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, max-age=0, must-revalidate, no-store');
  next();
});
app.use((req, res, next) => {
  if (!req.cookies[VISITOR_COOKIE]) {
    req.cookies[VISITOR_COOKIE] = randomUUID();
    res.cookie(VISITOR_COOKIE, req.cookies[VISITOR_COOKIE], { httpOnly: true, sameSite: 'lax', secure: true });
  }
  next();
});
app.use(doubleCsrfProtection);
app.use((req, res, next) => {
  res.locals.csrfToken = generateCsrfToken(req, res);
  next();
});

glob
  .sync(__dirname + '/routes/**/*.+(ts|js)')
  .map(filename => require(filename))
  .forEach(route => route.default(app));

setupDev(app, developmentMode);

app.use((req, res) => {
  res.status(404).render('not-found');
});

// error handler
app.use((err: HTTPError, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.log(err);
  if (res.headersSent) {
    return next(err);
  }
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = env === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});
