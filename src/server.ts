import 'dotenv/config';
import http from 'http';
import app from './app';
import { Server } from 'ws';
import { pool } from './db/pool';
import { Redis } from 'ioredis';
import { ConnectionManager } from './ConnectionManager';
import { MessageService } from './MessageService';

const port = process.env.PORT ?? 3000;
const redisPublish = new Redis();
const redisSubscribe = new Redis();

const server = http.createServer(app);
server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

const wss = new Server({ server });

const connectionManager = new ConnectionManager(redisSubscribe);
const messageService = new MessageService(pool, redisPublish);

wss.on('connection', (ws, req) => connectionManager.handleConnection(ws, req, messageService));
