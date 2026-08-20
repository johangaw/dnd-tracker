# Agent Instructions

## Testing Requirements

1. **Always create tests for new features** - Every new feature must have corresponding tests that verify its behavior.

2. **Always run tests for larger tasks** - Run `npm test` and ensure all tests pass before compleating the task

3. **Test file location** - App feature tests go in `tests/scenarios/`, named `<feature>.test.js`. Server-side and tooling tests go in `tests/lambda/` and `tests/tools/`; those run in a plain node environment without the happy-dom setup.

4. **Test patterns** - Follow existing test patterns:
   - Use `vitest` with `happy-dom`
   - Import helpers from `../helpers.js`
   - Use `beforeEach` with `initApp()` to set up each test
   - Use `afterEach` to clear `localStorage` and restore mocks

## Running the app

`npm run dev` serves the app on `http://localhost:3000` through
`scripts/dev-server.mjs`, which mirrors what CloudFront does in production: it
proxies `/api` to the deployed sync API, rewrites extensionless paths to the app
shell, and sends the real Content-Security-Policy. Use it rather than a plain
static file server, or UI work will be developed under conditions that do not
match production. It runs fine with no AWS credentials; sync is simply disabled.

## Code Style

- Follow existing patterns in the codebase
- Use ES modules (import/export)
- Components go in `js/components/`
- Services go in `js/services/`
- Utilities go in `js/utils/`

## Code version control
- Do not commit changes unless explicitly told so or if you were able to verify the changes yourself.