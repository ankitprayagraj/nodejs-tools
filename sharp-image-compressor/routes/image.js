import express from 'express';
const router = express.Router();
import imageController from "../controllers/image.controller.js"

router.get("/", imageController.hello);
router.post("/",imageController.imageCompressor)

export default router;