import React, { useState, useEffect } from 'react';

function UploadForm() {
  const [formData, setFormData] = useState({
    title: '',
    artist_name: '',
    album_name: '',
    genre: '',
    duration: '',
    mood: 'love'
  });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [artistSuggestions, setArtistSuggestions] = useState([]);
  const [albumSuggestions, setAlbumSuggestions] = useState([]);

  const moods = [
    { value: 'love', label: '💖 Love' },
    { value: 'happy', label: '😊 Happy' },
    { value: 'sad', label: '😢 Sad' },
    { value: 'energetic', label: '⚡ Energetic' },
    { value: 'relaxed', label: '😌 Relaxed' },
    { value: 'romantic', label: '🌹 Romantic' },
    { value: 'party', label: '🎉 Party' },
    { value: 'workout', label: '💪 Workout' },
    { value: 'chill', label: '🌴 Chill' }
  ];

  const genres = [
    'Pop', 'Rock', 'Hip Hop', 'Jazz', 'Classical', 'Electronic',
    'R&B', 'Country', 'Metal', 'Blues', 'Reggae', 'Folk', 'Other'
  ];

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Search artists as user types
  useEffect(() => {
    if (formData.artist_name.length > 2) {
      searchArtists(formData.artist_name);
    } else {
      setArtistSuggestions([]);
    }
  }, [formData.artist_name]);

  // Search albums as user types
  useEffect(() => {
    if (formData.album_name.length > 2) {
      searchAlbums(formData.album_name);
    } else {
      setAlbumSuggestions([]);
    }
  }, [formData.album_name]);

  const searchArtists = async (query) => {
    try {
      const response = await fetch(`http://localhost:5000/artists/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setArtistSuggestions(data);
    } catch (err) {
      console.error('Error searching artists:', err);
    }
  };

  const searchAlbums = async (query) => {
    try {
      const response = await fetch(`http://localhost:5000/albums/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setAlbumSuggestions(data);
    } catch (err) {
      console.error('Error searching albums:', err);
    }
  };

  const selectArtist = (artistName) => {
    setFormData(prev => ({ ...prev, artist_name: artistName }));
    setArtistSuggestions([]);
  };

  const selectAlbum = (albumName) => {
    setFormData(prev => ({ ...prev, album_name: albumName }));
    setAlbumSuggestions([]);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    
    // Auto-detect duration
    if (selectedFile) {
      const audio = new Audio(URL.createObjectURL(selectedFile));
      audio.onloadedmetadata = () => {
        setFormData(prev => ({
          ...prev,
          duration: Math.round(audio.duration)
        }));
      };
      
      // Clear any previous messages
      setMessage('');
    }
  };

  const testConnection = async () => {
    try {
      setMessage('🔍 Testing connection...');
      const response = await fetch('http://localhost:5000/');
      const data = await response.json();
      setMessage(`✅ Backend connected: ${data.message}`);
    } catch (err) {
      setMessage(`❌ Cannot connect to backend: ${err.message}`);
    }
  };

  const testUpload = async () => {
    if (!file) {
      setMessage('❌ Please select a file first');
      return;
    }

    setUploading(true);
    setMessage('🧪 Testing upload...');

    const testData = new FormData();
    testData.append('song', file);
    testData.append('title', 'Test Song');

    try {
      const response = await fetch('http://localhost:5000/test-upload', {
        method: 'POST',
        body: testData,
      });

      const result = await response.json();
      
      if (response.ok) {
        setMessage(`✅ Test successful! File: ${result.filename}, Size: ${(result.size / 1024 / 1024).toFixed(2)}MB`);
      } else {
        setMessage(`❌ Test failed: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      setMessage(`❌ Test error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form before submitting
    if (!file) {
      setMessage('❌ Please select a song file');
      return;
    }

    if (!formData.title || !formData.artist_name || !formData.genre || !formData.duration) {
      setMessage('❌ Please fill all required fields: Title, Artist Name, Genre, and Duration');
      return;
    }

    setUploading(true);
    setMessage('📤 Uploading... Please wait');

    const submitData = new FormData();
    submitData.append('song', file);
    Object.keys(formData).forEach(key => {
      submitData.append(key, formData[key]);
    });

    try {
      console.log("📤 Starting upload...", {
        title: formData.title,
        artist: formData.artist_name,
        file: file.name,
        size: file.size
      });

      const response = await fetch('http://localhost:5000/upload', {
        method: 'POST',
        body: submitData,
      });

      console.log("📥 Response status:", response.status);
      
      let result;
      try {
        result = await response.json();
        console.log("📥 Response data:", result);
      } catch (parseError) {
        console.error("❌ Failed to parse response:", parseError);
        throw new Error('Server returned invalid JSON response');
      }
      
      if (response.ok) {
        setMessage(`✅ ${result.message} | Artist: ${result.artist} | Mood: ${result.mood}`);
        // Reset form
        setFormData({ 
          title: '', 
          artist_name: '', 
          album_name: '', 
          genre: '', 
          duration: '', 
          mood: 'love' 
        });
        setFile(null);
        document.getElementById('file-input').value = '';
        setArtistSuggestions([]);
        setAlbumSuggestions([]);
      } else {
        // Extract error message properly
        let errorMessage = 'Upload failed';
        
        if (result) {
          if (result.error) {
            errorMessage = result.error;
          } else if (result.message) {
            errorMessage = result.message;
          } else if (typeof result === 'string') {
            errorMessage = result;
          } else {
            errorMessage = JSON.stringify(result);
          }
        }
        
        setMessage(`❌ ${errorMessage}`);
      }
    } catch (err) {
      console.error("❌ Network error:", err);
      setMessage(`❌ Network error: ${err.message}. Check if backend is running.`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="upload-form">
      <h2>📤 Upload New Song</h2>
      
      {/* Debug buttons */}
      <div className="debug-buttons" style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button 
          type="button" 
          onClick={testConnection}
          className="test-btn"
          style={{ padding: '8px 16px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          Test Connection
        </button>
        <button 
          type="button" 
          onClick={testUpload}
          disabled={uploading}
          className="test-btn"
          style={{ padding: '8px 16px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          Test Upload
        </button>
      </div>

      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label>Song Title *</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Enter song title"
            required
          />
        </div>

        <div className="form-group">
          <label>Artist Name *</label>
          <input
            type="text"
            name="artist_name"
            value={formData.artist_name}
            onChange={handleChange}
            placeholder="Start typing artist name..."
            required
          />
          {artistSuggestions.length > 0 && (
            <div className="suggestions-dropdown">
              {artistSuggestions.map(artist => (
                <div 
                  key={artist.id} 
                  className="suggestion-item"
                  onClick={() => selectArtist(artist.name)}
                >
                  {artist.name}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-group">
          <label>Album Name</label>
          <input
            type="text"
            name="album_name"
            value={formData.album_name}
            onChange={handleChange}
            placeholder="Enter album name (optional)"
          />
          {albumSuggestions.length > 0 && (
            <div className="suggestions-dropdown">
              {albumSuggestions.map(album => (
                <div 
                  key={album.id} 
                  className="suggestion-item"
                  onClick={() => selectAlbum(album.title)}
                >
                  {album.title}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Genre *</label>
            <select
              name="genre"
              value={formData.genre}
              onChange={handleChange}
              required
            >
              <option value="">Select Genre</option>
              {genres.map(genre => (
                <option key={genre} value={genre}>{genre}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Duration (seconds) *</label>
            <input
              type="number"
              name="duration"
              value={formData.duration}
              onChange={handleChange}
              placeholder="Auto-detected when file selected"
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label>Song Mood *</label>
          <select 
            name="mood" 
            value={formData.mood} 
            onChange={handleChange}
            className="mood-select"
            required
          >
            {moods.map(mood => (
              <option key={mood.value} value={mood.value}>
                {mood.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Audio File *</label>
          <input
            id="file-input"
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            required
          />
          {file && (
            <div className="file-info">
              Selected: {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB) - {file.type}
            </div>
          )}
        </div>

        <button 
          type="submit" 
          disabled={uploading}
          className="upload-btn"
        >
          {uploading ? 'Uploading...' : `Upload to ${formData.mood} folder`}
        </button>

        {message && (
          <div className={`message ${message.includes('✅') || message.includes('🔍') || message.includes('🧪') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}
      </form>

      <div className="upload-info">
        <h3>ℹ️ Upload Instructions:</h3>
        <ul>
          <li>Supported formats: MP3, WAV, M4A, FLAC, AAC</li>
          <li>Max file size: 50MB</li>
          <li>Artist name will be created automatically if it doesn't exist</li>
          <li>Album name is optional - leave empty for singles</li>
          <li>Duration is auto-detected when you select a file</li>
          <li>Songs are organized in mood-based folders in Cloudinary</li>
        </ul>
        
        <h4>🔧 Debugging:</h4>
        <ul>
          <li>Use "Test Connection" to check backend connectivity</li>
          <li>Use "Test Upload" to verify file upload works</li>
          <li>Check browser console and backend terminal for detailed logs</li>
        </ul>
      </div>
    </div>
  );
}

export default UploadForm;