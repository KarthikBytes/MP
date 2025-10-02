// backend/routes/upload.js
import express from "express";
import multer from "multer";
import cloudinary from "../config/cloud";

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/upload", upload.single("song"), async (req, res) => {
  try {
    const fileBuffer = req.file;

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload_stream(
      { resource_type: "video" }, // needed for audio/video
      (error, uploadedFile) => {
        if (error) {
          return res.status(500).json({ error: error.message });
        }
        res.json({
          url: uploadedFile.secure_url, // Cloudinary song URL
          public_id: uploadedFile.public_id,
        });
      }
    );

    // Pipe file buffer to Cloudinary
    streamifier.createReadStream(fileBuffer.buffer).pipe(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
