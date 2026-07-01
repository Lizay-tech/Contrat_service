import path from 'path';
import os from 'os';
import { Express } from 'express';
import { createApp } from '../../src/app';
import { Container, UseCases } from '../../src/infrastructure/container';
import { UseCaseDeps } from '../../src/application/deps';
import { DomainEvent } from '../../src/application/ports/services';
import { SequelizeUnitOfWork } from '../../src/infrastructure/database/UnitOfWork';
import { ContractRepository } from '../../src/infrastructure/repositories/ContractRepository';
import { ContractTypeRepository } from '../../src/infrastructure/repositories/ContractTypeRepository';
import { ContractPartyRepository } from '../../src/infrastructure/repositories/ContractPartyRepository';
import { ContractDocumentRepository } from '../../src/infrastructure/repositories/ContractDocumentRepository';
import { StatusHistoryRepository } from '../../src/infrastructure/repositories/StatusHistoryRepository';
import { AuditLogRepository } from '../../src/infrastructure/repositories/AuditLogRepository';
import { LocalFileStorage } from '../../src/infrastructure/storage/LocalFileStorage';
import { PdfKitGenerator } from '../../src/infrastructure/pdf/PdfKitGenerator';
import { SystemClock, UuidGenerator } from '../../src/infrastructure/services/SystemClock';

import { CreateContract } from '../../src/application/use-cases/CreateContract';
import { ListContracts } from '../../src/application/use-cases/ListContracts';
import { GetContract } from '../../src/application/use-cases/GetContract';
import { UpdateContract } from '../../src/application/use-cases/UpdateContract';
import { TransitionContractStatus } from '../../src/application/use-cases/TransitionContractStatus';
import { AddParty } from '../../src/application/use-cases/AddParty';
import { RemoveParty } from '../../src/application/use-cases/RemoveParty';
import { AttachDocument } from '../../src/application/use-cases/AttachDocument';
import { DownloadDocument } from '../../src/application/use-cases/DownloadDocument';
import { GetContractHistory } from '../../src/application/use-cases/GetContractHistory';
import { ListContractTypes } from '../../src/application/use-cases/ListContractTypes';

/** Captured events, so tests can assert on what would be published. */
export const publishedEvents: DomainEvent[] = [];

/**
 * Builds a container backed by the real DB (repositories + UoW) but with the
 * external side-effects stubbed: events are captured in-memory, the active-year
 * lookup returns null. Only PostgreSQL is required to run these tests.
 */
export function buildTestApp(): { app: Express; container: Container } {
  const events = {
    isHealthy: () => true,
    async connect() {
      /* no-op */
    },
    async close() {
      /* no-op */
    },
    async publish(event: DomainEvent) {
      publishedEvents.push(event);
    },
  };

  const deps: UseCaseDeps = {
    uow: new SequelizeUnitOfWork(),
    contractRepo: new ContractRepository(),
    contractTypeRepo: new ContractTypeRepository(),
    partyRepo: new ContractPartyRepository(),
    documentRepo: new ContractDocumentRepository(),
    historyRepo: new StatusHistoryRepository(),
    auditRepo: new AuditLogRepository(),
    events,
    anneeScolaire: { async getActiveYearId() { return null; } },
    fileStorage: new LocalFileStorage(path.join(os.tmpdir(), 'contrat-test-uploads')),
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

  // Cast: the container's `events` type is RabbitMqPublisher; our stub is
  // structurally compatible for the surface the app/health uses.
  const container = { deps, useCases, events } as unknown as Container;
  return { app: createApp(container), container };
}
