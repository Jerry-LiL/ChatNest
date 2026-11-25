function errorHandler(err, req, res, _next) {
  if (err.name === 'CastError') {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  if (err.code === 11000) {
    res.status(409).json({ error: 'Already exists' });
    return;
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: status >= 500 ? 'Something went wrong' : err.message,
  });
}

module.exports = { errorHandler };
