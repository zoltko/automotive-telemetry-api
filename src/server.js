import express from 'express';
import swaggerUi from 'swagger-ui-express';
import yaml from 'js-yaml';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import authRoutes from './routes/auth.js';
import vehicleRoutes from './routes/vehicles.js';
import sensorReadingRoutes from './routes/sensorReadings.js';
import alertRoutes from './routes/alerts.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());

// ── Swagger UI ──────────────────────────────────────────────────────────
const swaggerDocument = yaml.load(
  readFileSync(join(__dirname, 'openapi.yaml'), 'utf8')
);

app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    swaggerOptions: { persistAuthorization: true },
  })
);

app.get('/api/openapi.json', (_req, res) => {
  res.json(swaggerDocument);
});

// ── Routes ──────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/vehicles/:vehicleId/sensor-readings', sensorReadingRoutes);
app.use('/api/vehicles/:vehicleId/alerts', alertRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('🚗 Automotive Telemetry API running on port ' + PORT);
  console.log('📖 Swagger UI: http://localhost:' + PORT + '/api/docs');
});
