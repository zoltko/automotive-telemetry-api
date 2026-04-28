import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  createAlert,
  getAlerts,
  getAlertById,
  updateAlert,
  deleteAlert,
} from '../controllers/alertsController.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.post('/', createAlert);
router.get('/', getAlerts);
router.get('/:id', getAlertById);
router.put('/:id', updateAlert);
router.delete('/:id', deleteAlert);

export default router;
