import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import roomRoutes from './roomRoutes';

dotenv.config();

const app = express();
app.use(cors());
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use('/api/rooms', roomRoutes);

app.listen(PORT, () => {
  console.log(`InnKeep Express API running on http://localhost:${PORT}`);
});
