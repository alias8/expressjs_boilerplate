import { WebSocket } from 'ws';

export const riderUserIdToWsConnectionMap = new Map<string, WebSocket>();
export const driverUserIdToWsConnectionMap = new Map<string, WebSocket>();
