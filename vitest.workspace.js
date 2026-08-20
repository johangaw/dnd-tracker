// Two kinds of test live in this repo and they need different environments.
//
// The app tests drive real DOM through happy-dom and rely on tests/setup.js,
// which imports js/main.js eagerly to register the custom elements. The Lambda
// and tooling tests exercise plain server-side modules - one of them binds real
// sockets - and must NOT load that setup, since there is no document for it to
// touch.

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
            name: 'node',
            environment: 'node',
            include: ['tests/lambda/**/*.test.js', 'tests/tools/**/*.test.js'],
            globals: true
        }
    }
];
