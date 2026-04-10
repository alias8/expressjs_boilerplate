import { redisPublish } from '../server';

export function publishToRedis(channel: string, message: object): void {
  redisPublish.publish(channel, JSON.stringify(message));
}
