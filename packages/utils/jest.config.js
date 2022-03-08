module.exports = {
    preset: "ts-jest",
    collectCoverage: true,
    testEnvironment: "node",
    testMatch: [
        "**/*.test.ts"
    ],
    globals: {
        "ts-jest": {
            tsconfig: "./tsconfig.test.json",
            diagnostics: false
        }
    },
    transform: {
        "^.+\\.ts$": "ts-jest"
    },
    moduleFileExtensions: [
        "js",
        "ts"
    ],
};