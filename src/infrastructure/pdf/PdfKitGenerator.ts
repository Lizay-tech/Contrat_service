import PDFDocument from 'pdfkit';
import { IPdfGenerator } from '../../application/ports/services';

/**
 * Server-side PDF generation using pdfkit.
 *
 * Choice: pdfkit over puppeteer for Phase 1. The contract documents produced
 * here are simple, structured text; pdfkit renders them directly in-process
 * with no headless Chromium to install/run — keeping the Docker image small and
 * memory footprint low. If rich HTML/CSS templating is needed later (Phase 2
 * templates), a puppeteer-based generator can implement the same interface.
 */
export class PdfKitGenerator implements IPdfGenerator {
  async renderContractPdf(input: {
    title: string;
    contractNumber: string;
    body: string;
  }): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).text(input.title, { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).fillColor('#555').text(`N° ${input.contractNumber}`, {
        align: 'center',
      });
      doc.moveDown(2);
      doc.fillColor('#000').fontSize(11).text(input.body, { align: 'left' });

      doc.end();
    });
  }
}
