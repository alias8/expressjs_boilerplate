import { Redis } from 'ioredis';
import { WebSocket as WsWebSocket, WebSocket } from 'ws';
import { URL } from 'node:url';
import http from 'http';
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
} from './types/trip';
import { TripStatus, UserType } from './generated/prisma/enums';
import jwt from 'jsonwebtoken';
import { JwtUberToken } from './types/express';
import { prisma } from './db/prisma';
import { publishToRedis } from './utils/redis';

type RedisMessageHandlerMessageTypes =
  | TripAvailableMessage
  | TripAcceptedMessage
  | TripUpdatedPickUpMessage
  | TripUpdatedNewLocationMessage
  | TripUpdatedDropOffMessage;
type RedisMessageHandler = (message: RedisMessageHandlerMessageTypes) => void;
type WebsocketMessageHandler = (message: object, userId: string) => void;

export class ConnectionManager {
  // userId: Websocket map
  private riderUserIdToWsConnectionMap = new Map<string, WsWebSocket>();
  private driverUserIdToWsConnectionMap = new Map<string, WsWebSocket>();
  // A map of channel prefix → (messageType → handler)
  private redisChannelsToWebsocketHandlersMap = new Map<string, Map<string, RedisMessageHandler>>();
  private webSocketMessageTypeToHandlerMap = new Map<string, WebsocketMessageHandler>();

  constructor(private redisSubscribe: Redis) {
    this.redisSubscribe.subscribe(REDIS_TRIPS_AVAILABLE_CHANNEL);

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

    this.registerHandlerForWebsocket(TRIP_UPDATE_CURRENT_LOCATION, async (msg, userId) => {
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
    });

    this.redisSubscribe.on('messageBuffer', (channel, message) => {
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

  registerHandlerForWebsocket(messageType: string, handler: WebsocketMessageHandler) {
    if (this.webSocketMessageTypeToHandlerMap.has(messageType)) {
      throw new Error(`WebSocket handler already registered for messageType: ${messageType}`);
    }
    this.webSocketMessageTypeToHandlerMap.set(messageType, handler);
  }

  /*
   1. Connection setup (before the message)
  users connected earlier via WebSocket to ws://localhost:3000?userId=A
  When each connected, ConnectionManager.add() did two things:
  - Stored their socket in userIdToWsConnectionMap (userId → ws)
  - Subscribed Redis to the channel user:<userId> for that user
  * */
  handleConnection(ws: WebSocket, req: http.IncomingMessage) {
    const verify = this.getUserId(ws, req);
    if (verify) {
      const { userId, userType } = verify;
      this.add(userId, userType, ws);
      this.handleIncomingWebsocketMessages(ws, userId);
      this.handleCloseConnection(ws, userId, userType);
    }
  }

  add(userId: string, userType: UserType, ws: WebSocket) {
    if (userType === UserType.DRIVER) {
      this.driverUserIdToWsConnectionMap.set(userId, ws);
    } else if (userType === UserType.RIDER) {
      this.riderUserIdToWsConnectionMap.set(userId, ws);
      // todo: do riders need to sub to anything yet?
    }
  }

  handleIncomingWebsocketMessages(ws: WebSocket, userId: string) {
    ws.on('message', async (message) => {
      try {
        const parsedMessage = JSON.parse(message.toString());
        const webSocketHandler = this.webSocketMessageTypeToHandlerMap.get(parsedMessage.type);
        webSocketHandler?.(parsedMessage, userId);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        console.error(`Error when handling message, ${errorMessage}`);
      }
    });
  }

  handleCloseConnection(ws: WebSocket, userId: string, userType: UserType) {
    ws.on('close', async () => {
      await this.remove(userId, userType);
    });
  }

  async remove(userId: string, userType: UserType) {
    // 1. Remove userId from websocket connection map
    if (userType === UserType.RIDER) {
      this.riderUserIdToWsConnectionMap.delete(userId);
    } else if (userType === UserType.DRIVER) {
      this.driverUserIdToWsConnectionMap.delete(userId);
    }
  }

  getUserId(
    ws: WebSocket,
    req: http.IncomingMessage,
  ): false | { userId: string; userType: UserType } {
    const { url } = req;
    if (!url) {
      console.error(`No url in websocket req, closing connection`);
      ws.close();
      return false;
    }
    const myUrl = new URL(url, 'http://localhost:3000');
    const params = myUrl.searchParams;
    const jwtToken = params.get('token');
    if (!jwtToken) {
      console.error(`Jwt token not present in url`);
      return false;
    }

    try {
      const decodedToken = jwt.verify(jwtToken, process.env.JWT_SECRET!);
      if (typeof decodedToken != 'string' && decodedToken !== undefined) {
        const { userId, userType } = decodedToken as JwtUberToken;
        if (userType !== UserType.DRIVER && userType !== UserType.RIDER) {
          console.error(`userType in jwt must be ${UserType.DRIVER} or ${UserType.RIDER}`);
          return false;
        }
        return { userId, userType: userType as UserType };
      }
      return false;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      console.error(`Error during websocket connection ${message}`);
      return false;
    }
  }

  sendMessageToRiderWebSocket(riderId: string, message: object) {
    const socket = this.riderUserIdToWsConnectionMap.get(riderId);
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }
  sendMessageToAllDriversWebSocket(message: object) {
    this.driverUserIdToWsConnectionMap.forEach((driver) => {
      if (driver.readyState === WebSocket.OPEN) {
        driver.send(JSON.stringify(message));
      }
    });
  }
}
