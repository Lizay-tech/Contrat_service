/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
<<<<<<< HEAD
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFiles: ['<rootDir>/tests/env.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
  clearMocks: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/server.ts'],
=======
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Puppeteer v25 est ESM-only: on le stub en test (Chromium non lance).
    '^puppeteer$': '<rootDir>/tests/mocks/puppeteer.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
  clearMocks: true,
>>>>>>> 34a51170a14d49e3daadfd6c75baf0624cf970a3
};
