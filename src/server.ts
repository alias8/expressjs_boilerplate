import 'dotenv/config';
import http from 'http';
import app from './app';
import { Server, WebSocket as WsWebSocket } from 'ws';
import { URL } from 'node:url';
import { ConversationMember, Message, User } from './models/models';
import { pool } from './db/pool';

const port = process.env.PORT ?? 3000;

const server = http.createServer(app);
server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
const wss = new Server({ server });
export const userIdToWsConnectionMap = new Map<string, WsWebSocket>();
let nonRedisCounter = 0;

/*
  1. Your frontend (or any client) opens a WebSocket: new WebSocket('ws://localhost:3000?userId=123')
  2. The browser sends a special HTTP request called an upgrade request to your server
  3. The ws library intercepts that on your HTTP server, does the WebSocket handshake, and then emits the connection event
  4. Your wss.on('connection', (ws, req) => { ... }) callback runs — ws is the live socket for that specific client, req is the original upgrade request (which is how
  you read the userId from the URL)

  So .on('connection', ...) is just registering a handler — you do that once at startup. The callback runs each time a new client connects.
* */
wss.on('connection', (ws, req) => {
  // client connects to ws://localhost:3000?userId=A
  const { url } = req;
  if (!url) {
    console.error(`No url in websocket req, closing connection`);
    ws.close();
    return;
  }
  const myUrl = new URL(url, 'http://localhost:3000');
  const params = myUrl.searchParams;
  const userId = params.get('userId');
  if (!userId) {
    console.error(`No userid in websocket url ${url}, closing connection`);
    ws.close();
    return;
  }
  // userA
  userIdToWsConnectionMap.set(userId, ws);

  console.log(`Client id ${userId} connected`);

  // Send a welcome message to the new client
  ws.send('Welcome to the WebSocket server!');

  ws.on('message', async (message) => {
    // userA sends message to userB
    const parsedMessage: Message = JSON.parse(message.toString());
    nonRedisCounter++;
    const { conversation_id, from_user_id, body } = parsedMessage;
    // Save message in postgres
    await pool.query(
      'INSERT INTO messages (conversation_id, from_user_id, seq, body, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [conversation_id, from_user_id, nonRedisCounter, body, new Date()],
    );
    // query postgres to find relevant conversation
    const idToSendToResult = await pool.query(
      'SELECT user_id FROM conversation_members WHERE conversation_id = $1 AND NOT user_id = $2',
      [conversation_id, from_user_id],
    );
    const recipientUserId: string = idToSendToResult.rows[0]?.user_id;
    if (!recipientUserId) {
      console.error(
        `No conversation_id found with ${conversation_id} and not user_id ${from_user_id}`,
      );
      return;
    }
    const recipientSocket = userIdToWsConnectionMap.get(recipientUserId);
    if (!recipientSocket) {
      // user is offline — that's fine, message is already saved to Postgres
      return;
    }
    recipientSocket.send(JSON.stringify(parsedMessage));
  });

  // Listen for the client closing the connection
  ws.on('close', () => {
    userIdToWsConnectionMap.delete(userId);
    console.log('Client disconnected');
  });
});
