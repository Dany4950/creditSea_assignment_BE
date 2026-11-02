const { Schema, model } = require('mongoose');
const { GENDERS, MARITAL_STATUSES } = require('../utils/constants');
const { toIsoDate } = require('../utils/date');

const userSchema = new Schema(
  {
    mobile: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    tokenVersion: { type: Number, default: 0 }, // bump to invalidate every issued JWT (logout)
    failedLogins: { type: Number, default: 0 },
    lockUntil: { type: Date },

    firstName: String,
    lastName: String,
    gender: { type: String, enum: GENDERS },
    dob: Date,
    maritalStatus: { type: String, enum: MARITAL_STATUSES },

    email: String,
    emailVerified: { type: Boolean, default: false },

    panEncrypted: { type: String, select: false }, // AES-256-GCM, never returned
    panMasked: String, // ABCDE****F
    panVerified: { type: Boolean, default: false },

    creditScore: { type: Number, default: null },
  },
  { timestamps: true }
);

userSchema.methods.hasPersonal = function hasPersonal() {
  return Boolean(this.firstName && this.lastName && this.gender && this.dob && this.maritalStatus);
};

userSchema.virtual('profileComplete').get(function profileComplete() {
  return this.hasPersonal() && this.emailVerified && this.panVerified;
});

userSchema.methods.toProfile = function toProfile() {
  return {
    id: this.id,
    mobile: this.mobile,
    profileComplete: this.profileComplete,
    firstName: this.firstName ?? null,
    lastName: this.lastName ?? null,
    gender: this.gender ?? null,
    dob: toIsoDate(this.dob),
    maritalStatus: this.maritalStatus ?? null,
    email: this.email ?? null,
    emailVerified: this.emailVerified,
    panMasked: this.panMasked ?? null,
    panVerified: this.panVerified,
    creditScore: this.creditScore,
  };
};

module.exports = model('User', userSchema);
