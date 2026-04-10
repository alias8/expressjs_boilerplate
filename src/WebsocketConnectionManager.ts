import { WebSocket, RawData } from 'ws';
import http from 'http';
import { userIdToWsConnectionMap } from './services/messageService/utils';
import { getUserIdFromWebsocket } from './middleware/auth';
import { WebSocketIncomingMessageService } from './services/messageService/WebSocketIncomingMessageService';

export class WebsocketConnectionManager {
  /*
   * Clients connect via: ws://localhost:3000?token=<jwt>
   * On connect, the JWT is verified and the userId is extracted.
   * The connection is stored in userIdToWsConnectionMap for message routing.
   */
  handleConnection(
    ws: WebSocket,
    req: http.IncomingMessage,
    webSocketMessageService: WebSocketIncomingMessageService,
  ) {
    const verify = getUserIdFromWebsocket(ws, req);
    if (verify) {
      const { userId } = verify;
      userIdToWsConnectionMap.set(userId, ws);

      ws.on('message', async (message: RawData) => {
        webSocketMessageService.handleIncomingWebsocketMessage(userId, message);
      });

      ws.on('close', async () => {
        userIdToWsConnectionMap.delete(userId);
      });
    }
  }
}
