const HttpError = require('../errors');

// The cursor is the oldest message the client already has, so the next
// page is strictly older. Messages that arrive later do not shift it.
function encodeCursor(message) {
  return Buffer.from(JSON.stringify({
    t: new Date(message.createdAt).toISOString(),
    id: message._id.toString(),
  })).toString('base64url');
}

function decodeCursor(cursor) {
  if (!cursor || typeof cursor !== 'string') {
    throw new HttpError(400, 'Invalid cursor');
  }
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    const createdAt = new Date(parsed.t);
    if (!parsed.id || Number.isNaN(createdAt.getTime())) {
      throw new Error('bad cursor');
    }
    return { createdAt, id: parsed.id };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, 'Invalid cursor');
  }
}

function pageLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 30;
  return Math.min(Math.floor(parsed), 100);
}

module.exports = { encodeCursor, decodeCursor, pageLimit };
