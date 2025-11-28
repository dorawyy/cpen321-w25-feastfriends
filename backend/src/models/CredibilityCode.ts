import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ICredibilityCode {
  code: string;
  userId: string;
  groupId: string;
  expiresAt: Date;
  verifiedBy: string[];
  createdAt: Date;
}

export interface ICredibilityCodeMethods {
  verify(verifierId: string): Promise<ICredibilityCodeDocument>;
  isExpired(): boolean;
}

export interface ICredibilityCodeDocument extends Document, ICredibilityCode, ICredibilityCodeMethods {
  _id: mongoose.Types.ObjectId;
}

export interface ICredibilityCodeModel extends Model<ICredibilityCode, {}, ICredibilityCodeMethods> {
  generateCode(userId: string, groupId: string, expiryHours?: number): Promise<ICredibilityCodeDocument>;
  findByCode(code: string): Promise<ICredibilityCodeDocument | null>;
  findActiveCode(userId: string, groupId: string): Promise<ICredibilityCodeDocument | null>;
}

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

CredibilityCodeSchema.index({ userId: 1, groupId: 1 });
CredibilityCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

CredibilityCodeSchema.methods.verify = async function(verifierId: string): Promise<ICredibilityCodeDocument> {
  if (!this.verifiedBy.includes(verifierId)) {
    this.verifiedBy.push(verifierId);
    await this.save();
  }
  return this;
};

CredibilityCodeSchema.methods.isExpired = function(): boolean {
  return new Date() > this.expiresAt;
};

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
  return this.findOne({ 
    code: code.toUpperCase(),
    expiresAt: { $gt: new Date() }
  }).exec();
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


const CredibilityCode = mongoose.model<ICredibilityCode, ICredibilityCodeModel>(
  'CredibilityCode',
  CredibilityCodeSchema
);

export default CredibilityCode;