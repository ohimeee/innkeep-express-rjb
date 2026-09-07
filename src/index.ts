import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import roomRoutes from './roomRoutes';
import reservationRoutes from './reservationRoutes';
import folioRoutes from './folioRoutes';
import dashboardRoutes from './dashboardRoutes';
import webhookRoutes from './webhookRoutes';

dotenv.config();

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api/rooms', roomRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/folio', folioRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/webhooks', webhookRoutes);

app.listen(PORT, () => {
  console.log(`InnKeep Express API running on http://localhost:${PORT}`);
});
