import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const COOKIE_SECURE = process.env.COOKIE_SECURE !== '0';

export function setAuthCookie(res, user) {
  const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: COOKIE_SECURE,
    path: '/',
    maxAge: COOKIE_MAX_AGE_MS
  });
}

export function clearAuthCookie(res) {
  res.clearCookie('token', { path: '/' });
}

export function authRequired(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}
