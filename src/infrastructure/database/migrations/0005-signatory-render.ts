import type { QueryInterface } from 'sequelize';

/**
 * Persiste le rendu de la signature apposee (data URL image DRAWN ou texte TEXT)
 * pour pouvoir REGENERER le PDF signe avec toutes les signatures deja recueillies
 * sans avoir besoin du jeton de chaque signataire.
 */
export async function up({ context: qi }: { context: QueryInterface }): Promise<void> {
  await qi.sequelize.query(`
    ALTER TABLE signatories ADD COLUMN IF NOT EXISTS signature_render TEXT;
    ALTER TABLE signatories ADD COLUMN IF NOT EXISTS signed_document_id UUID;
  `);
}

export async function down({ context: qi }: { context: QueryInterface }): Promise<void> {
  await qi.sequelize.query(`
    ALTER TABLE signatories DROP COLUMN IF EXISTS signed_document_id;
    ALTER TABLE signatories DROP COLUMN IF EXISTS signature_render;
  `);
}
