import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import routes from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..', 'public');

const app = express();

// Security and utility middlewares
app.use(helmet({
  contentSecurityPolicy: false, // allow inline scripts for embedded frontend
}));
app.use(cors({
  origin: true,
  credentials: true,
  exposedHeaders: ['X-Site'],
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend build if present
app.use(express.static(publicDir));

// API Routes
app.use('/api', routes);

// SPA fallback for non-API requests (if index.html exists)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(publicDir, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) next();
  });
});

// Fallback handlers
app.use(notFound);
app.use(errorHandler);

export default app;
