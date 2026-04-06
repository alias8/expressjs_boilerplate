import { Redis } from 'ioredis';
import { WebSocket as WsWebSocket, WebSocket } from 'ws';
import { URL } from 'node:url';
import http from 'http';
import { MessageService } from './MessageService';
import { HARD_CODED_CITY } from './routes/trip';

export const REDIS_TRIP_KEY = 'trip:';
export const REDIS_TRIPS_AVAILABLE_KEY = `trips:available:${HARD_CODED_CITY}`;

export class ConnectionManager {
  // userId: Websocket map
  private userIdToWsConnectionMap = new Map<string, WsWebSocket>();
  // a map of conversationId → Set of userIds connected on this server
  private conversationIdToUsersMap = new Map<string, Set<string>>();

  constructor(private redisSubscribe: Redis) {
    this.redisSubscribe.on('messageBuffer', async (channel, message) => {
      if (channel.toString().startsWith(REDIS_TRIP_KEY)) {
        // Rider gets updates on a trip
        const tripId = channel.toString().replace(REDIS_TRIP_KEY, '');
        this.getSocket(tripId)?.send(message.toString());
      } else if (channel.toString().startsWith(REDIS_TRIPS_AVAILABLE_KEY)) {
        // Drivers are told a new trip is available
        const userIds = this.conversationIdToUsersMap.get(REDIS_TRIPS_AVAILABLE_KEY) ?? [];
        for (const userId of userIds) {
          this.getSocket(userId)?.send(message.toString());
        }
      }
    });
  }

  /*
   1. Connection setup (before the message)
  Both users connected earlier via WebSocket to ws://localhost:3000?userId=A and ws://localhost:3001?userId=B.
  When each connected, ConnectionManager.add() did two things:
  - Stored their socket in userIdToWsConnectionMap (userId → ws)
  - Subscribed Redis to the channel user:<userId> for that user
  * */
  handleConnection(ws: WebSocket, req: http.IncomingMessage, messageService: MessageService) {
    const userId = this.getUserId(ws, req);
    if (userId) {
      this.add(userId, ws);
      this.handleMessages(ws, messageService);
      this.handleCloseConnection(ws, userId);
    }
  }

  add(userId: string, ws: WebSocket) {
    this.userIdToWsConnectionMap.set(userId, ws);
    this.redisSubscribe.subscribe(`user:${userId}`, (err, count) => {
      if (err) {
        console.error('Failed to subscribe: %s', err.message);
      } else {
        console.log(
          `Subscribed successfully! This client is currently subscribed to ${count} channels.`,
        );
      }
    });
  }

  handleMessages(ws: WebSocket, messageService: MessageService) {
    ws.on('message', async (message) => {
      /*
      2. userA's client sends a JSON frame over their WebSocket:
      { "conversation_id": "123", "from_user_id": "A", "body": "hey!" }
      * */
      // try {
      //   const parsedMessage: Message = JSON.parse(message.toString());
      //   await messageService.handleIncoming(parsedMessage);
      // } catch (e) {
      //   const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      //   console.error(`Error when handling message, ${errorMessage}`);
      // }
    });
  }

  handleCloseConnection(ws: WebSocket, userId: string) {
    ws.on('close', async () => {
      await this.remove(userId);
    });
  }

  async remove(userId: string) {
    // // 1. Remove userId from websocket connection map
    // this.userIdToWsConnectionMap.delete(userId);
    // // 2. Remove user from redis subscription
    // this.redisSubscribe.unsubscribe(`user:${userId}`);
    //
    // // 3. Update conversationIdToUsersMap. If the user is a part of any of those conversations, update the Map
    // for (const [conversation_id, userSet] of this.conversationIdToUsersMap) {
    //   if (userSet.has(userId)) {
    //     userSet.delete(userId);
    //     if (userSet.size === 0) {
    //       this.redisSubscribe.unsubscribe(`conversation:${conversation_id}`);
    //       this.conversationIdToUsersMap.delete(conversation_id);
    //     }
    //   }
    // }
  }

  getUserId(ws: WebSocket, req: http.IncomingMessage) {
    // client connects to ws://localhost:3000?userId=A
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
    return userId;
  }

  getSocket(recipientUserId: string) {
    return this.userIdToWsConnectionMap.get(recipientUserId);
  }

  subscribeToConversation(conversationId: string, userId: string) {
    const currentUsersInConvo = this.conversationIdToUsersMap.get(conversationId);
    if (currentUsersInConvo === undefined) {
      this.conversationIdToUsersMap.set(conversationId, new Set([userId]));
      this.redisSubscribe.subscribe(`conversation:${conversationId}`);
    } else {
      this.conversationIdToUsersMap.set(conversationId, currentUsersInConvo.add(userId));
    }
  }
}
