import multer from "multer";
import { PDFDocument } from "pdf-lib";
import fs from "fs";
import PDFParser from "pdf2json";
import { fromPath } from "pdf2pic";
import pdfMake from "pdfmake/build/pdfmake.js";
// import pdfFonts from "pdfmake/build/vfs_fonts.js";
import fonts from "../utils/fonts/fonts.js"
import sharp from 'sharp';

pdfMake.vfs = fonts;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    return cb(null, './uploads');
  },
  filename: (req, file, cb) => {
    let uploadedFile = `${Date.now()}_${file.originalname}`;
    return cb(null, uploadedFile);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 4 MB (maximum file size)
  },
  fileFilter: (req, file, cb) => {
    // if (file.mimetype === 'application/pdf') {
    cb(null, true);
    // } else {

    //   return cb(new Error('File type not supported. Please upload pdf files.'), false);
    // }
  },
})

const uploadSingleImage = upload.array('pdfs', 20);
const uploadSinglePdf = upload.single('pdf');

export default {
  mergePdf: (req, res) => {
    try {
      uploadSingleImage(req, res, (err) => {

        if (process.env.NODE_ENV === "development" && err) console.log(err);
        if (err && err.code === "ENOENT") return res.status(400).json({ message: 'Failed to upload files.' });

        const { files } = req;
        if (!files || !files[0]) {
          return res.status(400).json({ message: 'Please upload valid PDF files.' });
        } else if (files.length < 2) {
          return res.status(400).json({ message: 'At least two files must be uploaded.' });
        }

        if (err instanceof multer.MulterError) {
          // A Multer error occurred when uploading.
          const message = err.code === "LIMIT_FILE_SIZE" ? "Each file size should be less than 5 MB" : err.code === "LIMIT_UNEXPECTED_FILE" ? "Maximum limit reached. Please select up to 20 PDF files." : "Internal server error.";

          return res.status(500).json({ message });
        } else if (err) {
          // An unknown error occurred when uploading.
          return res.status(400).json({ message: err.message });
        }
        (async () => {
          const mergedPdf = await PDFDocument.create();
          const { files } = req;
          const pdfs = [];
          files.forEach(({ path }) => {
            // console.log(path);
            pdfs.push(fs.readFileSync(path))
            fs.unlink(path, (err) => {
              if (err) return console.log(err);
              return console.log(`Deleted path: ${path}`)
            });
          })

          for (const pdf of pdfs) {

            //Ingnore in encrypted pdf file
            const loadedPdf = await PDFDocument.load(pdf, { ignoreEncryption: true });
            const pages = await mergedPdf.copyPages(loadedPdf, loadedPdf.getPageIndices());
            for (const page of pages) {
              mergedPdf.addPage(page);
            }
          }

          const response = await mergedPdf.save();

          res.set('Content-Type', "application/pdf");
          return res.send(Buffer.from(response.buffer, 'binary'))

          // Save file
          // await fs.promises.writeFile(outputPath, response);
        })();

      })
    } catch (e) {
      console.log(e)
      return res.status(500).json({ message: "Internal server error." })
    }

  },
  pdfData: (req, res) => {
    uploadSinglePdf(req, res, (err) => {

      if (process.env.NODE_ENV === "development" && err) console.log(err);
      if (err && err.code === "ENOENT") return res.status(400).json({ message: 'Failed to upload files.' });

      const { file } = req;
      console.log(req.file)
      if (!file) {
        return res.status(400).json({ message: 'Please upload valid PDF files.' });
      }

      if (err instanceof multer.MulterError) {
        // A Multer error occurred when uploading.
        const message = err.code === "LIMIT_FILE_SIZE" ? "Each file size should be less than 5 MB" : err.code === "LIMIT_UNEXPECTED_FILE" ? "Maximum limit reached. Please select up to 20 PDF files." : "Internal server error.";

        return res.status(500).json({ message });
      } else if (err) {
        // An unknown error occurred when uploading.
        return res.status(400).json({ message: err.message });
      }
      (async () => {

        const { path } = file
        // console.log(path);
        const pdf = fs.readFileSync(path)

        const options = {
          density: 100,
          saveFilename: "untitled",
          savePath: "./images",
          format: "png",
          width: 600,
          height: 600
        };
        const convert = fromPath("./download.pdf", options);
        const pageToConvertAsImage = 1;

        convert(pageToConvertAsImage, { responseType: "image" })
          .then((resolve) => {

            console.log("Page 1 is now converted as image");
            console.log(resolve)
            res.set('Content-Type', "application/pdf");
            return res.send(Buffer.from(resolve, 'binary'))
            return resolve;
          });

        fs.unlink(path, (err) => {
          if (err) return console.log(err);
          return console.log(`Deleted path: ${path}`)
        });

        // Save file
        // await fs.promises.writeFile(outputPath, response);
      })();

    })
    // const pdfParser = new PDFParser();

    // pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError) );
    // pdfParser.on("pdfParser_dataReady", pdfData => {
    //     res.json(pdfData)
    // });

    // pdfParser.loadPDF("./darkblue.pdf");


  },
  imageToPdf: async (req, res) => {
    uploadSinglePdf(req, res, async (err) => {

      if (process.env.NODE_ENV === "development" && err) console.log(err);
      if (err && err.code === "ENOENT") return res.status(400).json({ message: 'Failed to upload files.' });

      const { file } = req;
      if (!file) {
        return res.status(400).json({ message: 'Please upload valid PDF files.' });
      }

      if (err instanceof multer.MulterError) {
        // A Multer error occurred when uploading.
        const message = err.code === "LIMIT_FILE_SIZE" ? "Each file size should be less than 5 MB" : err.code === "LIMIT_UNEXPECTED_FILE" ? "Maximum limit reached. Please select up to 20 PDF files." : "Internal server error.";

        return res.status(500).json({ message });
      } else if (err) {
        // An unknown error occurred when uploading.
        return res.status(400).json({ message: err.message });
      }
      let path = "";
      let sharpConverted = null
      const imagePDFMakeSupport = ['image/jpeg', 'image/jpg', 'image/png']

      // Check File supported by PDFmake or not 
      if (imagePDFMakeSupport.indexOf(file.mimetype) === -1) {
        try {
          const data = await sharp(file.path).jpeg().toBuffer();
          sharpConverted = new Buffer.from(data).toString('base64');
        } catch (e) {
          return res.status(400).json({ message: "Image type not supported." })
        }

      }
      else path = file.path

      // function to encode file data to base64 encoded string
      function base64_encode(file) {
        // read binary data
        var bitmap = fs.readFileSync(file);
        // convert binary data to base64 encoded string
        return new Buffer.from(bitmap).toString('base64');
      }

      const docDefinition = {
        pageSize: 'A4',
        content: [
          {
            image: `data:image/png;base64,${sharpConverted || base64_encode(path)}`, width: 550, alignment: 'center'
          },
        ],
        styles: {
          header: {
            fontSize: 18,
            bold: true,
            margin: [0, 0, 0, 10],
          },
        },
      };

      // PDFmake server
      // var printer = new PdfPrinter(fonts);
      // var options = {
      //   // ...
      // }

      // var pdfDoc = printer.createPdfKitDocument(docDefinition, options);
      // pdfDoc.pipe(fs.createWriteStream('document.pdf'));
      // pdfDoc.end();

      // PDFmake client
      try {

        pdfMake.createPdf(docDefinition).getBuffer((result) => {
          res.set('Content-Type', "application/pdf");
          res.send(Buffer.from(result, 'binary'))
        });
      } catch (e) {
        console.log(e.message)
      }

      fs.unlink(file.path, (err) => {
        if (err) return console.log(err);
        return console.log(`Deleted path: ${file.path}`)
      });

    })

  }
}