import express from "express";
import mysql from "mysql2/promise";
import multer from "multer";
import streamifier from "streamifier";
import { v2 as cloudinary } from "cloudinary";
import cors from "cors";
import dotenv from "dotenv";

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

// ✅ Get all artists
app.get("/artists", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM artists ORDER BY name");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get all albums
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

// ✅ Search artists
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

// ✅ Search albums
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

// ✅ Create new artist
app.post("/artists", async (req, res) => {
  try {
    const { name } = req.body;
    const [result] = await db.query(
      "INSERT INTO artists (name) VALUES (?)",
      [name]
    );
    res.json({ id: result.insertId, name, message: "Artist created successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Create new album
app.post("/albums", async (req, res) => {
  try {
    const { title, artist_id, release_year } = req.body;
    const [result] = await db.query(
      "INSERT INTO albums (title, artist_id, release_year) VALUES (?, ?, ?)",
      [title, artist_id, release_year]
    );
    res.json({ id: result.insertId, message: "Album created successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Upload song using artist name and album name
app.post("/upload", upload.single("song"), async (req, res) => {
  console.log("📥 Upload request received");
  console.log("File:", req.file ? `✅ ${req.file.originalname} (${req.file.size} bytes)` : "❌ No file");
  console.log("Body:", req.body);

  try {
    const file = req.file;
    const { title, artist_name, album_name, genre, duration, mood } = req.body;

    if (!file) {
      console.log("❌ No file uploaded");
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Validate required fields
    if (!title || !artist_name || !genre || !duration) {
      console.log("❌ Missing required fields");
      return res.status(400).json({
        error: "Missing required fields: title, artist_name, genre, duration"
      });
    }

    // Validate file type
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/flac', 'audio/aac'];
    if (!allowedTypes.includes(file.mimetype)) {
      console.log("❌ Invalid file type:", file.mimetype);
      return res.status(400).json({
        error: `Invalid file type: ${file.mimetype}. Supported types: MP3, WAV, M4A, FLAC, AAC`
      });
    }

    // Validate mood
    const validMoods = ['love', 'happy', 'sad', 'energetic', 'relaxed', 'romantic', 'party', 'workout', 'chill'];
    const songMood = validMoods.includes(mood?.toLowerCase()) ? mood.toLowerCase() : 'other';

    console.log("🌤️ Starting Cloudinary upload...");

    // Upload to Cloudinary
    const uploadPromise = new Promise((resolve, reject) => {
      const cldStream = cloudinary.uploader.upload_stream(
        {
          resource_type: "video",
          folder: `songs/${songMood}`
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

            // 1. Find or create artist
            let [artistRows] = await connection.query(
              "SELECT id FROM artists WHERE name = ?",
              [artist_name]
            );

            let artistId;
            if (artistRows.length > 0) {
              artistId = artistRows[0].id;
              console.log("🎤 Found existing artist:", artist_name, "ID:", artistId);
            } else {
              // Create new artist
              const [artistResult] = await connection.query(
                "INSERT INTO artists (name) VALUES (?)",
                [artist_name]
              );
              artistId = artistResult.insertId;
              console.log("🎤 Created new artist:", artist_name, "ID:", artistId);
            }

            // 2. Find or create album (if provided)
            let albumId = null;
            if (album_name && album_name.trim() !== '') {
              let [albumRows] = await connection.query(
                "SELECT id FROM albums WHERE title = ? AND artist_id = ?",
                [album_name, artistId]
              );

              if (albumRows.length > 0) {
                albumId = albumRows[0].id;
                console.log("💿 Found existing album:", album_name, "ID:", albumId);
              } else {
                // Create new album
                const [albumResult] = await connection.query(
                  "INSERT INTO albums (title, artist_id) VALUES (?, ?)",
                  [album_name, artistId]
                );
                albumId = albumResult.insertId;
                console.log("💿 Created new album:", album_name, "ID:", albumId);
              }
            }

            // 3. Insert song
            const [songResult] = await connection.query(
              "INSERT INTO songs (title, artist_id, album_id, genre, duration, mood, url, public_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
              [title, artistId, albumId, genre, duration, songMood, result.secure_url, result.public_id]
            );

            await connection.commit();
            console.log("✅ Song saved to database, ID:", songResult.insertId);

            const successResponse = {
              message: "Song uploaded successfully!",
              url: result.secure_url,
              mood: songMood,
              artist: artist_name,
              album: album_name || 'Single',
              songId: songResult.insertId
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
    console.log("❌ Upload error:", err);
    res.status(500).json({
      error: err.message || "Upload failed due to server error"
    });
  }
});

// ✅ Get all songs
app.get("/songs", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT s.id, s.title, s.genre, s.duration, s.mood, s.url, 
             a.name as artist, al.title as album
      FROM songs s
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      ORDER BY s.title
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
      SELECT s.id, s.title, s.genre, s.duration, s.mood, s.url, 
             a.name as artist, al.title as album
      FROM songs s
      JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      WHERE s.mood = ?
      ORDER BY s.title
    `, [mood]);
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

  // Simulate success
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
    message: "Music Streaming API is running!",
    endpoints: {
      upload: "POST /upload",
      songs: "GET /songs",
      artists: "GET /artists",
      test: "POST /test-upload"
    }
  });
});

const PORT = process.env.PORT || 5000;

// ✅ Debug endpoint (move this before app.listen)
app.post("/upload-debug", upload.single("song"), async (req, res) => {
  console.log("🐛 DEBUG Upload request received");
  console.log("📁 File:", req.file);
  console.log("📝 Body:", req.body);

  try {
    // Test Cloudinary connection first
    console.log("🔗 Testing Cloudinary connection...");

    // Simple Cloudinary test
    cloudinary.uploader.upload(
      "https://res.cloudinary.com/demo/image/upload/sample.jpg",
      { folder: "test" },
      (error, result) => {
        if (error) {
          console.log("❌ Cloudinary test failed:", error);
          return res.status(500).json({ error: `Cloudinary error: ${error.message}` });
        }
        console.log("✅ Cloudinary test passed");
        res.json({ message: "Debug test passed", cloudinary: "working" });
      }
    );
  } catch (err) {
    console.log("❌ Debug endpoint error:", err);
    res.status(500).json({ error: `Debug error: ${err.message}` });
  }
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🎵 Server running on http://localhost:${PORT}`);
  console.log(`📁 Cloudinary configured: ${process.env.CLOUD_NAME ? '✅' : '❌'}`);
});