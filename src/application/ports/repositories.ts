import { Contract } from '../../domain/contract/Contract';
import {
  ContractScope,
  ContractStatus,
  DocumentType,
  PartyType,
  RenewalMode,
  RoleInContract,
} from '../../domain/enums';
import { TxContext } from './TxContext';

// --- Contract types (reference data) ---
export interface ContractTypeRecord {
  id: string;
  code: string;
  label: string;
  scope: ContractScope;
  defaultRenewalMode: RenewalMode;
  active: boolean;
}

export interface IContractTypeRepository {
  listActive(tx: TxContext): Promise<ContractTypeRecord[]>;
  findById(id: string, tx: TxContext): Promise<ContractTypeRecord | null>;
}

// --- Contracts ---
export interface ContractListFilter {
  status?: ContractStatus;
  contractTypeId?: string;
  scope?: ContractScope;
  subjectSchoolId?: string;
  startDateFrom?: Date;
  startDateTo?: Date;
  search?: string; // matches title / contract_number
  page: number;
  limit: number;
}

export interface IContractRepository {
  /** Reserves the next per-tenant sequence value (monotonic). */
  nextSequence(tenantSchoolId: string, tx: TxContext): Promise<number>;
  create(contract: Contract, tx: TxContext): Promise<Contract>;
  findById(id: string, tx: TxContext): Promise<Contract | null>;
  update(contract: Contract, tx: TxContext): Promise<Contract>;
  list(
    filter: ContractListFilter,
    tx: TxContext,
  ): Promise<{ items: Contract[]; total: number }>;
}

// --- Parties ---
export interface CreatePartyInput {
  id: string;
  tenantSchoolId: string;
  contractId: string;
  partyType: PartyType;
  personUserId: string | null;
  schoolId: string | null;
  roleInContract: RoleInContract;
  fullName: string;
  email: string | null;
}

export interface PartyRecord extends CreatePartyInput {
  createdAt: Date;
}

export interface IContractPartyRepository {
  create(input: CreatePartyInput, tx: TxContext): Promise<PartyRecord>;
  listByContract(contractId: string, tx: TxContext): Promise<PartyRecord[]>;
  findById(id: string, tx: TxContext): Promise<PartyRecord | null>;
  softDelete(id: string, tx: TxContext): Promise<void>;
}

// --- Documents ---
export interface CreateDocumentInput {
  id: string;
  tenantSchoolId: string;
  contractId: string;
  type: DocumentType;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  sha256Hash: string;
  version: number;
  uploadedBy: string;
}

export interface DocumentRecord extends CreateDocumentInput {
  createdAt: Date;
}

export interface IContractDocumentRepository {
  create(input: CreateDocumentInput, tx: TxContext): Promise<DocumentRecord>;
  listByContract(contractId: string, tx: TxContext): Promise<DocumentRecord[]>;
  findById(id: string, tx: TxContext): Promise<DocumentRecord | null>;
  /** Highest existing version number for a contract's documents (0 if none). */
  maxVersion(contractId: string, tx: TxContext): Promise<number>;
}

// --- Status history ---
export interface StatusHistoryRecord {
  id: string;
  tenantSchoolId: string;
  contractId: string;
  fromStatus: ContractStatus | null;
  toStatus: ContractStatus;
  changedBy: string;
  reason: string | null;
  changedAt: Date;
}

export interface IStatusHistoryRepository {
  append(
    input: Omit<StatusHistoryRecord, 'id' | 'changedAt'> & { id: string },
    tx: TxContext,
  ): Promise<void>;
  listByContract(contractId: string, tx: TxContext): Promise<StatusHistoryRecord[]>;
}

// --- Audit (immutable) ---
export interface AuditLogInput {
  id: string;
  tenantSchoolId: string;
  entityType: string;
  entityId: string;
  action: string;
  actorUserId: string | null;
  payload: Record<string, unknown>;
  ip: string | null;
}

export interface AuditLogRecord extends AuditLogInput {
  createdAt: Date;
}

export interface IAuditLogRepository {
  record(input: AuditLogInput, tx: TxContext): Promise<void>;
  listByEntity(
    entityType: string,
    entityId: string,
    tx: TxContext,
  ): Promise<AuditLogRecord[]>;
}
