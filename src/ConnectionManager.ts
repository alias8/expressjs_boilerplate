import { Redis } from 'ioredis';
import { WebSocket as WsWebSocket, WebSocket } from 'ws';
import { URL } from 'node:url';
import http from 'http';
import { MessageService } from './MessageService';
import {
  REDIS_TRIP_KEY,
  REDIS_TRIPS_AVAILABLE_KEY,
  TRIP_ACCEPTED,
  TRIP_UPDATED,
  TripAcceptedMessage,
  UserType,
} from './types/trip';

export class ConnectionManager {
  // userId: Websocket map
  private riderUserIdToWsConnectionMap = new Map<string, WsWebSocket>();
  private driverUserIdToWsConnectionMap = new Map<string, WsWebSocket>();

  constructor(private redisSubscribe: Redis) {
    this.redisSubscribe.subscribe(REDIS_TRIPS_AVAILABLE_KEY);
    this.redisSubscribe.on('messageBuffer', async (channel, message) => {
      if (channel.toString().startsWith(REDIS_TRIP_KEY)) {
        // Rider gets updates on a trip
        const parsedMessages = JSON.parse(message.toString());
        if (parsedMessages.type === TRIP_ACCEPTED) {
          const riderId = (parsedMessages as TripAcceptedMessage).driver_id;
          this.riderUserIdToWsConnectionMap.get(riderId)?.send(message.toString());
        } else if (parsedMessages.type === TRIP_UPDATED) {
          // todo
        }
      } else if (channel.toString().startsWith(REDIS_TRIPS_AVAILABLE_KEY)) {
        // Drivers are told a new trip is available
        this.driverUserIdToWsConnectionMap.forEach((driver) => {
          driver.send(message.toString());
        });
      }
    });
  }

  /*
   1. Connection setup (before the message)
  users connected earlier via WebSocket to ws://localhost:3000?userId=A
  When each connected, ConnectionManager.add() did two things:
  - Stored their socket in userIdToWsConnectionMap (userId → ws)
  - Subscribed Redis to the channel user:<userId> for that user
  * */
  handleConnection(ws: WebSocket, req: http.IncomingMessage, messageService: MessageService) {
    const { userId, userType } = this.getUserId(ws, req) ?? {};
    if (userId && userType) {
      this.add(userId, userType, ws);
      this.handleIncomingWebsocketMessages(ws, messageService);
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

  handleIncomingWebsocketMessages(ws: WebSocket, messageService: MessageService) {
    ws.on('message', async (message) => {
      // todo: when rider or driver send a message over websocket to the server, handle it here
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

  getUserId(ws: WebSocket, req: http.IncomingMessage) {
    // client connects to ws://localhost:3000?userId=A&userType=driver
    const { url } = req;
    if (!url) {
      console.error(`No url in websocket req, closing connection`);
      ws.close();
      return;
    }
    const myUrl = new URL(url, 'http://localhost:3000');
    const params = myUrl.searchParams;
    const userId = params.get('userId');
    if (!userId) {
      console.error(`No userid in websocket url ${url}, closing connection`);
      ws.close();
      return;
    }
    const userType = params.get('userType');
    if (userType === null || !Object.values(UserType).includes(userType)) {
      console.error(`No userType in websocket url ${url}, closing connection`);
      ws.close();
      return;
    }
    return { userId, userType };
  }
}
