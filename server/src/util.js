export const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
