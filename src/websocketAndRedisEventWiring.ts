import { WiringManager } from './WiringManager';
import { RedisIncomingMessageService } from './services/messageService/RedisIncomingMessageService';
import { WebSocketIncomingMessageService } from './services/messageService/WebSocketIncomingMessageService';

export function setupWebsocketAndRedisEventWiring(
  redisIncomingMessageService: RedisIncomingMessageService,
  webSocketIncomingMessageService: WebSocketIncomingMessageService,
) {
  const wiringManager = new WiringManager(
    redisIncomingMessageService,
    webSocketIncomingMessageService,
  );

  // Example: WebSocket → Redis → WebSocket pipeline
  // Use this when a client sends a message over WebSocket that should be
  // published to Redis and forwarded to another client's WebSocket.
  //
  // wiringManager.wireWebsocketToRedisPipeline(
  //   'EXAMPLE_WS_MESSAGE_TYPE',
  //   webSocketIncomingMessageService.yourWsHandler.bind(webSocketIncomingMessageService),
  //   'example-channel:',
  //   (msg) => redisIncomingMessageService.sendMessageToUserWebSocket((msg as any).userId, msg),
  // );

  // Example: Redis → WebSocket pipeline
  // Use this when an HTTP route publishes to Redis and the message should be
  // forwarded to one or more connected WebSocket clients.
  //
  // wiringManager.wireRedisToWebsocketPipeline('example-channel:', 'EXAMPLE_MESSAGE_TYPE', [
  //   (msg) => redisIncomingMessageService.sendMessageToUserWebSocket((msg as any).userId, msg),
  // ]);

  void wiringManager; // remove this line once you add wiring above
}
