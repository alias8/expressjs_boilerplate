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
