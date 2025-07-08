import sharp from 'sharp'
import multer from 'multer'

// Multer configuration for file upload
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits:{fileSize: 20 * 1024 * 1024 },
  fileFilter:(req,file,cb) => {
    // console.log(file)
    if(file.mimetype.startsWith("image/")){
        return cb(null,true);
    }
return cb(new Error('Invalid file type. Only image files are allowed.'));

} }).single('image');

export default {
    hello: function(req,res){
        res.send("hi")
    },
    imageCompressor: (req,res) =>{

      try{
        upload(req,res,(err) =>{
          if (err instanceof multer.MulterError) {
            // A Multer error occurred when uploading.
            const message = err.code === "LIMIT_FILE_SIZE" ? "Each file size should be less than 5 MB" : err.code === "LIMIT_UNEXPECTED_FILE" ? "You can upload only one file at a time." : "Internal server error.";
  
            return res.status(500).json({message :message});
          } else if (err) {
            // An unknown error occurred when uploading.
            console.log(err)
            return res.status(400).json({message :err.message});
          }
          const { compress, format } = req.body;
       
          const formats = ["heic", "heif", "avif", "jpeg", "jpg", "jpe", "tile", "dz", "png", "tif", "webp", "gif"]

          if (formats.indexOf(format) === -1 ) return res.status(400).json({message:'Please enter a valid format.'});

          // Check if a file was provided
          if (!req.file) {
            return res.status(400).json({message:'No file uploaded.'});
          }
        
          // Get the uploaded file buffer
          const imageBuffer = req.file.buffer;
        
          // Use Sharp to compress the image
          sharp(imageBuffer).toFormat(format, {
            quality: parseInt(compress),
          })
            .toBuffer()
            .then((compressedImageBuffer) => {
              // Send the compressed image as a response
              res.set('Content-Type', `image/${format}`);
              res.send(compressedImageBuffer);
            })
            .catch((error) => {
              console.error(error);
              res.status(500).json({message:'Unsupported image format or unable to compress image.'});
            });
    
        })
   
      }catch(e){
        console.log(e)
        res.status(500).json({message:"Internal server error."})
      }
    }
};