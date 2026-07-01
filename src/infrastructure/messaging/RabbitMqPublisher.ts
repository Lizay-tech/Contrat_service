import amqplib, { Channel, ChannelModel } from 'amqplib';
import { DomainEvent, IEventPublisher } from '../../application/ports/services';
import { env } from '../../shared/config/env';
import { logger } from '../../shared/logger';

/**
 * Publishes contract lifecycle events to the `educa.contracts` topic exchange.
 * Uses a persistent connection + confirm channel; publishing never throws to the
 * caller (a failed publish is logged, the business transaction already committed).
 */
export class RabbitMqPublisher implements IEventPublisher {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  async connect(): Promise<void> {
    if (this.channel) return;
    this.connection = await amqplib.connect(env.rabbitmq.url);
    this.connection.on('error', (err) => logger.error({ err }, 'RabbitMQ conn error'));
    this.connection.on('close', () => {
      logger.warn('RabbitMQ connection closed');
      this.channel = null;
      this.connection = null;
    });
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(env.rabbitmq.exchange, env.rabbitmq.exchangeType, {
      durable: true,
    });
    logger.info({ exchange: env.rabbitmq.exchange }, 'RabbitMQ publisher ready');
  }

  async publish(event: DomainEvent): Promise<void> {
    try {
      if (!this.channel) await this.connect();
      const payload = Buffer.from(JSON.stringify(event.payload));
      this.channel!.publish(env.rabbitmq.exchange, event.routingKey, payload, {
        contentType: 'application/json',
        persistent: true,
        timestamp: Date.now(),
      });
      logger.debug({ routingKey: event.routingKey }, 'Event published');
    } catch (err) {
      logger.error({ err, routingKey: event.routingKey }, 'Failed to publish event');
    }
  }

  isHealthy(): boolean {
    return this.channel !== null;
  }

  async close(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch (err) {
      logger.warn({ err }, 'Error closing RabbitMQ');
    } finally {
      this.channel = null;
      this.connection = null;
    }
  }
}
