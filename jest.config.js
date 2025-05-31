module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/test/**/*.test.ts'],
    verbose: true,
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
    },
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    testPathIgnorePatterns: ['/node_modules/'],
    setupFiles: ['<rootDir>/jest.setup.js'],
    moduleNameMapper: {
        '^lambda/(.*)$': '<rootDir>/lambda/$1'
    }
};
