import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  createReading,
  getReadings,
  getReadingById,
  updateReading,
  deleteReading,
} from '../controllers/sensorReadingsController.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.post('/', createReading);
router.get('/', getReadings);
router.get('/:id', getReadingById);
router.put('/:id', updateReading);
router.delete('/:id', deleteReading);

export default router;
