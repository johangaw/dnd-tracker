# Agent Instructions

## Testing Requirements

1. **Always create tests for new features** - Every new feature must have corresponding tests that verify its behavior.

2. **Always run tests before committing** - Run `npm test` and ensure all tests pass before creating a commit.

3. **Test file location** - Tests go in `tests/scenarios/` directory, named `<feature>.test.js`.

4. **Test patterns** - Follow existing test patterns:
   - Use `vitest` with `happy-dom`
   - Import helpers from `../helpers.js`
   - Use `beforeEach` with `initApp()` to set up each test
   - Use `afterEach` to clear `localStorage` and restore mocks

## Code Style

- Follow existing patterns in the codebase
- Use ES modules (import/export)
- Components go in `js/components/`
- Services go in `js/services/`
- Utilities go in `js/utils/`

## Code version control
- Do not commit changes unless explicitly told so or if you were able to verify the changes yourself.