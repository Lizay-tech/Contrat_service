import { IUnitOfWork } from './ports/TxContext';
import {
  IAuditLogRepository,
  IContractDocumentRepository,
  IContractPartyRepository,
  IContractRepository,
  IContractTypeRepository,
  IStatusHistoryRepository,
} from './ports/repositories';
import {
  IAnneeScolaireProvider,
  IClock,
  IEventPublisher,
  IFileStorage,
  IIdGenerator,
  IPdfGenerator,
} from './ports/services';

/**
 * Dependency bundle injected into every use-case. Wiring happens once in the
 * composition root (infrastructure/container).
 */
export interface UseCaseDeps {
  uow: IUnitOfWork;
  contractRepo: IContractRepository;
  contractTypeRepo: IContractTypeRepository;
  partyRepo: IContractPartyRepository;
  documentRepo: IContractDocumentRepository;
  historyRepo: IStatusHistoryRepository;
  auditRepo: IAuditLogRepository;
  events: IEventPublisher;
  anneeScolaire: IAnneeScolaireProvider;
  fileStorage: IFileStorage;
  pdf: IPdfGenerator;
  clock: IClock;
  ids: IIdGenerator;
}
