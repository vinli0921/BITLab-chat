import type mongoose from 'mongoose';
import type { IUser } from '@librechat/data-schemas';
import { STUDY_ID, VARIANTS } from './constants';
import type { Variant } from './constants';

export async function ensureAssignment(
  userId: string,
  db: typeof mongoose,
): Promise<Variant> {
  const User = db.models.User as mongoose.Model<IUser>;
  const user = await User.findById(userId).select('experimentAssignment').lean();

  if (user?.experimentAssignment?.studyId === STUDY_ID) {
    return user.experimentAssignment.variant as Variant;
  }

  const variant = VARIANTS[Math.floor(Math.random() * VARIANTS.length)];

  await User.findByIdAndUpdate(userId, {
    $set: {
      experimentAssignment: {
        studyId: STUDY_ID,
        variant,
        assignedAt: new Date(),
      },
    },
  });

  return variant;
}
