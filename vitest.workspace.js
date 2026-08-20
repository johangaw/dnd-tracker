// Two kinds of test live in this repo and they need different environments.
//
// The app tests drive real DOM through happy-dom and rely on tests/setup.js,
// which imports js/main.js eagerly to register the custom elements. The Lambda
// tests exercise plain server-side modules and must NOT load that setup, since
// there is no document for it to touch.

export default [
    {
        test: {
            name: 'app',
            environment: 'happy-dom',
            setupFiles: ['./tests/setup.js'],
            include: ['tests/scenarios/**/*.test.js'],
            globals: true
        }
    },
    {
        test: {
            name: 'lambda',
            environment: 'node',
            include: ['tests/lambda/**/*.test.js'],
            globals: true
        }
    }
];
