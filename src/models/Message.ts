import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
  id: string;
  room: string;
  sender: string;
  content: string;
  timestamp: Date;
  edited: boolean;
  deletedAt?: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    id: { type: String, required: true, unique: true, index: true },
    room: { type: String, required: true, index: true },
    sender: { type: String, required: true },
    content: { type: String, required: true, maxlength: 2000 },
    timestamp: { type: Date, default: Date.now, index: true },
    edited: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { collection: 'messages' }
);

// Compound index for efficient room history queries
MessageSchema.index({ room: 1, timestamp: -1 });

// Auto-delete messages older than 90 days (TTL index)
MessageSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const Message = mongoose.model<IMessage>('Message', MessageSchema);
