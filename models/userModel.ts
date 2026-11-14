import mongoose from 'mongoose';
import slugify from 'slugify';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import validator from 'validator';

// Define the interface for the User
interface IUser extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password: string;
  passwordConfirm: string | undefined;
  role: string;
  image?: string;
  dateOfBirth?: Date;
  height?: {
    heightMetric: number;
    heightImperial: number;
  };
  weight?: {
    weightMetric: number;
    weightImperial: number;
  };
  symptoms?: string[];
  paymentInfo?: string;
  // cart: typeof mongoose.Schema.ObjectId;
  slug: string;
  checkPassword: (candidatePassword: string, userPassword: string) => boolean;
  createPasswordResetToken: () => string;
  changedPasswordAfter: (JWTTimestamp: any) => boolean;
  passwordChangedAt: Date | undefined;
  passwordResetToken: string | undefined;
  passwordResetExpires: Date | undefined;
  active: boolean;
  tokenVersion: number;
}

const userSchema = new mongoose.Schema<IUser>({
  name: {
    type: String,
    required: [true, 'A user must have a full name specified'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'A user needs a specified email address'],
    trim: true,
    // Stored and looked up in lowercase, so "Foo@x.com" and "foo@x.com" are the same account
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email address'],
    // Login looks users up by email, so two accounts must never share one
    unique: true,
  },
  password: {
    type: String,
    required: [true, 'Please provide a password for the user'],
    // Custom message, the default one echoes the submitted password back
    minLength: [8, 'A password must have at least 8 characters'],
    // bcrypt only reads the first 72 bytes, the rest would be silently ignored
    validate: {
      validator: (value: string) => Buffer.byteLength(value) <= 72,
      message:
        'A password must be at most 72 characters (accents and emoji count as several)',
    },
    select: false,
    unique: true,
  },
  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm your password'],
    select: false,
    validate: {
      // This only works on CREATE and SAVE!
      validator: function (el) {
        return el === this.password;
      },
      message: 'Passwords are not the same',
    },
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  image: {
    type: String,
    // required: [true, 'The user must have a picture'],
  },
  dateOfBirth: {
    type: Date,
    // Important because some products are recommended to be taken by people in a certain age range
    // No default: a missing date stays missing instead of becoming "born today"
    validate: {
      validator: (value: Date) => value <= new Date(),
      message: 'The date of birth cannot be in the future',
    },
  },
  height: {
    type: {
      heightMetric: {
        type: Number,
        // Metres. Bounds keep out negatives, typos and unconvertible values
        min: [0.3, 'Height must be at least 0.3 metres'],
        max: [3, 'Height must be at most 3 metres'],
      },
      heightImperial: {
        type: Number,
      },
    },
    // Not required initially, but later if the user wants to see specific information like BMI and calories, etc.
    // required: [true, 'The user must specify their height.'],
  },
  weight: {
    type: {
      weightMetric: {
        type: Number,
        // Kilograms
        min: [1, 'Weight must be at least 1 kg'],
        max: [700, 'Weight must be at most 700 kg'],
      },
      weightImperial: {
        type: Number,
      },
    },
    // Not required initially, but later if the user wants to see specific information like BMI and calories, etc.
    // required: [true, 'The user must specify their weight.'],
  },
  symptoms: [String],
  paymentInfo: {
    type: String,
  },
  // cart: {
  //   type: mongoose.Schema.ObjectId,
  //   ref: 'Cart',
  // },
  passwordChangedAt: Date,
  // Never sent to clients; queries can still filter on them
  passwordResetToken: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false },
  active: {
    type: Boolean,
    default: true,
    select: false,
  },
  // Carried inside every JWT. Bumping it (password change, logout) invalidates
  // all tokens issued so far for this user
  tokenVersion: { type: Number, default: 0 },
  slug: String,
});

// Internal fields never leave the API, whichever endpoint serializes the user
userSchema.set('toJSON', {
  versionKey: false,
  transform: (doc, ret: any) => {
    delete ret.active;
    delete ret.tokenVersion;
    return ret;
  },
});

// DOCUMENT MIDDLEWARE
// runs before .save() and .create()
userSchema.pre('save', function (next) {
  // Converts the user name into lowercase and separates them
  // by dashes
  this.slug = slugify(this.name, { lower: true });
  next();
});

// Password encryption usinbg bcrypt
userSchema.pre('save', async function (next) {
  // Only run this function if password was actually modified
  if (!this.isModified('password')) return next();

  // bcrypt
  // Hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);

  // Delete the passwordConfirm field
  this.passwordConfirm = undefined;
  next();
});

userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) {
    return next();
  }

  this.passwordChangedAt = new Date(Date.now() - 1000);
  // Exact, unlike the timestamp above (a JWT only has one-second resolution)
  this.tokenVersion += 1;
  console.log(
    'passwordChangedAt',
    Math.floor(this.passwordChangedAt.getTime() / 1000)
  );
  next();
});

// Passwords used to pass through xss-clean, which rewrote "<" to "&lt;" before
// hashing. Accounts from that time still hold such a hash, so a password
// containing "<" that does not match as typed is also tried in that form
export const verifyPassword = async (
  candidatePassword: string,
  userPassword: string
) => {
  if (await bcrypt.compare(candidatePassword, userPassword)) return true;

  return (
    candidatePassword.includes('<') &&
    (await bcrypt.compare(
      candidatePassword.replace(/</g, '&lt;'),
      userPassword
    ))
  );
};

userSchema.methods.checkPassword = async function (
  candidatePassword: string,
  userPassword: string
) {
  return await verifyPassword(candidatePassword, userPassword);
};

// Checks if the password was changed recently by comparing it to the "issued at" of the JWT
userSchema.methods.changedPasswordAfter = function (JWTTimestamp: number) {
  if (this.passwordChangedAt) {
    const changedTimestamp = Math.floor(
      this.passwordChangedAt.getTime() / 1000
    );

    // console.log(JWTTimestamp, changedTimestamp);

    return JWTTimestamp < changedTimestamp; // 100 < 200
  }

  // Default: False === NOT recently changed
  return false;
};

// Creates a token that enables a user to reset their password
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // console.log({ resetToken }, this.passwordResetToken);

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

const User = mongoose.model('User', userSchema);

export default User;
