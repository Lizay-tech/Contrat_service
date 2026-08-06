/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Puppeteer v25 est ESM-only: on le stub en test (Chromium non lance).
    '^puppeteer$': '<rootDir>/tests/mocks/puppeteer.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
  clearMocks: true,
};
