import { redisSubscribe } from '../../server';
import { WebSocket } from 'ws';
import { userIdToWsConnectionMap } from './utils';

export type RedisMessageHandler = (message: object) => void;

export class RedisIncomingMessageService {
  // A map of channel prefix → (messageType → handler)
  private redisChannelsToWebsocketHandlersMap = new Map<string, Map<string, RedisMessageHandler>>();

  constructor() {
    this.setupRedisSubscribeOnMessage();
  }

  setupRedisSubscribeOnMessage() {
    redisSubscribe.on('message', (channel, message) => {
      // All channels carry JSON with a `type` field
      const parsed = JSON.parse(message.toString());
      const channelStr = channel.toString();
      for (const [prefix, messageTypeToHandlerMap] of this.redisChannelsToWebsocketHandlersMap) {
        if (channelStr.startsWith(prefix)) {
          const messageTypeHandler = messageTypeToHandlerMap.get(parsed.type);
          messageTypeHandler?.(parsed);
          break;
        }
      }
    });
  }

  // Register a handler for a channel prefix + message type combination.
  // channelPrefix can match exact channels or channel prefixes (e.g. 'user:' matches 'user:123').
  registerHandlerForRedisChannel(
    channelPrefix: string,
    messageType: string,
    handler: RedisMessageHandler,
  ) {
    if (!this.redisChannelsToWebsocketHandlersMap.has(channelPrefix)) {
      this.redisChannelsToWebsocketHandlersMap.set(channelPrefix, new Map());
    }
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

  sendMessageToUserWebSocket(userId: string, message: object) {
    const socket = userIdToWsConnectionMap.get(userId);
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  broadcastMessageToAllConnectedUsers(message: object) {
    userIdToWsConnectionMap.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }
}
