import express from 'express';
const router = express.Router();
import pdfController from "../controllers/pdf.controller.js"

router.post("/", pdfController.mergePdf);
router.get("/", pdfController.pdfData);
router.post("/image-to-pdf", pdfController.imageToPdf);

export default router;