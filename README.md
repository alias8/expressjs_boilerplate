# Instant Messaging Backend

A learning project — a web-based instant messaging service (WhatsApp-like, 1:1 text only).
Built to practice system design concepts.

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **HTTP/WebSocket:** Express + ws
- **Database:** PostgreSQL (persistence)
- **Cache/Pub-Sub:** Redis

## Running locally

Prerequisites — make sure PostgreSQL and Redis servers are running:

```bash
redis-cli ping   # should return PONG
pg_isready       # should return "accepting connections"
```

Start two app servers (simulating two separate servers in the cloud):

```bash
# Terminal 1
PORT=3000 npx ts-node src/server.ts

# Terminal 2
PORT=3001 npx ts-node src/server.ts
```

Then open `test3000.html` and `test3001.html` in a browser. Send a message from one — it should appear in the other.

## Architecture

### How multi-server messaging works

Redis and Postgres are **shared services** — every app server connects to the same instance. In the cloud they would each be their own managed service (e.g. AWS RDS for Postgres, AWS ElastiCache for Redis).

```
                    ┌─────────────────────────────────────────┐
                    │           SHARED INFRASTRUCTURE          │
                    │                                          │
                    │  ┌──────────────┐  ┌─────────────────┐  │
                    │  │  PostgreSQL  │  │      Redis      │  │
                    │  │              │  │   Pub/Sub +     │  │
                    │  │  messages    │  │   seq counters  │  │
                    │  │  users       │  │                 │  │
                    │  │  convos etc  │  │                 │  │
                    │  └──────┬───────┘  └────────┬────────┘  │
                    └─────────┼────────────────────┼──────────┘
                              │                    │
           ┌──────────────────┘          ┌─────────┘
           │                             │
┌──────────▼───────────┐      ┌──────────▼───────────┐
│      Server A        │      │      Server B        │
│                      │      │                      │
│  ConnectionManager   │      │  ConnectionManager   │
│  userMap:            │      │  userMap:            │
│    userA → ws        │      │    userB → ws        │
│                      │      │                      │
│  Redis subscribed to │      │  Redis subscribed to │
│    user:A            │      │    user:B  ◄──────── │─── listens here
│                      │      │                      │
└──────────▲───────────┘      └──────────────────────┘
           │ WebSocket                    │ WebSocket
       userA                          userB
       (browser)                      (browser)
```

### Step-by-step: userA sends a message to userB

1. **userA's browser** sends a WebSocket frame to Server A.

2. **Server A** (`MessageService`):
   - Calls Redis `INCR` to get a sequence number (avoids clock skew across servers)
   - Inserts the message into Postgres (message is now persisted)
   - Queries Postgres to find who the recipient is
   - Calls Redis `PUBLISH` on channel `user:B`

3. **Redis** broadcasts the `user:B` channel event to all subscribers.

4. **Server B** (`ConnectionManager`):
   - It subscribed to `user:B` when userB first opened their WebSocket connection
   - Redis delivers the message to Server B only (no other server subscribed to `user:B`)
   - Server B looks up userB's WebSocket in its local in-memory map
   - Calls `ws.send()` — message arrives in userB's browser

### Offline users

If userB is offline, no server is subscribed to `user:B`, so the Redis publish goes nowhere. That's fine — the message was already saved to Postgres. When userB reconnects, their client sends its last seen sequence number and fetches any missed messages from Postgres.