import { UseCaseDeps } from '../application/deps';
import { CreateContract } from '../application/use-cases/CreateContract';
import { ListContracts } from '../application/use-cases/ListContracts';
import { GetContract } from '../application/use-cases/GetContract';
import { UpdateContract } from '../application/use-cases/UpdateContract';
import { TransitionContractStatus } from '../application/use-cases/TransitionContractStatus';
import { AddParty } from '../application/use-cases/AddParty';
import { RemoveParty } from '../application/use-cases/RemoveParty';
import { AttachDocument } from '../application/use-cases/AttachDocument';
import { DownloadDocument } from '../application/use-cases/DownloadDocument';
import { GetContractHistory } from '../application/use-cases/GetContractHistory';
import { ListContractTypes } from '../application/use-cases/ListContractTypes';

import { SequelizeUnitOfWork } from './database/UnitOfWork';
import { ContractRepository } from './repositories/ContractRepository';
import { ContractTypeRepository } from './repositories/ContractTypeRepository';
import { ContractPartyRepository } from './repositories/ContractPartyRepository';
import { ContractDocumentRepository } from './repositories/ContractDocumentRepository';
import { StatusHistoryRepository } from './repositories/StatusHistoryRepository';
import { AuditLogRepository } from './repositories/AuditLogRepository';
import { RabbitMqPublisher } from './messaging/RabbitMqPublisher';
import { AnneeScolaireProvider } from './services/AnneeScolaireProvider';
import { LocalFileStorage } from './storage/LocalFileStorage';
import { PdfKitGenerator } from './pdf/PdfKitGenerator';
import { SystemClock, UuidGenerator } from './services/SystemClock';
import { redis } from './redis/redisClient';

export interface UseCases {
  listContractTypes: ListContractTypes;
  createContract: CreateContract;
  listContracts: ListContracts;
  getContract: GetContract;
  updateContract: UpdateContract;
  transitionContractStatus: TransitionContractStatus;
  addParty: AddParty;
  removeParty: RemoveParty;
  attachDocument: AttachDocument;
  downloadDocument: DownloadDocument;
  getContractHistory: GetContractHistory;
}

export interface Container {
  deps: UseCaseDeps;
  useCases: UseCases;
  events: RabbitMqPublisher;
}

/** Composition root: builds all adapters + use-cases once, at boot. */
export function buildContainer(): Container {
  const events = new RabbitMqPublisher();

  const deps: UseCaseDeps = {
    uow: new SequelizeUnitOfWork(),
    contractRepo: new ContractRepository(),
    contractTypeRepo: new ContractTypeRepository(),
    partyRepo: new ContractPartyRepository(),
    documentRepo: new ContractDocumentRepository(),
    historyRepo: new StatusHistoryRepository(),
    auditRepo: new AuditLogRepository(),
    events,
    anneeScolaire: new AnneeScolaireProvider(redis),
    fileStorage: new LocalFileStorage(),
    pdf: new PdfKitGenerator(),
    clock: new SystemClock(),
    ids: new UuidGenerator(),
  };

  const useCases: UseCases = {
    listContractTypes: new ListContractTypes(deps),
    createContract: new CreateContract(deps),
    listContracts: new ListContracts(deps),
    getContract: new GetContract(deps),
    updateContract: new UpdateContract(deps),
    transitionContractStatus: new TransitionContractStatus(deps),
    addParty: new AddParty(deps),
    removeParty: new RemoveParty(deps),
    attachDocument: new AttachDocument(deps),
    downloadDocument: new DownloadDocument(deps),
    getContractHistory: new GetContractHistory(deps),
  };

  return { deps, useCases, events };
}
