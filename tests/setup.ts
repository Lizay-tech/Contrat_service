// Force l'environnement de test AVANT tout import applicatif (env.ts lit process.env).
process.env.NODE_ENV = 'test';
process.env.EDUCA_SYSTEM_TENANT_ID =
  process.env.EDUCA_SYSTEM_TENANT_ID ?? '00000000-0000-0000-0000-000000000001';

jest.setTimeout(30000);

// Ferme le navigateur Puppeteer (singleton) en fin de chaque suite.
afterAll(async () => {
  const { closePdfBrowser } = await import('../src/infrastructure/pdf/html-pdf');
  await closePdfBrowser();
});
