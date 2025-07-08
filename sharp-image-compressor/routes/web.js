import { Router } from "express";
import webController from "../controllers/web.controller.js";

const router = Router();

router.get("/",webController.lighthouse);
router.get("/seo",webController.onPageSeo);
router.get("/wp-detector",webController.wpDetector);
router.get("/koo-app",webController.kooAppKeywords);
router.get("/domain-available",webController.domainAvailable);

export default router;