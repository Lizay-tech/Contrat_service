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

// ----- Templates (Phase 2) -----

export enum TemplateScopeOwner {
  PREDEFINED = 'PREDEFINED',
  SCHOOL = 'SCHOOL',
}

export enum TemplateStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum VariableType {
  TEXT = 'text',
  DATE = 'date',
  NUMBER = 'number',
  CURRENCY = 'currency',
  IMAGE = 'image',
}

export enum VariableSource {
  EMPLOYEE = 'EMPLOYEE',
  SCHOOL = 'SCHOOL',
  CONTRACT = 'CONTRACT',
  SYSTEM = 'SYSTEM',
}

// ----- Signature electronique (Phase 2) -----

export enum SignatureMode {
  SEQUENTIAL = 'SEQUENTIAL',
  PARALLEL = 'PARALLEL',
}

export enum SignatureRequestStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum SignatoryStatus {
  PENDING = 'PENDING',
  SIGNED = 'SIGNED',
  REFUSED = 'REFUSED',
  EXPIRED = 'EXPIRED',
}

export enum SignatureType {
  TEXT = 'TEXT',
  DRAWN = 'DRAWN',
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
  TemplateScopeOwner: Object.values(TemplateScopeOwner),
  TemplateStatus: Object.values(TemplateStatus),
  SignatureMode: Object.values(SignatureMode),
  SignatureRequestStatus: Object.values(SignatureRequestStatus),
  SignatoryStatus: Object.values(SignatoryStatus),
  SignatureType: Object.values(SignatureType),
} as const;
