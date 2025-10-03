import React, { useState } from 'react';

function UploadForm() {
  const [mode, setMode] = useState('mp3'); // 'mp3' or 'youtube'
  const [mood, setMood] = useState('love');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');

  const moods = [
    { value: 'love', label: '💖 Love' },
    { value: 'sadness', label: '😢 Sadness' },
    { value: 'old_melody', label: '🎶 Old Melody' },
    { value: 'energy', label: '⚡ Energy' }
  ];

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setMessage('');
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
    testData.append('mood', mood);

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

    if (mode === 'mp3' && !file) {
      setMessage('❌ Please select a song file');
      return;
    }
    if (mode === 'youtube' && !youtubeUrl) {
      setMessage('❌ Please provide a YouTube link');
      return;
    }

    setUploading(true);
    setMessage('📤 Uploading... Please wait');

    const submitData = new FormData();
    submitData.append('mood', mood);
    if (mode === 'mp3') submitData.append('song', file);
    if (mode === 'youtube') submitData.append('youtubeUrl', youtubeUrl);

    try {
      const response = await fetch('http://localhost:5000/upload-simple', {
        method: 'POST',
        body: submitData,
      });

      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        throw new Error('Server returned invalid JSON response');
      }

      if (response.ok) {
        setMessage(`✅ ${result.message} | Mood: ${result.mood}`);
        setMood('love');
        setFile(null);
        setYoutubeUrl('');
        document.getElementById('file-input') && (document.getElementById('file-input').value = '');
      } else {
        let errorMessage = 'Upload failed';
        if (result) {
          if (result.error) errorMessage = result.error;
          else if (result.message) errorMessage = result.message;
          else if (typeof result === 'string') errorMessage = result;
          else errorMessage = JSON.stringify(result);
        }
        setMessage(`❌ ${errorMessage}`);
      }
    } catch (err) {
      setMessage(`❌ Network error: ${err.message}. Check if backend is running.`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="upload-form">
      <div className="upload-form-inner">
        <h2>📤 Upload New Song</h2>
        {/* Debug buttons */}
        <div className="debug-buttons">
          <button
            type="button"
            onClick={testConnection}
          >
            Test Connection
          </button>
          <button
            type="button"
            onClick={testUpload}
            disabled={uploading}
          >
            Test Upload
          </button>
        </div>
        {/* Mode toggle */}
        <div className="mode-toggle">
          <button
            type="button"
            onClick={() => setMode('mp3')}
            disabled={mode === 'mp3'}
          >
            Upload MP3
          </button>
          <button
            type="button"
            onClick={() => setMode('youtube')}
            disabled={mode === 'youtube'}
          >
            Upload from YouTube
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Song Mood *</label>
            <select
              name="mood"
              value={mood}
              onChange={e => setMood(e.target.value)}
              required
            >
              {moods.map(mood => (
                <option key={mood.value} value={mood.value}>
                  {mood.label}
                </option>
              ))}
            </select>
          </div>
          {mode === 'mp3' && (
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
          )}
          {mode === 'youtube' && (
            <div className="form-group">
              <label>YouTube Video Link *</label>
              <input
                type="url"
                value={youtubeUrl}
                onChange={e => setYoutubeUrl(e.target.value)}
                placeholder="Paste YouTube video link here"
                required
              />
            </div>
          )}
          <button
            type="submit"
            disabled={uploading}
            className="upload-btn"
          >
            {uploading ? 'Uploading...' : `Upload to ${mood} folder`}
          </button>
          {message && (
            <div className="message">
              {message}
            </div>
          )}
        </form>
        <div className="upload-info">
          <h3>ℹ️ Upload Instructions:</h3>
          <ul>
            <li>Supported formats: MP3, WAV, M4A, FLAC, AAC</li>
            <li>Max file size: 50MB</li>
            <li>Or paste a YouTube video link to extract audio automatically</li>
            <li>Songs are organized in mood-based folders in Cloudinary</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default UploadForm;