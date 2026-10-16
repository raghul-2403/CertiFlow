import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

const { Schema } = mongoose;

// Club coordinators / staff who log in to the dashboard (login routes come in Module 5)
const adminSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ['admin', 'coordinator'], default: 'coordinator' },
  },
  { timestamps: true }
);

adminSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

adminSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.password);
};

export default mongoose.model('Admin', adminSchema);
