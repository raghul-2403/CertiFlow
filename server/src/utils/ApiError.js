// Throw this from any route/service to send a clean HTTP error to the client.
export class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }

  static badRequest(msg = 'Bad request', details) { return new ApiError(400, msg, details); }
  static unauthorized(msg = 'Unauthorized') { return new ApiError(401, msg); }
  static forbidden(msg = 'Forbidden') { return new ApiError(403, msg); }
  static notFound(msg = 'Not found') { return new ApiError(404, msg); }
  static conflict(msg = 'Conflict', details) { return new ApiError(409, msg, details); }
}

// Wraps async route handlers so rejected promises reach the error handler.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
