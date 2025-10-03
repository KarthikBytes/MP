import express from "express";
import mysql from "mysql2/promise";
import multer from "multer";
import streamifier from "streamifier";
import { v2 as cloudinary } from "cloudinary";
import cors from "cors";
import dotenv from "dotenv";
import { exec } from "child_process";
import fs from "fs";
import path from "path";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// ✅ MySQL connection
const db = await mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// ✅ Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});
console.log("🔐 Cloudinary Config Check:");
console.log("Cloud Name:", process.env.CLOUD_NAME ? "✅" : "❌");
console.log("API Key:", process.env.CLOUD_API_KEY ? "✅" : "❌");
console.log("API Secret:", process.env.CLOUD_API_SECRET ? "✅" : "❌");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  }
});

// ✅ Mood-based simple upload endpoint
app.post("/upload-simple", upload.single("song"), async (req, res) => {
  console.log("📥 Simple upload request received");
  console.log("File:", req.file ? `✅ ${req.file.originalname} (${req.file.size} bytes)` : "❌ No file");
  console.log("Body:", req.body);

  try {
    const file = req.file;
    const { mood, title, youtubeUrl } = req.body;

    // Restrict moods to only allowed values
    const validMoods = ['love', 'sadness', 'old_melody', 'energy'];
    const songMood = validMoods.includes(mood?.toLowerCase()) ? mood.toLowerCase() : null;

    if (!mood || !songMood) {
      return res.status(400).json({ error: "Mood category is required and must be one of: Love, Sadness, Old Melody, Energy" });
    }

    // --- YOUTUBE LINK HANDLING ---
    if (youtubeUrl && youtubeUrl.trim()) {
      // Improved video ID extraction for various YouTube URL formats
      let videoId = null;
      if (youtubeUrl.includes("v=")) {
        videoId = youtubeUrl.split("v=")[1]?.split("&")[0];
      } else if (youtubeUrl.includes("youtu.be/")) {
        videoId = youtubeUrl.split("youtu.be/")[1]?.split("?")[0];
      }
      if (!videoId) {
        return res.status(400).json({ error: "Invalid YouTube URL" });
      }

      console.log("📺 YouTube video ID extracted:", videoId);

      // Download YouTube video as audio
      const downloadDir = path.join(__dirname, "downloads");
      if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir);
      const downloadPath = path.join(downloadDir, `${videoId}.mp3`);

      try {
        await new Promise((resolve, reject) => {
          require("ytdl-core")(`https://www.youtube.com/watch?v=${videoId}`, { filter: 'audioonly' })
            .pipe(fs.createWriteStream(downloadPath))
            .on("finish", resolve)
            .on("error", reject);
        });
        console.log("✅ YouTube audio downloaded:", downloadPath);

        // Upload the downloaded audio file to Cloudinary
        const uploadResult = await cloudinary.uploader.upload(downloadPath, {
          resource_type: "video",
          folder: `music-journal/${songMood}`,
          use_filename: true,
          unique_filename: true
        });

        console.log("✅ Cloudinary upload successful:", uploadResult.secure_url);

        // Clean up the downloaded file
        fs.unlinkSync(downloadPath);
        console.log("🗑️ Temporary file deleted:", downloadPath);

        // Respond with the uploaded song details
        return res.json({
          message: `Song successfully added to ${songMood} journal!`,
          song: {
            id: null,
            title: title || `YouTube Video - ${videoId}`,
            mood: songMood,
            artist: "YouTube",
            genre: "YouTube",
            url: uploadResult.secure_url
          }
        });

      } catch (err) {
        console.error("❌ YouTube download/upload error:", err);
        return res.status(500).json({ error: "Failed to process YouTube video" });
      }
    }

    // --- MP3 FILE HANDLING ---
    if (!file) {
      return res.status(400).json({ error: "❌ No file uploaded or YouTube link provided" });
    }

    // Validate file type
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/flac', 'audio/aac', 'audio/ogg'];
    if (!allowedTypes.includes(file.mimetype)) {
      console.log("❌ Invalid file type:", file.mimetype);
      return res.status(400).json({
        error: `Invalid file type: ${file.mimetype}. Supported types: MP3, WAV, M4A, FLAC, AAC, OGG`
      });
    }

    console.log("🌤️ Starting Cloudinary upload to mood folder:", songMood);

    // Upload to Cloudinary with mood-based folder
    const uploadPromise = new Promise((resolve, reject) => {
      const cldStream = cloudinary.uploader.upload_stream(
        {
          resource_type: "video", // Use 'video' for audio files in Cloudinary
          folder: `music-journal/${songMood}`,
          use_filename: true,
          unique_filename: true
        },
        async (error, result) => {
          if (error) {
            console.log("❌ Cloudinary error:", error);
            reject(new Error(`Cloudinary upload failed: ${error.message}`));
            return;
          }

          console.log("✅ Cloudinary upload successful:", result.secure_url);

          let connection;
          try {
            connection = await db.getConnection();
            await connection.beginTransaction();

            // Generate title from filename if not provided
            const songTitle = title || file.originalname.replace(/\.[^/.]+$/, "");

            // Use "Unknown Artist" and auto-detect genre
            const artistName = "Unknown Artist";
            const autoGenre = "Auto-detected";

            // 1. Find or create "Unknown Artist"
            let [artistRows] = await connection.query(
              "SELECT id FROM artists WHERE name = ?",
              [artistName]
            );

            let artistId;
            if (artistRows.length > 0) {
              artistId = artistRows[0].id;
              console.log("🎤 Found existing artist:", artistName, "ID:", artistId);
            } else {
              // Create "Unknown Artist"
              const [artistResult] = await connection.query(
                "INSERT INTO artists (name) VALUES (?)",
                [artistName]
              );
              artistId = artistResult.insertId;
              console.log("🎤 Created new artist:", artistName, "ID:", artistId);
            }

            // 2. Insert song with minimal info
            const [songResult] = await connection.query(
              "INSERT INTO songs (title, artist_id, genre, duration, mood, url, public_id, album_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
              [songTitle, artistId, autoGenre, 0, songMood, result.secure_url, result.public_id, null]
            );

            await connection.commit();
            console.log("✅ Song saved to database, ID:", songResult.insertId);

            const successResponse = {
              message: `Song successfully added to ${songMood} journal!`,
              song: {
                id: songResult.insertId,
                title: songTitle,
                mood: songMood,
                artist: artistName,
                genre: autoGenre,
                url: result.secure_url
              }
            };

            resolve(successResponse);

          } catch (dbError) {
            if (connection) await connection.rollback();
            console.log("❌ Database error:", dbError);
            reject(new Error(`Database error: ${dbError.message}`));
          } finally {
            if (connection) connection.release();
          }
        }
      );

      // Handle stream errors
      cldStream.on('error', (error) => {
        console.log("❌ Stream error:", error);
        reject(new Error(`Upload stream error: ${error.message}`));
      });

      // Pipe the file buffer to Cloudinary
      console.log("📤 Piping file to Cloudinary...");
      streamifier.createReadStream(file.buffer).pipe(cldStream);
    });

    const result = await uploadPromise;
    res.json(result);

  } catch (err) {
    console.log("❌ Simple upload error:", err);
    res.status(500).json({
      error: err.message || "Upload failed due to server error"
    });
  }
});

