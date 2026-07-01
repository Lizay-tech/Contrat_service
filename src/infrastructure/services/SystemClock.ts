import { v4 as uuidv4 } from 'uuid';
import { IClock, IIdGenerator } from '../../application/ports/services';

export class SystemClock implements IClock {
  now(): Date {
    return new Date();
  }
}

export class UuidGenerator implements IIdGenerator {
  uuid(): string {
    return uuidv4();
  }
}
