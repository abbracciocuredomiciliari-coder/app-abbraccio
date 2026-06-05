import Staff from '../models/Staff';

/**
 * Trova il profilo Staff collegato all'utente loggato.
 * Prima cerca per userId, poi per email (con auto-link).
 */
export async function getStaffByUser(userId: string, userEmail?: string) {
  let staff = await Staff.findOne({ userId });
  if (!staff && userEmail) {
    staff = await Staff.findOne({ email: userEmail });
    if (staff) {
      staff.userId = userId as any;
      await staff.save();
    }
  }
  return staff;
}
