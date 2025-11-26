import mongoose, { Document, Schema, Model } from 'mongoose';

// Base interface
export interface ICredibilityCode {
  code: string;
  userId: string;
  groupId: string;
  expiresAt: Date;
  verifiedBy: string[];
  createdAt: Date;
}

// Instance methods
export interface ICredibilityCodeMethods {
  isExpired(): boolean;
  verify(verifierId: string): Promise<ICredibilityCodeDocument>;
}

// Document interface - codeId is optional since it's a virtual
export interface ICredibilityCodeDocument extends Document, ICredibilityCode, ICredibilityCodeMethods {
  _id: mongoose.Types.ObjectId;
  codeId?: string; // ✅ Made optional since it's a virtual property
}

// Static methods
export interface ICredibilityCodeModel extends Model<ICredibilityCode, {}, ICredibilityCodeMethods> {
  generateCode(userId: string, groupId: string, expiryHours?: number): Promise<ICredibilityCodeDocument>;
  findByCode(code: string): Promise<ICredibilityCodeDocument | null>;
  findActiveCode(userId: string, groupId: string): Promise<ICredibilityCodeDocument | null>;
  cleanupExpiredCodes(): Promise<number>;
}

// Schema
const CredibilityCodeSchema = new Schema<ICredibilityCode, ICredibilityCodeModel, ICredibilityCodeMethods>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      minlength: 6,
      maxlength: 6,
      match: /^[A-Z0-9]{6}$/,
      index: true
    },
    userId: {
      type: String,
      required: true,
      index: true
    },
    groupId: {
      type: String,
      required: true,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    verifiedBy: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'credibility_codes'
  }
);

// Indexes
CredibilityCodeSchema.index({ userId: 1, groupId: 1 });
CredibilityCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual
CredibilityCodeSchema.virtual('codeId').get(function() {
  return this._id.toString();
});

// JSON serialization
CredibilityCodeSchema.set('toJSON', {
  virtuals: true,
  transform: function(_doc, ret) {
    const codeId = ret._id.toString();
    const { _id, __v, ...rest } = ret;
    return { codeId, ...rest };
  }
});

CredibilityCodeSchema.set('toObject', { virtuals: true });

// Instance methods
CredibilityCodeSchema.methods.isExpired = function(): boolean {
  return new Date() > this.expiresAt;
};

CredibilityCodeSchema.methods.verify = async function(verifierId: string): Promise<ICredibilityCodeDocument> {
  if (!this.verifiedBy.includes(verifierId)) {
    this.verifiedBy.push(verifierId);
    await this.save();
  }
  return this;
};

// Static methods
CredibilityCodeSchema.statics.generateCode = async function(
  userId: string,
  groupId: string,
  expiryHours: number = 24
): Promise<ICredibilityCodeDocument> {
  const generateRandomCode = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  let code: string;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    code = generateRandomCode();
    const existing = await this.findOne({ code });
    if (!existing) break;
    attempts++;
  } while (attempts < maxAttempts);

  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate unique code');
  }

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expiryHours);

  const credibilityCode = await this.create({
    code,
    userId,
    groupId,
    expiresAt,
    verifiedBy: []
  });

  return credibilityCode;
};

CredibilityCodeSchema.statics.findByCode = async function(
  code: string
): Promise<ICredibilityCodeDocument | null> {
  return this.findOne({ code: code.toUpperCase() }).exec();
};

CredibilityCodeSchema.statics.findActiveCode = async function(
  userId: string,
  groupId: string
): Promise<ICredibilityCodeDocument | null> {
  return this.findOne({
    userId,
    groupId,
    expiresAt: { $gt: new Date() }
  }).exec();
};

CredibilityCodeSchema.statics.cleanupExpiredCodes = async function(): Promise<number> {
  const result = await this.deleteMany({ expiresAt: { $lt: new Date() } });
  return result.deletedCount || 0;
};

const CredibilityCode = mongoose.model<ICredibilityCode, ICredibilityCodeModel>(
  'CredibilityCode',
  CredibilityCodeSchema
);

export default CredibilityCode;