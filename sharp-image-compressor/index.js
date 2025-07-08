import express from 'express'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url';
import cors from 'cors';
import imageRoutes from './routes/image.js';
import pdfRoutes from './routes/pdf.js'
import 'dotenv/config';
import logger from "morgan";
import fs from "fs";
import compression from 'compression';

const __filename = fileURLToPath(import.meta.url);

const app = express();
app.use(express.urlencoded({extended:true}))
app.use(express.json())
app.use(compression({
  level:6,
  threshold:100*1000
}))

if (process.env.NODE_ENV === "development") {

  app.use(logger("dev"));

}
app.use(cors({
  origin: (origin, cb) => {

    if (process.env.CORS_ORIGIN) {
      if (process.env.CORS_ORIGIN === origin) {
        cb(null, true)
      } else {
        return cb(new Error("Unautorized"))
      }
    }
    else {
      cb(null, true)
    }


  },
}))

// if(process.env.CORS_ORIGIN){
//   app.use(cors({origin:process.env.CORS_ORIGIN}))
// }
import webRoutes from "./routes/web.js";
import cronJobRoutes from "./routes/cronJob.js";

app.use("/cron", cronJobRoutes)
app.use("/compressor", imageRoutes)
app.use("/pdf", pdfRoutes)
app.use("/web", webRoutes)

const port = process.env.PORT || 3000;

// Serve HTML page for image upload
app.get('/', (req, res) => {

  const __dirname = dirname(__filename)
  res.sendFile((path.join(__dirname, 'index.html')))
});

// Error handler
app.use((err, req, res, next) => {
  if (err.message === 'Unautorized') {
    // Send a custom message for CORS issues
    res.status(401).json({ message: 'Unautorized. Contact Ankit kashyap.' });
  } else {
    next(err);
  }
});

try {
  fs.mkdirSync("./uploads", { recursive: true })
} catch (e) {
  console.log(e)
}
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});