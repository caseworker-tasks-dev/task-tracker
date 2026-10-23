# Task tracker

[![Backend CI](https://github.com/caseworker-tasks-dev/task-tracker/actions/workflows/backend-ci.yml/badge.svg?branch=main)](https://github.com/caseworker-tasks-dev/task-tracker/actions/workflows/backend-ci.yml)
[![Frontend CI](https://github.com/caseworker-tasks-dev/task-tracker/actions/workflows/frontend-ci.yml/badge.svg?branch=main)](https://github.com/caseworker-tasks-dev/task-tracker/actions/workflows/frontend-ci.yml)

A small service for HMCTS caseworkers to keep track of their tasks. A caseworker can create a task with a title,
an optional description, a status and a due date and time; see all their tasks ordered by due date; change a
task's status; and delete a task.

It is two applications in one repository:

| Part                     | Stack                                                       | Port |
| ------------------------ | ----------------------------------------------------------- | ---- |
| [`backend/`](backend/)   | Java 21, Spring Boot 4, Spring Data JPA, Flyway, PostgreSQL | 4000 |
| [`frontend/`](frontend/) | Node 24, Express 5, TypeScript, Nunjucks, GOV.UK Frontend   | 3100 |

## Running it

### Everything in Docker

You need Docker. From the repository root:

```sh
docker compose up --build
```

This starts PostgreSQL, the API and the front end. The first build takes a few minutes while Gradle and Yarn
download dependencies.

| What           | Where                                       |
| -------------- | ------------------------------------------- |
| Front end      | http://localhost:3100                       |
| API            | http://localhost:4000                       |
| Swagger UI     | http://localhost:4000/swagger-ui/index.html |
| API health     | http://localhost:4000/health                |
| PostgreSQL     | `localhost:5433`, user, password and database all `task_tracker` |

Use Chrome or Firefox. The CSRF cookies are `Secure`, which those browsers allow on `http://localhost`; Safari may
not, in which case form submissions are rejected with a 403.

`docker compose down` stops everything. Add `-v` to delete the database as well.

### Developing locally

Start only the database in Docker, then run each application on your machine.

```sh
docker compose up -d postgres

# API: needs Java 21
cd backend
./gradlew bootRun --args='--spring.profiles.active=local'

# Front end: needs Node 24 (`nvm use` reads frontend/.nvmrc)
cd frontend
corepack yarn install
corepack yarn start:dev
```

`start:dev` serves the front end at **https**://localhost:3100 with a self-signed certificate it generates on first
run, restarts on TypeScript changes and reloads Nunjucks templates as you edit them. The `local` profile makes the
API's `/health` endpoint show database and disk details, which are hidden by default.

Configuration is through environment variables:

| Variable                                                       | Used by   | Default                        |
| -------------------------------------------------------------- | --------- | ------------------------------ |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER_NAME`, `DB_PASSWORD` | API       | match `docker-compose.yml`     |
| `BACKEND_URL`                                                  | front end | `http://localhost:4000`        |
| `CSRF_SECRET`                                                  | front end | random per start; **required** when `NODE_ENV=production` |

## API

Full, interactive documentation is in Swagger UI at http://localhost:4000/swagger-ui/index.html.

| Method   | Path                 | Success                           | Errors          |
| -------- | -------------------- | --------------------------------- | --------------- |
| `POST`   | `/tasks`             | 201 with a `Location` header      | 400             |
| `GET`    | `/tasks`             | 200, sorted by due date           |                 |
| `GET`    | `/tasks/{id}`        | 200                               | 404             |
| `PATCH`  | `/tasks/{id}/status` | 200                               | 400, 404, 409   |
| `DELETE` | `/tasks/{id}`        | 204                               | 404             |

```json
POST /tasks
{ "title": "Review case bundle", "description": "Optional", "status": "TODO", "dueDate": "2030-07-01T09:30:00+01:00" }

PATCH /tasks/1/status
{ "status": "DONE", "version": 0 }
```

`status` is one of `TODO`, `IN_PROGRESS` or `DONE`, and defaults to `TODO` when it is left out. `dueDate` is
ISO 8601 with an offset and must not be in the past. Every task in a response includes a `version`.

Every error is an [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) `application/problem+json` body. Validation
failures also include an `errors` map from field to message, for example
`{"title": "must not be blank"}`, including for a status or date the API cannot parse.

## Design decisions

**One repository for both applications.** The API and the front end change together: a new field touches the
migration, the DTO, the API client and a form. Keeping them in one repository means one pull request per change and
one `docker compose up` to run everything. Each half keeps its own build, and a CI workflow per half runs only when
its directory changes.

**The database schema is owned by Flyway, not Hibernate.** [`V1__create_task.sql`](backend/src/main/resources/db/migration/V1__create_task.sql)
creates the table, with a `CHECK` constraint on status and `NOT NULL` defaults on the timestamps. Hibernate runs with
`ddl-auto: validate`, so the application refuses to start if the entity and the schema disagree.

**Integration tests run against real PostgreSQL.** They use Testcontainers rather than an in-memory database, so
the migration, the `CHECK` constraint, `TIMESTAMP WITH TIME ZONE` and optimistic locking are all tested on the
database that runs in production.

**UK time.** GOV.UK has no date-time component, so the form uses the date input (day, month, year) and a 24-hour
time field. [`dates.ts`](frontend/src/main/utils/dates.ts) turns these into ISO 8601 using the Europe/London
offset *on that date*, so a July date is sent as `+01:00` and a January one as `+00:00`. It also rejects dates that
do not exist (31 February) and times that do not exist because the clocks go forward (01:30 on the last Sunday in
March), naming the part that is wrong, which the API alone could not do. The API stores an instant; the front end
displays it in UK time.

**Optimistic locking.** Two caseworkers can open the same task at once. Each task has a `version`. The status form
carries the version the caseworker loaded, the API rejects an update made against an older version with 409, and the
form explains that someone else changed the task and shows its current state. Without this, the second caseworker
would silently overwrite the first.

**CSRF protection.** Every form `POST` is protected with the double-submit cookie pattern
([`csrf-csrf`](https://github.com/Psifi-Solutions/csrf-csrf); `csurf` is deprecated). The token is bound to a
random visitor cookie because the application has no sessions. The token cookie is `__Host-` prefixed and
`SameSite=Strict`, and both cookies are `Secure` and `HttpOnly`.

**Content Security Policy.** [Helmet](https://helmetjs.github.io/) sets a CSP whose `script-src` allows only this
origin and a nonce generated for each request. The nonce is passed to the GOV.UK template's one inline script, so
any injected script would not run. `'unsafe-eval'` is added only in development, for webpack.

**Escaping.** Nunjucks escapes output by default, and anything a user typed is rendered with `text:`, never `html:`.
A test renders a task titled `<script>alert(1)</script>` and checks it comes out escaped.

**Forms that work without JavaScript.** HTML forms can only `GET` or `POST`, so the front end has `POST` routes
that call the API's `PATCH` and `DELETE`. Every `POST` ends in a 303 redirect, so refreshing the page never
resubmits a form. Confirmation banners ("Task created") come from a short-lived cookie holding only a key, never the
message text.

**Failure is designed for.** A task that no longer exists shows "Task not found"; if the API is unreachable or
fails, the front end shows "Sorry, there is a problem with the service" rather than an error trace. Health details
such as database type and disk paths are hidden unless the `local` profile is active.

## Tests

```sh
# API: unit tests, integration tests against Testcontainers PostgreSQL (needs Docker), checkstyle
cd backend
./gradlew check

# Front end: build, lint, unit, route and accessibility tests
cd frontend
corepack yarn cichecks
```

| Suite                      | What it covers                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------- |
| API unit (27)              | `TaskService` with Mockito; `TaskController` status codes and validation via `@WebMvcTest` |
| API integration (6)        | Create → read → update → stale update (409) → delete on real PostgreSQL; schema constraints; locking |
| Front-end unit (30)        | Date conversion across GMT and BST, impossible dates, error message mapping            |
| Front-end routes (22)      | Every page and redirect with the API mocked, real CSRF tokens, XSS escaping, CSP nonce |
| Front-end accessibility (10) | axe-core on every page, including the form with errors and the error pages            |

Both CI workflows run these on every push to `main` that touches their half of the repository.

## What I'd do next

- **Sign-in and ownership.** Caseworkers would sign in (for HMCTS, through IDAM), tasks would belong to a person, and
  the list would show "my tasks". Health details would then be visible to authorised users rather than by profile.
- **Edit a task**, not just its status, using the same version check.
- **Use `ETag` and `If-Match`** for the version instead of a body field, which is the HTTP-native way to do the
  same thing and lets caches and proxies take part.
- **Filtering, sorting and pagination** on the list once a caseworker has more than a screenful of tasks.
- **An audit trail** of who changed a task and when.
- **Welsh language support**, which HMCTS services need.
- **End-to-end browser tests.** The starter's CodeceptJS feature is out of date; I would replace it with Playwright
  tests that run the whole Docker Compose stack.
- **Production hardening.** Compile the front end's TypeScript at build time instead of running `ts-node`, use
  smaller runtime images, load `CSRF_SECRET` and database credentials from a secrets store, and add structured
  logging and metrics.
