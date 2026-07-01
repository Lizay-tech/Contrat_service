/**
 * Types partages et enumerations metier (source unique de verite cote code).
 * Alignes avec les ENUM PostgreSQL definis dans les migrations.
 */

/** Portee du type de contrat. */
export enum ContractScope {
  PERSONNEL = 'PERSONNEL',
  ETABLISSEMENT = 'ETABLISSEMENT',
}

/** Etats du cycle de vie d'un contrat (machine a etats, cf. domain). */
export enum ContractStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  PENDING_SIGNATURE = 'PENDING_SIGNATURE',
  ACTIVE = 'ACTIVE',
  AMENDED = 'AMENDED',
  EXPIRING = 'EXPIRING',
  RENEWED = 'RENEWED',
  EXPIRED = 'EXPIRED',
  TERMINATED = 'TERMINATED',
  CANCELLED = 'CANCELLED',
  ARCHIVED = 'ARCHIVED',
}

export enum RenewalMode {
  AUTO = 'AUTO',
  MANUAL = 'MANUAL',
}

export enum PartyType {
  PERSON = 'PERSON',
  SCHOOL = 'SCHOOL',
  ORG = 'ORG',
}

export enum RoleInContract {
  EMPLOYEUR = 'EMPLOYEUR',
  EMPLOYE = 'EMPLOYE',
  PRESTATAIRE = 'PRESTATAIRE',
  CLIENT = 'CLIENT',
  FOURNISSEUR = 'FOURNISSEUR',
  TEMOIN = 'TEMOIN',
}

export enum DocumentType {
  ORIGINAL = 'ORIGINAL',
  ANNEXE = 'ANNEXE',
  SIGNE = 'SIGNE',
}

/** Contexte d'authentification extrait du JWT (claims camelCase EDUCA). */
export interface AuthContext {
  userId: string;
  schoolId: string;
  roleCode: string;
}

/** Contexte de tenant resolu pour la requete (clef RLS). */
export interface TenantContext {
  tenantSchoolId: string;
}

export const enumValues = {
  ContractScope: Object.values(ContractScope),
  ContractStatus: Object.values(ContractStatus),
  RenewalMode: Object.values(RenewalMode),
  PartyType: Object.values(PartyType),
  RoleInContract: Object.values(RoleInContract),
  DocumentType: Object.values(DocumentType),
} as const;
