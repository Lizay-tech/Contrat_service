import {
  findMissingRequired,
  formatDateFr,
  renderTemplate,
} from '../src/domain/template/render';
import { assembleRenderContext } from '../src/domain/template/context';
import { amountInWords, numberToFrenchWords } from '../src/domain/template/number-to-words';
import { extractVariableKeys, resolveVariables } from '../src/domain/template/variable-catalogue';

describe('Moteur de rendu de templates', () => {
  it('substitue les jetons {{...}} et vide les variables absentes', () => {
    const body = 'Bonjour {{employee_name}}, poste {{employee_function}}. {{unknown}}';
    const out = renderTemplate(body, { employee_name: 'Jean', employee_function: 'Enseignant' });
    expect(out).toBe('Bonjour Jean, poste Enseignant. ');
  });

  it('detecte les cles de variables', () => {
    expect(extractVariableKeys('{{a}} x {{b}} {{a}}').sort()).toEqual(['a', 'b']);
    expect(resolveVariables('{{employee_name}}')[0]?.source).toBe('EMPLOYEE');
  });

  it('remonte les variables requises manquantes (hors systeme)', () => {
    const body = '{{employee_name}} {{school_name}} {{today}}';
    const missing = findMissingRequired(body, { employee_name: 'Jean' });
    expect(missing.map((m) => m.key)).toEqual(['school_name']); // today = systeme, ignore
  });

  it('formate les dates en francais', () => {
    expect(formatDateFr('2026-09-01')).toBe('1 septembre 2026');
  });
});

describe('Nombre en lettres (francais)', () => {
  it.each([
    [0, 'zero'],
    [1, 'un'],
    [21, 'vingt et un'],
    [80, 'quatre-vingts'],
    [81, 'quatre-vingt-un'],
    [71, 'soixante et onze'],
    [100, 'cent'],
    [200, 'deux cents'],
    [1000, 'mille'],
    [25000, 'vingt-cinq mille'],
  ])('convertit %i', (n, expected) => {
    expect(numberToFrenchWords(n)).toBe(expected);
  });

  it('ajoute la devise', () => {
    expect(amountInWords(25000, 'HTG')).toBe('vingt-cinq mille gourdes');
  });
});

describe('Assemblage du contexte de rendu', () => {
  it('calcule salary_in_words et today automatiquement', () => {
    const ctx = assembleRenderContext(
      { employee_name: 'Jean', start_date: '2026-09-01' },
      { amount: 25000, currency: 'HTG', now: new Date('2026-07-02T00:00:00Z') },
    );
    expect(ctx.salary).toBe(25000);
    expect(ctx.salary_in_words).toBe('vingt-cinq mille gourdes');
    expect(ctx.start_date).toBe('1 septembre 2026');
    expect(ctx.today).toBe('2 juillet 2026');
  });
});
