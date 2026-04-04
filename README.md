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

### Sending pictures
Can send images through text as well. How it works:
1. User1 uploads image from their machine. Calls POST /media
2. Backend fetches from S3 a url for the frontend to use and sends it back
3. Frontend uploads to S3 with that link
4. Frontend then sends a message over websocket to backend telling the backend 
the uuid key of the image just uploaded. Backend saves this in postgres and broadcasts the message
to other members of the conversation.
5. Participants on the conversation receive the message from the backend. If it is 
text, it just displays as text. If it's an image message, then the frontend calls the backend
GET /media/presigned?key=<key> where the key is the uuid of the image. 
The backend then sends the frontend a temporary aws url to fetch the image. 
The url will last day before expiring.

This above way is what's happening in this project, but in real life:
Real production apps typically don't use presigned URLs at all for serving images. Instead they put a CDN (Content Delivery Network) in front of S3 — like AWS         
CloudFront.

How it works

Browser → CloudFront (CDN edge node) → S3

- S3 is made private (no public access)
- CloudFront sits in front and is the only thing allowed to read from S3
- The URL the user gets looks like: https://cdn.myapp.com/uploads/64c33ee3-...jpg
- That URL never expires — it's stable and cacheable

Why this is better

Caching at the edge — CloudFront caches the image at a server geographically close to the user. Second request for the same image never even reaches S3.

No expiry problem — the URL is permanent, so you can store it in your database and use it forever. No presigned URL rotation needed.

Faster — CDN edge nodes are distributed globally. S3 alone is one region.

Cheaper — S3 charges per request and per GB transferred. CloudFront reduces both by caching.

Access control — you can use CloudFront signed URLs if you need to restrict access (e.g. only paying users can see certain images). Similar concept to S3 presigned    
URLs but managed at the CDN layer, and you can invalidate them centrally.

For your app

The presigned URL approach you have is a totally reasonable learning pattern — it's simpler to set up and teaches the concepts. CloudFront adds operational complexity
(DNS, distributions, cache invalidation) that isn't worth it for a learning project. But in production, the CDN pattern is almost universal for user-generated media.

### Offline users

If userB is offline, no server is subscribed to `user:B`, so the Redis publish goes nowhere. That's fine — the message was already saved to Postgres. When userB reconnects, their client sends its last seen sequence number and fetches any missed messages from Postgres.