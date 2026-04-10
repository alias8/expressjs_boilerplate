import { WebSocket } from 'ws';

export const userIdToWsConnectionMap = new Map<string, WebSocket>();