// ✅ Delete song from Cloudinary and database
app.delete("/songs/:id", async (req, res) => {
  try {
    const { id } = req.params;

    console.log("🗑️ Delete request for song ID:", id);

    let connection;
    try {
      connection = await db.getConnection();
      await connection.beginTransaction();

      // 1. Find the song first to get Cloudinary public_id
      const [songRows] = await connection.query(`
        SELECT s.*, a.name as artist_name 
        FROM songs s 
        JOIN artists a ON s.artist_id = a.id 
        WHERE s.id = ?
      `, [id]);

      if (songRows.length === 0) {
        return res.status(404).json({ error: 'Song not found' });
      }

      const song = songRows[0];
      console.log("🎵 Found song to delete:", song.title, "Cloudinary ID:", song.public_id);

      // 2. Delete from Cloudinary if public_id exists
      let cloudinaryDeleted = false;
      if (song.public_id) {
        try {
          const cloudinaryResult = await cloudinary.uploader.destroy(song.public_id, {
            resource_type: 'video'
          });

          console.log('☁️ Cloudinary deletion result:', cloudinaryResult);

          if (cloudinaryResult.result === 'ok') {
            cloudinaryDeleted = true;
            console.log("✅ Successfully deleted from Cloudinary");
          } else {
            console.warn('⚠️ Cloudinary deletion may have failed:', cloudinaryResult);
          }
        } catch (cloudinaryError) {
          console.error('❌ Cloudinary deletion error:', cloudinaryError);
          // Continue with database deletion even if Cloudinary fails
        }
      } else {
        console.warn('⚠️ No public_id found for song, skipping Cloudinary deletion');
      }

      // 3. Delete from database
      await connection.query('DELETE FROM songs WHERE id = ?', [id]);
      await connection.commit();

      console.log("✅ Song deleted from database");

      res.json({
        message: 'Song deleted successfully',
        deletedSong: {
          id: song.id,
          title: song.title,
          artist: song.artist_name,
          mood: song.mood
        },
        cloudinaryDeleted: cloudinaryDeleted
      });

    } catch (dbError) {
      if (connection) await connection.rollback();
      console.log("❌ Database deletion error:", dbError);
      throw dbError;
    } finally {
      if (connection) connection.release();
    }

  } catch (err) {
    console.error('❌ Delete error:', err);
    res.status(500).json({ error: 'Failed to delete song: ' + err.message });
  }
});

