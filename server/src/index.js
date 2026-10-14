import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import { authRoutes } from './routes/auth.js';
import { categoriesRoutes } from './routes/categories.js';
import { paymentMethodsRoutes } from './routes/paymentMethods.js';
import { gastosRoutes } from './routes/gastos.js';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL es requerida');
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET es requerido');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/payment-methods', paymentMethodsRoutes);
app.use('/api/gastos', gastosRoutes);

app.use((req, res) => res.status(404).json({ error: 'No encontrado' }));

app.use((err, req, res, next) => {
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Icono demasiado grande' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  console.error(err);
  res.status(500).json({ error: 'Error interno' });
});

export default app;