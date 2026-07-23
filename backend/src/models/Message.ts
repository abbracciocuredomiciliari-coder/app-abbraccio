import mongoose, { Schema, model, Types } from 'mongoose';

export type MessageScope = 'patient' | 'general';
export type MessageChannel = 'all' | 'coordinators' | 'office_admin';

export interface IMessageAttachment {
  url: string;
  type: string;      // mime
  name: string;
  publicId?: string; // cloudinary id
}

export interface IReadBy {
  userId: Types.ObjectId;
  at: Date;
}

export interface IMessage extends mongoose.Document {
  scope: MessageScope;
  channel: MessageChannel;
  patientId?: Types.ObjectId;
  workPlanId?: Types.ObjectId;
  senderId: Types.ObjectId;
  senderRole: string;
  senderName: string;
  recipientId?: Types.ObjectId; // se null, il messaggio è di gruppo (coordinator/admin o team)
  content: string;
  attachments: IMessageAttachment[];
  readBy: IReadBy[];
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    scope: { type: String, enum: ['patient', 'general'], required: true },
    channel: { type: String, enum: ['all', 'coordinators', 'office_admin'], default: 'all' },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', index: true },
    workPlanId: { type: Schema.Types.ObjectId, ref: 'WorkPlan', index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    senderRole: { type: String, required: true },
    senderName: { type: String, required: true, trim: true },
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    content: { type: String, default: '', trim: true },
    attachments: [
      {
        url: { type: String, required: true },
        type: { type: String, default: '' },
        name: { type: String, default: '' },
        publicId: { type: String },
      },
    ],
    readBy: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

messageSchema.index({ scope: 1, patientId: 1, createdAt: -1 });
messageSchema.index({ scope: 1, createdAt: -1 });

export default model<IMessage>('Message', messageSchema);
