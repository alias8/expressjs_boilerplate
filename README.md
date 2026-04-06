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

## Making a new Database
1. Modify/create schema in schema.prisma
2. run `npx prisma migrate dev --name <your-migration-name>`
3. Make TS types `npx prisma generate`
4. Reset DB `npm run reset-db`
When you modify prisma.schema, run step 2 to 5 again.
