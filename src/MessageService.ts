import { Redis } from 'ioredis';
import { PrismaClient } from './generated/prisma/client';
import { Client } from '@elastic/elasticsearch';

export class MessageService {
  constructor(
    private prisma: PrismaClient,
    private redisPublish: Redis,
    private elasticSearchClient: Client,
  ) {}

  async handleIncoming(parsedMessage) {}
}
