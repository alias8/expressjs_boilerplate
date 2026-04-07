// Each overload declares a valid channel+message pairing
import { redisPublish } from '../server';
import {
  REDIS_TRIP_CHANNEL,
  REDIS_TRIPS_AVAILABLE_CHANNEL,
  TRIP_UPDATED_NEW_LOCATION,
  TripAcceptedMessage,
  TripAvailableMessage,
  TripUpdatedNewLocationMessage,
  TripUpdatedPickUpMessage,
} from '../types/trip';

export function publishToRedis(
  channel: `${typeof REDIS_TRIP_CHANNEL}${string}`,
  message: TripAcceptedMessage,
): void;
export function publishToRedis(
  channel: `${typeof REDIS_TRIP_CHANNEL}${string}`,
  message: TripUpdatedNewLocationMessage,
): void;
export function publishToRedis(
  channel: `${typeof REDIS_TRIP_CHANNEL}${string}`,
  message: TripUpdatedPickUpMessage,
): void;
export function publishToRedis(
  channel: typeof REDIS_TRIPS_AVAILABLE_CHANNEL,
  message: TripAvailableMessage,
): void;

// The actual implementation (not visible to callers)
export function publishToRedis(channel: string, message: object): void {
  redisPublish.publish(channel, JSON.stringify(message));
}
