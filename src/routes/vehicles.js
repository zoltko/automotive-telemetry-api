import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  createVehicle,
  getVehicles,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
} from '../controllers/vehiclesController.js';

const router = Router();

router.use(authenticate);

router.post('/', createVehicle);
router.get('/', getVehicles);
router.get('/:id', getVehicleById);
router.put('/:id', updateVehicle);
router.delete('/:id', deleteVehicle);

export default router;