// ✅ Get all songs
app.get("/songs", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT s.id, s.title, s.genre, s.duration, s.mood, s.url, s.public_id,
             a.name as artist, al.title as album
      FROM songs s
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      ORDER BY s.id DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get songs by specific mood
app.get("/songs/:mood", async (req, res) => {
  try {
    const mood = req.params.mood;
    const [rows] = await db.query(`
      SELECT s.id, s.title, s.genre, s.duration, s.mood, s.url, s.public_id,
             a.name as artist, al.title as album
      FROM songs s
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      WHERE s.mood = ?
      ORDER BY s.id DESC
    `, [mood]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get all artists (kept for compatibility)
app.get("/artists", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM artists ORDER BY name");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get all albums (kept for compatibility)
app.get("/albums", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT a.*, ar.name as artist_name 
      FROM albums a 
      JOIN artists ar ON a.artist_id = ar.id 
      ORDER BY a.title
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Search artists (kept for compatibility)
app.get("/artists/search", async (req, res) => {
  try {
    const { q } = req.query;
    const [rows] = await db.query(
      "SELECT id, name FROM artists WHERE name LIKE ? LIMIT 10",
      [`%${q}%`]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Search albums (kept for compatibility)
app.get("/albums/search", async (req, res) => {
  try {
    const { q } = req.query;
    const [rows] = await db.query(
      "SELECT id, title FROM albums WHERE title LIKE ? LIMIT 10",
      [`%${q}%`]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Test endpoint
app.post("/test-upload", upload.single("song"), async (req, res) => {
  console.log("🧪 Test upload received");
  console.log("File:", req.file);
  console.log("Body:", req.body);

  if (!req.file) {
    return res.status(400).json({ error: "No file received in test" });
  }

  res.json({
    message: "Test upload successful!",
    filename: req.file.originalname,
    size: req.file.size,
    type: req.file.mimetype
  });
});

// ✅ Health check
app.get("/", (req, res) => {
  res.json({
    message: "Music Journal API is running!",
    endpoints: {
      simpleUpload: "POST /upload-simple",
      songs: "GET /songs",
      songsByMood: "GET /songs/:mood",
      deleteSong: "DELETE /songs/:id",
      test: "POST /test-upload"
    },
    features: "Mood-based journal upload system"
  });
});

const PORT = process.env.PORT || 5000;

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🎵 Music Journal Server running on http://localhost:${PORT}`);
  console.log(`📁 Cloudinary configured: ${process.env.CLOUD_NAME ? '✅' : '❌'}`);
  console.log(`🎯 Simple upload available at: POST /upload-simple`);
  console.log(`🗑️  Delete available at: DELETE /songs/:id`);
});