import { VariableSource, VariableType } from '../../shared/types';

/** Definition d'une variable de template (jeton {{key}}). */
export interface VariableDefinition {
  key: string;
  label: string;
  type: VariableType;
  source: VariableSource;
  required: boolean;
}

/**
 * Catalogue statique des variables standard (cf. specification A.2).
 * Source unique de verite pour les labels/types; les variables reellement
 * utilisees par une version sont detectees dans son corps et stockees en jsonb.
 */
export const VARIABLE_CATALOGUE: readonly VariableDefinition[] = [
  // --- Employe / signataire ---
  { key: 'employee_name', label: 'Nom complet de l employe', type: VariableType.TEXT, source: VariableSource.EMPLOYEE, required: true },
  { key: 'employee_first_name', label: 'Prenom', type: VariableType.TEXT, source: VariableSource.EMPLOYEE, required: false },
  { key: 'employee_last_name', label: 'Nom', type: VariableType.TEXT, source: VariableSource.EMPLOYEE, required: false },
  { key: 'employee_function', label: 'Fonction / poste', type: VariableType.TEXT, source: VariableSource.EMPLOYEE, required: true },
  { key: 'employee_address', label: 'Adresse', type: VariableType.TEXT, source: VariableSource.EMPLOYEE, required: false },
  { key: 'employee_phone', label: 'Telephone', type: VariableType.TEXT, source: VariableSource.EMPLOYEE, required: false },
  { key: 'employee_email', label: 'Courriel', type: VariableType.TEXT, source: VariableSource.EMPLOYEE, required: false },
  { key: 'employee_id_number', label: 'CIN / NIF', type: VariableType.TEXT, source: VariableSource.EMPLOYEE, required: false },
  { key: 'employee_matricule', label: 'Matricule', type: VariableType.TEXT, source: VariableSource.EMPLOYEE, required: false },
  { key: 'employee_birth_date', label: 'Date de naissance', type: VariableType.DATE, source: VariableSource.EMPLOYEE, required: false },
  { key: 'employee_nationality', label: 'Nationalite', type: VariableType.TEXT, source: VariableSource.EMPLOYEE, required: false },
  // --- Ecole / employeur ---
  { key: 'school_name', label: 'Nom de l ecole', type: VariableType.TEXT, source: VariableSource.SCHOOL, required: true },
  { key: 'school_address', label: 'Adresse de l ecole', type: VariableType.TEXT, source: VariableSource.SCHOOL, required: false },
  { key: 'school_phone', label: 'Telephone ecole', type: VariableType.TEXT, source: VariableSource.SCHOOL, required: false },
  { key: 'school_email', label: 'Courriel ecole', type: VariableType.TEXT, source: VariableSource.SCHOOL, required: false },
  { key: 'director_name', label: 'Nom du directeur', type: VariableType.TEXT, source: VariableSource.SCHOOL, required: true },
  { key: 'director_function', label: 'Fonction du directeur', type: VariableType.TEXT, source: VariableSource.SCHOOL, required: false },
  { key: 'school_logo', label: 'Logo de l ecole', type: VariableType.IMAGE, source: VariableSource.SCHOOL, required: false },
  // --- Contrat ---
  { key: 'contract_number', label: 'Numero de contrat', type: VariableType.TEXT, source: VariableSource.CONTRACT, required: false },
  { key: 'contract_type', label: 'Type de contrat', type: VariableType.TEXT, source: VariableSource.CONTRACT, required: false },
  { key: 'contract_title', label: 'Titre du contrat', type: VariableType.TEXT, source: VariableSource.CONTRACT, required: false },
  { key: 'start_date', label: 'Date de debut', type: VariableType.DATE, source: VariableSource.CONTRACT, required: true },
  { key: 'end_date', label: 'Date de fin', type: VariableType.DATE, source: VariableSource.CONTRACT, required: false },
  { key: 'duration', label: 'Duree', type: VariableType.TEXT, source: VariableSource.CONTRACT, required: false },
  { key: 'trial_period', label: 'Periode d essai', type: VariableType.TEXT, source: VariableSource.CONTRACT, required: false },
  { key: 'notice_period', label: 'Preavis', type: VariableType.TEXT, source: VariableSource.CONTRACT, required: false },
  { key: 'salary', label: 'Salaire / montant', type: VariableType.CURRENCY, source: VariableSource.CONTRACT, required: false },
  { key: 'salary_in_words', label: 'Montant en lettres', type: VariableType.TEXT, source: VariableSource.CONTRACT, required: false },
  { key: 'currency', label: 'Devise', type: VariableType.TEXT, source: VariableSource.CONTRACT, required: false },
  { key: 'payment_frequency', label: 'Frequence de paiement', type: VariableType.TEXT, source: VariableSource.CONTRACT, required: false },
  { key: 'work_hours', label: 'Heures de travail', type: VariableType.TEXT, source: VariableSource.CONTRACT, required: false },
  { key: 'academic_year', label: 'Annee scolaire', type: VariableType.TEXT, source: VariableSource.CONTRACT, required: false },
  // --- Systeme (auto-remplies) ---
  { key: 'today', label: 'Date du jour', type: VariableType.DATE, source: VariableSource.SYSTEM, required: false },
  { key: 'city', label: 'Ville', type: VariableType.TEXT, source: VariableSource.SYSTEM, required: false },
  { key: 'signature_zone', label: 'Zone de signature', type: VariableType.TEXT, source: VariableSource.SYSTEM, required: false },
  { key: 'page_number', label: 'Numero de page', type: VariableType.TEXT, source: VariableSource.SYSTEM, required: false },
];

const BY_KEY = new Map(VARIABLE_CATALOGUE.map((v) => [v.key, v]));

/** Variables auto-remplies par le systeme (jamais requises cote client). */
export const SYSTEM_KEYS = new Set(
  VARIABLE_CATALOGUE.filter((v) => v.source === VariableSource.SYSTEM).map((v) => v.key),
);

export function getVariableDefinition(key: string): VariableDefinition | undefined {
  return BY_KEY.get(key);
}

/** Extrait les cles de variables presentes dans un corps ({{ key }}). */
export function extractVariableKeys(body: string): string[] {
  const found = new Set<string>();
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    found.add(match[1] as string);
  }
  return [...found];
}

/** Construit la liste des definitions pour les cles detectees dans un corps. */
export function resolveVariables(body: string): VariableDefinition[] {
  return extractVariableKeys(body).map(
    (key) =>
      BY_KEY.get(key) ?? {
        key,
        label: key,
        type: VariableType.TEXT,
        source: VariableSource.CONTRACT,
        required: false,
      },
  );
}
