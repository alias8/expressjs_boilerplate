import { Redis } from 'ioredis';
import { WebSocket as WsWebSocket, WebSocket } from 'ws';
import { URL } from 'node:url';
import { Message } from './models/models';
import http from 'http';
import { MessageService } from './MessageService';

export class ConnectionManager {
  private userIdToWsConnectionMap = new Map<string, WsWebSocket>(); // ConnectionId: Websocket map

  constructor(private redisSubscribe: Redis) {}

  /*
   1. Connection setup (before the message)
  Both users connected earlier via WebSocket to ws://localhost:3000?userId=A and ws://localhost:3000?userId=B.
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
      try {
        const parsedMessage: Message = JSON.parse(message.toString());
        await messageService.handleIncoming(parsedMessage);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        console.error(`Error when handling message, ${errorMessage}`);
      }
    });

    this.redisSubscribe.on('messageBuffer', async (channel, message) => {
      // 4. Redis received a message from userA to userB. Only the 1 server that userB is on will run this listener
      const recipientUserId = channel.toString().replace('user:', '');
      this.getSocket(recipientUserId)?.send(message);
    });
  }

  handleCloseConnection(ws: WebSocket, userId: string) {
    ws.on('close', () => {
      this.remove(userId);
    });
  }

  remove(userId: string) {
    this.userIdToWsConnectionMap.delete(userId);
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
}
