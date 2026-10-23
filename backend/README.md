# HMCTS Dev Test Backend

[![Backend CI](https://github.com/caseworker-tasks-dev/task-tracker/actions/workflows/backend-ci.yml/badge.svg?branch=main)](https://github.com/caseworker-tasks-dev/task-tracker/actions/workflows/backend-ci.yml)

This will be the backend for the brand new HMCTS case management system. As a potential candidate we are leaving
this in your hands. Please refer to the brief for the complete list of tasks! Complete as much as you can and be
as creative as you want.

You should be able to run `./gradlew build` to start with to ensure it builds successfully. Then from that you
can run the service in IntelliJ (or your IDE of choice) or however you normally would.

`/health` only reports overall status by default. To see component details (database, disk space) locally, run
with the `local` profile: `./gradlew bootRun --args='--spring.profiles.active=local'`.

There is an example endpoint provided to retrieve an example of a case. You are free to add/remove fields as you
wish.
