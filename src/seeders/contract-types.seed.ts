import { ContractScope, RenewalMode } from '../domain/enums';

export interface ContractTypeSeed {
  code: string;
  label: string;
  scope: ContractScope;
  defaultRenewalMode: RenewalMode;
}

/**
 * Reference catalogue of contract types seeded on first run.
 *  - PERSONNEL: contracts between a school and its staff.
 *  - ETABLISSEMENT: contracts between EDUCA/Lizay and a school.
 */
export const CONTRACT_TYPE_SEED: ContractTypeSeed[] = [
  // --- Personnel ---
  { code: 'CDI', label: 'Contrat à durée indéterminée', scope: ContractScope.PERSONNEL, defaultRenewalMode: RenewalMode.MANUAL },
  { code: 'CDD', label: 'Contrat à durée déterminée', scope: ContractScope.PERSONNEL, defaultRenewalMode: RenewalMode.MANUAL },
  { code: 'STAGE', label: 'Convention de stage', scope: ContractScope.PERSONNEL, defaultRenewalMode: RenewalMode.MANUAL },
  { code: 'VACATION', label: 'Contrat de vacation', scope: ContractScope.PERSONNEL, defaultRenewalMode: RenewalMode.MANUAL },
  { code: 'PRESTATION', label: 'Contrat de prestation de service', scope: ContractScope.PERSONNEL, defaultRenewalMode: RenewalMode.MANUAL },

  // --- Établissement (EDUCA <-> école) ---
  { code: 'ABONNEMENT', label: 'Abonnement plateforme EDUCA', scope: ContractScope.ETABLISSEMENT, defaultRenewalMode: RenewalMode.AUTO },
  { code: 'SAAS_LICENCE', label: 'Licence SaaS', scope: ContractScope.ETABLISSEMENT, defaultRenewalMode: RenewalMode.AUTO },
  { code: 'MAINTENANCE', label: 'Contrat de maintenance', scope: ContractScope.ETABLISSEMENT, defaultRenewalMode: RenewalMode.AUTO },
  { code: 'ACCOMPAGNEMENT', label: 'Accompagnement / formation', scope: ContractScope.ETABLISSEMENT, defaultRenewalMode: RenewalMode.MANUAL },
  { code: 'PARTENARIAT', label: 'Accord de partenariat', scope: ContractScope.ETABLISSEMENT, defaultRenewalMode: RenewalMode.MANUAL },
  { code: 'CGU', label: "Conditions générales d'utilisation", scope: ContractScope.ETABLISSEMENT, defaultRenewalMode: RenewalMode.AUTO },
  { code: 'DPA', label: 'Data Processing Agreement', scope: ContractScope.ETABLISSEMENT, defaultRenewalMode: RenewalMode.AUTO },
];
