import { WebSocket } from 'ws';
import http from 'http';
import { REDIS_TRIPS_AVAILABLE_CHANNEL } from './types/trip';
import { UserType } from './generated/prisma/enums';
import { redisGeo, redisSubscribe } from './server';
import { REDIS_DRIVER_LOCATION, REDIS_DRIVER_LOCATION_PREFIX } from './types/drivers';
import {
  driverUserIdToWsConnectionMap,
  riderUserIdToWsConnectionMap,
} from './services/messageService/utils';
import { getUserIdFromWebsocket } from './middleware/auth';
import { WebSocketIncomingMessageService } from './services/messageService/WebSocketIncomingMessageService';

export class WebsocketConnectionManager {
  constructor() {
    redisSubscribe.subscribe(REDIS_TRIPS_AVAILABLE_CHANNEL);
  }

  /*
   1. Connection setup (before the message)
  users connected earlier via WebSocket to ws://localhost:3000?userId=A
  When each connected, ConnectionManager.add() did two things:
  - Stored their socket in userIdToWsConnectionMap (userId → ws)
  - Subscribed Redis to the channel user:<userId> for that user
  * */
  handleConnection(
    ws: WebSocket,
    req: http.IncomingMessage,
    webSocketMessageService: WebSocketIncomingMessageService,
  ) {
    const verify = getUserIdFromWebsocket(ws, req);
    if (verify) {
      const { userId, userType } = verify;
      this.add(userId, userType, ws);
      // incoming Websocket Messages Listener
      ws.on('message', async (message) => {
        webSocketMessageService.handleIncomingWebsocketMessage(userId, message);
      });
      // handle websocket Close Connection
      ws.on('close', async () => {
        await this.remove(userId, userType);
      });
    }
  }

  add(userId: string, userType: UserType, ws: WebSocket) {
    if (userType === UserType.DRIVER) {
      driverUserIdToWsConnectionMap.set(userId, ws);
    } else if (userType === UserType.RIDER) {
      riderUserIdToWsConnectionMap.set(userId, ws);
    }
  }

  async remove(userId: string, userType: UserType) {
    // 1. Remove userId from websocket connection map
    if (userType === UserType.RIDER) {
      riderUserIdToWsConnectionMap.delete(userId);
    } else if (userType === UserType.DRIVER) {
      driverUserIdToWsConnectionMap.delete(userId);
      redisGeo.zrem(REDIS_DRIVER_LOCATION, `${REDIS_DRIVER_LOCATION_PREFIX}${userId}`);
    }
  }
}
