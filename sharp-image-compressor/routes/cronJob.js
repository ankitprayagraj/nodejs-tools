import express from "express";
import cronJobController from "../controllers/cronJob.controller.js";

const route = express.Router();

route.get("/home",cronJobController.homePage);
route.get("/:id",cronJobController.jobUpdate);
route.post("/plagiarism",cronJobController.plagiarismCheck);

export default route;