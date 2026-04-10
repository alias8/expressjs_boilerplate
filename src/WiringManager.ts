import {
  WebSocketIncomingMessageService,
  WebsocketMessageHandler,
} from './services/messageService/WebSocketIncomingMessageService';
import {
  RedisIncomingMessageService,
  RedisMessageHandler,
} from './services/messageService/RedisIncomingMessageService';

export class WiringManager {
  constructor(
    private redisIncomingMessageService: RedisIncomingMessageService,
    private webSocketIncomingMessageService: WebSocketIncomingMessageService,
  ) {}

  // For events where a client sends over WS → server publishes to Redis → server forwards to another client's WS
  wireWebsocketToRedisPipeline(
    websocketIncomingName: string,
    webSocketIncomingHandler: WebsocketMessageHandler,
    redisListeningChannel: string,
    redisListeningChannelHandler: RedisMessageHandler,
  ) {
    this.webSocketIncomingMessageService.registerHandlerForWebsocket(
      websocketIncomingName,
      webSocketIncomingHandler,
    );
    this.redisIncomingMessageService.registerHandlerForRedisChannel(
      redisListeningChannel,
      websocketIncomingName,
      redisListeningChannelHandler,
    );
  }

  // For events where the server publishes to Redis (from an HTTP route) → server forwards to WS clients
  wireRedisToWebsocketPipeline(
    redisListeningChannel: string,
    messageType: string,
    handlers: RedisMessageHandler[],
  ) {
    this.redisIncomingMessageService.registerHandlerForRedisChannel(
      redisListeningChannel,
      messageType,
      (msg) => handlers.forEach((handler) => handler(msg)),
    );
  }
}
