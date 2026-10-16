import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

export function notFound(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// Converts every kind of error into one consistent JSON shape:
// { success: false, message, details? }
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let status = 500;
  let message = 'Internal server error';
  let details;

  if (err instanceof ApiError) {
    status = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = 'Validation failed';
    details = Object.fromEntries(
      Object.entries(err.errors).map(([field, e]) => [field, e.message])
    );
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid value for "${err.path}"`;
  } else if (err?.code === 11000) {
    // Duplicate key — e.g. same participant submitting twice for one event
    status = 409;
    message = 'Duplicate record';
    details = err.keyValue;
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON body';
  }

  if (status >= 500) console.error('[error]', err);

  res.status(status).json({
    success: false,
    message,
    ...(details && { details }),
    ...(!env.isProd && status >= 500 && { stack: err.stack }),
  });
}
