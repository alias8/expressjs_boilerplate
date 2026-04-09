import { REDIS_TRIP_CHANNEL, TRIP_UPDATE_CURRENT_LOCATION, TripUpdatedNewLocationMessage, } from '../../types/trip';
import { prisma } from '../../db/prisma';
import { TripStatus } from '../../generated/prisma/enums';
import { publishToRedis } from '../../utils/redis';
import { redisGeo } from '../../server';
import { REDIS_DRIVER_LOCATION, REDIS_DRIVER_LOCATION_PREFIX } from '../../types/drivers';
import type { RawData } from 'ws';
import { UserId } from '../../types/user';

type WebsocketMessageHandler = (message: object, userId: UserId) => void;

export class WebSocketIncomingMessageService {
  private webSocketMessageTypeToHandlerMap = new Map<string, WebsocketMessageHandler>();

  constructor() {
    // This is for handling when a driver or rider sends information over websocket to the server
    this.registerHandlerForWebsocket(TRIP_UPDATE_CURRENT_LOCATION, async (msg, userId) => {
      await this.updateDriverLocationHandler(msg, userId);
    });
  }

  registerHandlerForWebsocket(messageType: string, handler: WebsocketMessageHandler) {
    if (this.webSocketMessageTypeToHandlerMap.has(messageType)) {
      throw new Error(`WebSocket handler already registered for messageType: ${messageType}`);
    }
    this.webSocketMessageTypeToHandlerMap.set(messageType, handler);
  }

  async updateDriverLocationHandler(msg: object, userId: UserId) {
    // when drivers send location updates about trip:uuid
    const { tripId, currentGPSLatitude, currentGPSLongitude } =
      msg as TripUpdatedNewLocationMessage;
    const trip = await prisma.trip.findFirst({
      where: {
        id: tripId,
        accepted_by: { user_id: userId },
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
    // Update position regardless of active trip — keeps geo pool fresh for matching
    redisGeo.geoadd(
      REDIS_DRIVER_LOCATION,
      currentGPSLongitude, // longitude first
      currentGPSLatitude, // latitude second
      `${REDIS_DRIVER_LOCATION_PREFIX}${userId}`,
    );
  }

  handleIncomingWebsocketMessage(userId: UserId, message: RawData) {
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
