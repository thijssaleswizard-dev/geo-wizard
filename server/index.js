import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Import modular routes
import authRoutes from './routes/auth.js';
import clientsRoutes from './routes/clients.js';
import citationsRoutes from './routes/citations.js';
import keywordsRoutes from './routes/keywords.js';
import promptsRoutes from './routes/prompts.js';
import recommendationsRoutes from './routes/recommendations.js';
import notificationsRoutes from './routes/notifications.js';
import agentsRoutes from './routes/agents.js';
import overviewRoutes from './routes/overview.js';
import scraperRoutes from './routes/scraper.js';
import { initCronScheduler } from './services/cron.js';

const app = express();
const PORT = process.env.PORT || 5002;

app.use(cors());
app.use(express.json());

// Register API Routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/citations', citationsRoutes);
app.use('/api/keywords', keywordsRoutes);
app.use('/api/prompts', promptsRoutes);
app.use('/api/recommendations', recommendationsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/agents-analytics', agentsRoutes);
app.use('/api/overview-stats', overviewRoutes);
app.use('/api/scraper', scraperRoutes);

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`   GEO-Wizard Modular Backend Running on port ${PORT}`);
  console.log(`   API Base URL: http://localhost:${PORT}/api`);
  console.log(`==================================================`);
  
  // Initialize background cron scheduler
  initCronScheduler();
});

export default app;
