import Redis from 'ioredis';
import { SOCKET_BRIDGE_CHANNEL, SocketBridgeMessage } from '@mira/shared-types';
import { config } from './config';

const publisher = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
});

export async function closeSocketPublisher(): Promise<void> {
  await publisher.quit();
}

export async function writeWorkerStatus(status: unknown): Promise<void> {
  await publisher.set(`${config.queuePrefix}:runtime:worker`, JSON.stringify(status), 'EX', 45);
}

export async function publishSocketEvent(
  room: string,
  event: string,
  data: unknown,
): Promise<void> {
  const message: SocketBridgeMessage = { room, event, data };
  await publisher.publish(SOCKET_BRIDGE_CHANNEL, JSON.stringify(message));
}
