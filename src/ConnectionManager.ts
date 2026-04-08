import { Redis } from 'ioredis';
import { WebSocket } from 'ws';
import { URL } from 'node:url';
import http from 'http';
import { REDIS_TRIPS_AVAILABLE_CHANNEL } from './types/trip';
import { UserType } from './generated/prisma/enums';
import jwt from 'jsonwebtoken';
import { JwtUberToken } from './types/express';
import { redisGeo } from './server';
import { REDIS_DRIVER_LOCATION, REDIS_DRIVER_LOCATION_PREFIX } from './types/drivers';
import { MessageService } from './services/messageService/MessageService';
import {
  driverUserIdToWsConnectionMap,
  riderUserIdToWsConnectionMap,
} from './services/messageService/utils';

export class ConnectionManager {
  // userId: Websocket map

  constructor(private redisSubscribe: Redis) {
    this.redisSubscribe.subscribe(REDIS_TRIPS_AVAILABLE_CHANNEL);
  }

  /*
   1. Connection setup (before the message)
  users connected earlier via WebSocket to ws://localhost:3000?userId=A
  When each connected, ConnectionManager.add() did two things:
  - Stored their socket in userIdToWsConnectionMap (userId → ws)
  - Subscribed Redis to the channel user:<userId> for that user
  * */
  handleConnection(ws: WebSocket, req: http.IncomingMessage, messageService: MessageService) {
    const verify = this.getUserId(ws, req);
    if (verify) {
      const { userId, userType } = verify;
      this.add(userId, userType, ws);
      this.incomingWebsocketMessagesListener(ws, userId, messageService);
      this.handleCloseConnection(ws, userId, userType);
    }
  }

  add(userId: string, userType: UserType, ws: WebSocket) {
    if (userType === UserType.DRIVER) {
      driverUserIdToWsConnectionMap.set(userId, ws);
    } else if (userType === UserType.RIDER) {
      riderUserIdToWsConnectionMap.set(userId, ws);
    }
  }

  incomingWebsocketMessagesListener(ws: WebSocket, userId: string, messageService: MessageService) {
    ws.on('message', async (message) => {
      messageService.handleIncomingWebsocketMessage(userId, message);
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
      riderUserIdToWsConnectionMap.delete(userId);
    } else if (userType === UserType.DRIVER) {
      driverUserIdToWsConnectionMap.delete(userId);
      redisGeo.zrem(REDIS_DRIVER_LOCATION, `${REDIS_DRIVER_LOCATION_PREFIX}${userId}`);
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
}
