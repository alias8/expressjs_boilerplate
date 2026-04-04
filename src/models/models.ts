import { MessageType } from '../generated/prisma/enums';

export interface User {
  id: string;
  username: string;
  password_hash: string;
  created_at: Date;
}

export interface Conversation {
  id: string;
  created_at: Date;
}

export interface ConversationMember {
  conversation_id: string;
  user_id: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  from_user_id: string;
  body: string;
  type: MessageType;
  metadata: { url?: string };
  seq: bigint;
  created_at: Date;
}

export interface ESMessage {
  conversation_id: string;
  from_user_id: string;
  body: string;
  type: MessageType;
  metadata: { url?: string };
  seq: number;
  created_at: Date;
}
