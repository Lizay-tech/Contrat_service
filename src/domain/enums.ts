/**
 * Domain enums. These are the single source of truth for the allowed values and
 * are mirrored by the PostgreSQL enum types created in the migrations.
 */

export enum ContractScope {
  PERSONNEL = 'PERSONNEL',
  ETABLISSEMENT = 'ETABLISSEMENT',
}

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

export const ALL_CONTRACT_STATUSES = Object.values(ContractStatus);
export const ALL_CONTRACT_SCOPES = Object.values(ContractScope);
