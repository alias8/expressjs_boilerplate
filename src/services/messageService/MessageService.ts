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
import { prisma } from '../../db/prisma';
import { TripStatus } from '../../generated/prisma/enums';
import { publishToRedis } from '../../utils/redis';
import { redisGeo, redisSubscribe } from '../../server';
import { REDIS_DRIVER_LOCATION, REDIS_DRIVER_LOCATION_PREFIX } from '../../types/drivers';
import { type RawData, WebSocket } from 'ws';
import { driverUserIdToWsConnectionMap, riderUserIdToWsConnectionMap } from './utils';

type RedisMessageHandlerMessageTypes =
  | TripAvailableMessage
  | TripAcceptedMessage
  | TripUpdatedPickUpMessage
  | TripUpdatedNewLocationMessage
  | TripUpdatedDropOffMessage;
type RedisMessageHandler = (message: RedisMessageHandlerMessageTypes) => void;
type WebsocketMessageHandler = (message: object, userId: string) => void;

export class MessageService {
  // A map of channel prefix → (messageType → handler)
  private redisChannelsToWebsocketHandlersMap = new Map<string, Map<string, RedisMessageHandler>>();
  private webSocketMessageTypeToHandlerMap = new Map<string, WebsocketMessageHandler>();

  constructor() {
    this.setupHandlingOfRedisIncomingMessages();
    this.setupHandlingOfWebsocketIncomingMessages();
  }

  setupHandlingOfRedisIncomingMessages() {
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

    redisSubscribe.on('messageBuffer', (channel, message) => {
      const parsed = JSON.parse(message.toString());
      const channelStr = channel.toString(); // trip:123 or trips:available:syd

      for (const [prefix, messageTypeToHandlerMap] of this.redisChannelsToWebsocketHandlersMap) {
        // eg. channelStr is "trip:12345"
        // prefix is "trip:"
        if (channelStr.startsWith(prefix)) {
          const messageTypeHandler = messageTypeToHandlerMap.get(parsed.type);
          messageTypeHandler?.(parsed);
          break; // channels won't match two prefixes, so stop early
        }
      }
    });
  }

  setupHandlingOfWebsocketIncomingMessages() {
    this.registerHandlerForWebsocket(TRIP_UPDATE_CURRENT_LOCATION, async (msg, userId) => {
      await this.updateLocationHandler(msg, userId);
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

  async updateLocationHandler(msg: object, userId: string) {
    // when drivers send location updates about trip:uuid
    const { tripId, currentGPSLatitude, currentGPSLongitude } =
      msg as TripUpdatedNewLocationMessage;
    const trip = await prisma.trip.findFirst({
      where: {
        id: tripId,
        driver_id: userId,
        status: {
          in: [TripStatus.ACCEPTED, TripStatus.IN_PROGRESS],
        },
      },
    });
    if (trip) {
      const messageToSend: TripUpdatedNewLocationMessage = {
        type: TRIP_UPDATE_CURRENT_LOCATION,
        tripId: trip.id,
        rider_id: trip.rider_id,
        currentGPSLatitude,
        currentGPSLongitude,
      };
      publishToRedis(`${REDIS_TRIP_CHANNEL}${tripId}`, messageToSend);
    }
    // Update redis for available drivers
    redisGeo.geoadd(
      REDIS_DRIVER_LOCATION,
      currentGPSLongitude, // longitude first
      currentGPSLatitude, // latitude second
      `${REDIS_DRIVER_LOCATION_PREFIX}${userId}`,
    );
  }

  registerHandlerForWebsocket(messageType: string, handler: WebsocketMessageHandler) {
    if (this.webSocketMessageTypeToHandlerMap.has(messageType)) {
      throw new Error(`WebSocket handler already registered for messageType: ${messageType}`);
    }
    this.webSocketMessageTypeToHandlerMap.set(messageType, handler);
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

  handleIncomingWebsocketMessage(userId: string, message: RawData) {
    try {
      const parsedMessage = JSON.parse(message.toString());
      const webSocketHandler = this.webSocketMessageTypeToHandlerMap.get(parsedMessage.type);
      webSocketHandler?.(parsedMessage, userId);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      console.error(`Error when handling message, ${errorMessage}`);
    }
  }
}
