import type { RawData } from 'ws';
import { UserId } from '../../types/user';

export type WebsocketMessageHandler = (message: object, userId: UserId) => void;

export class WebSocketIncomingMessageService {
  private webSocketMessageTypeToHandlerMap = new Map<string, WebsocketMessageHandler>();

  constructor() {
    // Register handlers here for each message type clients can send over WebSocket.
    // Example:
    // this.registerHandlerForWebsocket('EXAMPLE_MESSAGE_TYPE', async (msg, userId) => {
    //   const { someField } = msg as ExampleMessage;
    //   // ... handle message, publish to Redis, etc.
    // });
  }

  registerHandlerForWebsocket(messageType: string, handler: WebsocketMessageHandler) {
    if (this.webSocketMessageTypeToHandlerMap.has(messageType)) {
      throw new Error(`WebSocket handler already registered for messageType: ${messageType}`);
    }
    this.webSocketMessageTypeToHandlerMap.set(messageType, handler);
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
