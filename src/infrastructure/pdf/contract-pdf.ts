import PDFDocument from 'pdfkit';

/**
 * Generation PDF cote serveur avec pdfkit.
 *
 * Choix pdfkit vs puppeteer: pdfkit est une lib native legere, sans dependance
 * a un navigateur headless (Chromium ~300 Mo). L'image Docker reste petite et le
 * rendu est deterministe, suffisant pour des contrats structures (Phase 1).
 * Puppeteer serait justifie plus tard pour un rendu HTML/CSS riche (templates).
 */
export interface ContractPdfData {
  contractNumber: string;
  title: string;
  typeLabel: string;
  status: string;
  scope: string;
  startDate?: string | null;
  endDate?: string | null;
  amount?: number | null;
  currency: string;
  parties: Array<{ role: string; fullName: string; type: string; email?: string | null }>;
}

export function generateContractPdf(data: ContractPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text('EDUCA.TECH', { align: 'right' });
    doc.moveDown(0.5);
    doc.fontSize(16).text(data.title, { align: 'center' });
    doc.moveDown();

    doc.fontSize(11);
    const line = (label: string, value: string) =>
      doc.font('Helvetica-Bold').text(`${label}: `, { continued: true }).font('Helvetica').text(value);

    line('Numero', data.contractNumber);
    line('Type', data.typeLabel);
    line('Portee', data.scope);
    line('Statut', data.status);
    if (data.startDate) line('Date de debut', data.startDate);
    if (data.endDate) line('Date de fin', data.endDate);
    if (data.amount != null) line('Montant', `${data.amount.toFixed(2)} ${data.currency}`);

    doc.moveDown();
    doc.font('Helvetica-Bold').fontSize(13).text('Parties');
    doc.moveDown(0.3);
    doc.fontSize(11);
    if (data.parties.length === 0) {
      doc.font('Helvetica-Oblique').text('Aucune partie enregistree.');
    } else {
      for (const p of data.parties) {
        doc
          .font('Helvetica')
          .text(`- [${p.role}] ${p.fullName} (${p.type})${p.email ? ` - ${p.email}` : ''}`);
      }
    }

    doc.moveDown(2);
    doc
      .fontSize(8)
      .font('Helvetica-Oblique')
      .text(
        'Document genere automatiquement par contrat-service (EDUCA.TECH). ' +
          'Ceci n\'est pas un document signe tant qu\'aucune signature electronique n\'a ete apposee.',
        { align: 'center' },
      );

    doc.end();
  });
}
