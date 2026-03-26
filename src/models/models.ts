export interface User {
    id: string;
    username: string;
    passwordHash: string;
    createdAt: Date;
}

export interface Conversation {
    id: string,
    createdAt: Date
}

export interface ConversationMember {
    conversationId: string,
    userId: string
}

export interface Message {
    messageId: string,
    conversationId: string,
    fromUserId: string,
    body: string,
    seq: bigint,
    createdAt: Date
}