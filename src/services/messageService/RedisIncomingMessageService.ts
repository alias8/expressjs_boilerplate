import {
  REDIS_TRIP_CHANNEL,
  REDIS_TRIPS_AVAILABLE_CHANNEL,
  TRIP_ACCEPTED,
  TRIP_AVAILABLE,
  TRIP_DROPPED_OFF,
  TRIP_PICKED_UP,
  TRIP_UPDATE_CURRENT_LOCATION,
  TripAcceptedMessage,
  TripAvailableMessage,
  TripUpdatedDropOffMessage,
  TripUpdatedNewLocationMessage,
  TripUpdatedPickUpMessage,
} from '../../types/trip';
import { redisGeo, redisSubscribe } from '../../server';
import { WebSocket } from 'ws';
import { driverUserIdToWsConnectionMap, riderUserIdToWsConnectionMap } from './utils';
import {
  REDIS_GEO_ACTIVE_DRIVER,
  REDIS_GEO_ACTIVE_RIDER,
  REDIS_GEO_KEY_USER_LOOKING_FOR_DRIVER,
} from '../../routes/trip/estimateTrip';
import { REDIS_DRIVER_LOCATION, REDIS_DRIVER_LOCATION_PREFIX } from '../../types/drivers';

type RedisMessageHandlerMessageTypes =
  | TripAvailableMessage
  | TripAcceptedMessage
  | TripUpdatedPickUpMessage
  | TripUpdatedNewLocationMessage
  | TripUpdatedDropOffMessage;
type RedisMessageHandler = (message: RedisMessageHandlerMessageTypes) => void;

export class RedisIncomingMessageService {
  // A map of channel prefix → (messageType → handler)
  private redisChannelsToWebsocketHandlersMap = new Map<string, Map<string, RedisMessageHandler>>();

  constructor() {
    this.setupHandlingOfRedisIncomingMessages();
    this.setupRedisSubscribeOnMessage();
    this.setupClearingRedisGeoRiderLookingForDriver();
  }

  setupClearingRedisGeoRiderLookingForDriver() {
    redisSubscribe.config('SET', 'notify-keyspace-events', 'Ex'); // Enable expired events
    redisSubscribe.subscribe('__keyevent@0__:expired');
  }

  // This is for handling when a message is published to redis through redis, what should the server do with it?
  // We need to send it to the appropriate websocket
  setupHandlingOfRedisIncomingMessages() {
    // This pattern is called Handler Registry (also known as a Command/Handler Map or Dispatch Table)
    this.registerHandlerForRedisChannel(REDIS_TRIP_CHANNEL, TRIP_ACCEPTED, (msg) => {
      this.sendMessageToRiderWebSocket(msg.rider_id, msg);
      this.sendMessageToAllDriversWebSocket(msg);
    });
    [TRIP_PICKED_UP, TRIP_DROPPED_OFF, TRIP_UPDATE_CURRENT_LOCATION].forEach((messageType) => {
      this.registerHandlerForRedisChannel(REDIS_TRIP_CHANNEL, messageType, (msg) => {
        this.sendMessageToRiderWebSocket(msg.rider_id, msg);
      });
    });
    this.registerHandlerForRedisChannel(REDIS_TRIPS_AVAILABLE_CHANNEL, TRIP_AVAILABLE, (msg) => {
      // todo: if drivers and riders had blocked each other, we should store this in a redis map and check it before broadcasting to each driver
      this.sendMessageToAllDriversWebSocket(msg);
    });
  }

  setupRedisSubscribeOnMessage() {
    redisSubscribe.on('message', (channel, message) => {
      if (channel === '__keyevent@0__:expired') {
        // When the TTL for redis expires every minute, this code will run
        if (message.startsWith(REDIS_GEO_ACTIVE_RIDER)) {
          const userId = message.replace(REDIS_GEO_ACTIVE_RIDER, '');
          redisGeo.zrem(REDIS_GEO_KEY_USER_LOOKING_FOR_DRIVER, userId);
        } else if (message.startsWith(REDIS_GEO_ACTIVE_DRIVER)) {
          const userId = message.replace(REDIS_GEO_ACTIVE_DRIVER, '');
          redisGeo.zrem(REDIS_DRIVER_LOCATION, `${REDIS_DRIVER_LOCATION_PREFIX}${userId}`);
        }
        return; // future expiry handlers go here
      }

      // All other channels carry JSON
      const parsed = JSON.parse(message.toString());
      const channelStr = channel.toString();
      for (const [prefix, messageTypeToHandlerMap] of this.redisChannelsToWebsocketHandlersMap) {
        if (channelStr.startsWith(prefix)) {
          const messageTypeHandler = messageTypeToHandlerMap.get(parsed.type);
          messageTypeHandler?.(parsed);
          break;
        }
      }
    });
  }

  // Register a handler
  registerHandlerForRedisChannel(
    channelPrefix: string,
    messageType: string,
    handler: RedisMessageHandler,
  ) {
    // eg. channelPrefix will be "trip:"
    if (!this.redisChannelsToWebsocketHandlersMap.has(channelPrefix)) {
      this.redisChannelsToWebsocketHandlersMap.set(channelPrefix, new Map());
    }
    // handlerMap for channel "trip:"
    const websocketHandlersForRedisChannel =
      this.redisChannelsToWebsocketHandlersMap.get(channelPrefix);
    if (websocketHandlersForRedisChannel !== undefined) {
      if (websocketHandlersForRedisChannel.has(messageType)) {
        throw new Error(
          `Redis channel to webSocket handler map error. Already registered for channel ${channelPrefix} and messageType: ${messageType}`,
        );
      }
      websocketHandlersForRedisChannel.set(messageType, handler);
    }
  }

  sendMessageToRiderWebSocket(riderId: string, message: object) {
    const socket = riderUserIdToWsConnectionMap.get(riderId);
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }
  sendMessageToAllDriversWebSocket(message: object) {
    driverUserIdToWsConnectionMap.forEach((driver) => {
      if (driver.readyState === WebSocket.OPEN) {
        driver.send(JSON.stringify(message));
      }
    });
  }
}
