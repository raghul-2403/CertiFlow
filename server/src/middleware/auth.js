import jwt from 'jsonwebtoken';
import { Admin } from '../models/index.js';
import { getJwtSecret } from '../services/bootstrap.js';
import { ApiError } from '../utils/ApiError.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw ApiError.unauthorized('Please log in');

    let payload;
    try {
      payload = jwt.verify(token, getJwtSecret());
    } catch {
      throw ApiError.unauthorized('Your session has expired. Please log in again.');
    }
    const admin = await Admin.findById(payload.sub);
    if (!admin) throw ApiError.unauthorized('Account no longer exists');
    req.admin = admin;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles) {
  return (req, res, next) =>
    roles.includes(req.admin?.role) ? next() : next(ApiError.forbidden('You do not have permission to do this'));
}
