export enum AgentRole {
  ADMIN = 'admin',
  AGENT = 'agent',
}

export enum AgentStatus {
  ONLINE = 'online',
  BUSY = 'busy',
  OFFLINE = 'offline',
}

export enum ConversationStatus {
  OPEN = 'open',
  PENDING = 'pending',
  RESOLVED = 'resolved',
}

export enum MessageSenderType {
  VISITOR = 'visitor',
  AGENT = 'agent',
  BOT = 'bot',
}
