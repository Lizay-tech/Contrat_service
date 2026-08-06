import amqp, { type Channel, type ChannelModel } from 'amqplib';
import { env } from '../../shared/config/env';
import { logger } from '../../shared/config/logger';

/**
 * Bus d'evenements RabbitMQ. Exchange topic `educa.contracts` (durable).
 * La publication est best-effort: une panne du bus ne doit pas casser une
 * ecriture DB deja committee (on log l'echec, on ne remonte pas d'exception).
 */
let connection: ChannelModel | null = null;
let channel: Channel | null = null;

export async function connectRabbitMQ(): Promise<void> {
  if (channel) return;
  connection = await amqp.connect(env.rabbitmq.url);
  channel = await connection.createChannel();
  await channel.assertExchange(env.rabbitmq.exchange, 'topic', { durable: true });

  connection.on('error', (err) => logger.error({ err }, '[rabbitmq] erreur connexion'));
  connection.on('close', () => {
    logger.warn('[rabbitmq] connexion fermee');
    channel = null;
    connection = null;
  });

  logger.info({ exchange: env.rabbitmq.exchange }, '[rabbitmq] Connexion etablie');
}

export async function disconnectRabbitMQ(): Promise<void> {
  try {
    await channel?.close();
    await connection?.close();
  } catch (err) {
    logger.warn({ err }, '[rabbitmq] fermeture');
  } finally {
    channel = null;
    connection = null;
  }
}

/** Publie un message sur l'exchange topic. Retourne false si le bus est indisponible. */
export function publish(routingKey: string, payload: unknown): boolean {
  if (!channel) {
    logger.warn({ routingKey }, '[rabbitmq] canal indisponible, message non publie');
    return false;
  }
  const buffer = Buffer.from(JSON.stringify(payload));
  return channel.publish(env.rabbitmq.exchange, routingKey, buffer, {
    contentType: 'application/json',
    persistent: true,
  });
}

export function rabbitHealthy(): boolean {
  return channel !== null && connection !== null;
}
