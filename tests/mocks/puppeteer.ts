/**
 * Stub de puppeteer pour les tests (evite de lancer Chromium et l'incompat ESM
 * sous ts-jest). Le vrai Puppeteer est utilise en production / Docker.
 * page.pdf() renvoie un buffer PDF minimal valide (%PDF...).
 */
const page = {
  setContent: async (_html: string): Promise<void> => undefined,
  pdf: async (): Promise<Buffer> => Buffer.from('%PDF-1.4\n% mock pdf\n'),
  close: async (): Promise<void> => undefined,
};

const browser = {
  newPage: async () => page,
  close: async (): Promise<void> => undefined,
};

export default {
  launch: async () => browser,
};
