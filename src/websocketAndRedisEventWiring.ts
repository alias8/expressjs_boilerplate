import { WiringManager } from './WiringManager';
import {
  REDIS_TRIP_CHANNEL,
  REDIS_TRIPS_AVAILABLE_CHANNEL,
  TRIP_ACCEPTED,
  TRIP_AVAILABLE,
  TRIP_DROPPED_OFF,
  TRIP_PICKED_UP,
  TRIP_UPDATE_CURRENT_LOCATION,
} from './types/trip';
import {
  RedisIncomingMessageService,
  RedisMessageHandler,
} from './services/messageService/RedisIncomingMessageService';
import { WebSocketIncomingMessageService } from './services/messageService/WebSocketIncomingMessageService';

export function setupWebsocketAndRedisEventWiring(
  redisIncomingMessageService: RedisIncomingMessageService,
  webSocketIncomingMessageService: WebSocketIncomingMessageService,
) {
  const wiringManager = new WiringManager(
    redisIncomingMessageService,
    webSocketIncomingMessageService,
  );
  // Websocket -> redis -> websocket
  wiringManager.wireWebsocketToRedisPipeline(
    TRIP_UPDATE_CURRENT_LOCATION,
    webSocketIncomingMessageService.updateDriverLocationHandler.bind(
      webSocketIncomingMessageService,
    ),
    REDIS_TRIP_CHANNEL,
    (msg) => redisIncomingMessageService.sendMessageToRiderWebSocket(msg.rider_id, msg),
  );

  // redis -> websocket
  const toRider: RedisMessageHandler = (msg) =>
    redisIncomingMessageService.sendMessageToRiderWebSocket(msg.rider_id, msg);
  const toAllDrivers: RedisMessageHandler = (msg) =>
    redisIncomingMessageService.sendMessageToAllDriversWebSocket(msg);

  wiringManager.wireRedisToWebsocketPipeline(REDIS_TRIP_CHANNEL, TRIP_PICKED_UP, [toRider]);
  wiringManager.wireRedisToWebsocketPipeline(REDIS_TRIP_CHANNEL, TRIP_DROPPED_OFF, [toRider]);
  wiringManager.wireRedisToWebsocketPipeline(REDIS_TRIP_CHANNEL, TRIP_ACCEPTED, [
    toRider,
    toAllDrivers,
  ]);
  wiringManager.wireRedisToWebsocketPipeline(REDIS_TRIPS_AVAILABLE_CHANNEL, TRIP_AVAILABLE, [
    toAllDrivers,
  ]);
}
