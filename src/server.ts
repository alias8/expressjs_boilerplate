import 'dotenv/config';
import http from 'http';
import app from './app';
import { Server } from 'ws';
import { prisma } from './db/prisma';
import { Redis } from 'ioredis';
import { ConnectionManager } from './ConnectionManager';
import { MessageService } from './MessageService';
import { Client } from '@elastic/elasticsearch';

const port = process.env.PORT ?? 3000;
/*
 * These Redis objects are just connections to a separate and shared redis server elsewhere. All servers will connect
 * to the same redis server.
 * The userIdToWsConnectionMap is storing sessions for each server only.
 * */
const redisPublish = new Redis(); // new Redis() with no arguments uses ioredis defaults: localhost:6379
const redisSubscribe = new Redis();

export const elasticSearchClient = new Client({
  cloud: { id: process.env.ELASTIC_SEARCH_CLOUD_ID },
  auth: { apiKey: process.env.ELASTIC_SEARCH_API_KEY },
});

const server = http.createServer(app);
server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

const wss = new Server({ server });

export const connectionManager = new ConnectionManager(redisSubscribe);
const messageService = new MessageService(prisma, redisPublish, elasticSearchClient);

wss.on('connection', (ws, req) => connectionManager.handleConnection(ws, req, messageService));
