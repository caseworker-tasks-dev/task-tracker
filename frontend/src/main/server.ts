#!/usr/bin/env node
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';

import { app } from './app';

let server: http.Server | https.Server | null = null;

// used by shutdownCheck in readinessChecks
app.locals.shutdown = false;

// TODO: set the right port for your application
const port: number = parseInt(process.env.PORT || '3100', 10);

if (app.locals.ENV === 'development') {
  const sslDirectory = path.join(__dirname, 'resources', 'localhost-ssl');
  const sslOptions = {
    cert: fs.readFileSync(path.join(sslDirectory, 'localhost.crt')),
    key: fs.readFileSync(path.join(sslDirectory, 'localhost.key')),
  };
  server = https.createServer(sslOptions, app);
  server.listen(port, () => {
    console.log(`Application started: https://localhost:${port}`);
  });
} else {
  server = app.listen(port, () => {
    console.log(`Application started: http://localhost:${port}`);
  });
}

function gracefulShutdownHandler(signal: string) {
  console.log(`⚠️ Caught ${signal}, gracefully shutting down. Setting readiness to DOWN`);
  // stop the server from accepting new connections
  app.locals.shutdown = true;

  setTimeout(() => {
    console.log('Shutting down application');
    // Close server if it's running
    server?.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
    server?.closeIdleConnections();
  }, 4000);
}

process.on('SIGINT', gracefulShutdownHandler);
process.on('SIGTERM', gracefulShutdownHandler);
