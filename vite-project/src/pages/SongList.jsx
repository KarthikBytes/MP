import React, { useEffect, useState } from 'react';

function SongList({ onSongSelect }) {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterMood, setFilterMood] = useState('all');

  const moods = [
    { value: 'all', label: 'All Moods' },
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

  useEffect(() => {
    fetchSongs();
  }, [filterMood]);

  const fetchSongs = async () => {
    try {
      setLoading(true);
      const url = filterMood === 'all' 
        ? "http://localhost:5000/songs" 
        : `http://localhost:5000/songs/${filterMood}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch songs');
      const data = await response.json();
      setSongs(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getMoodEmoji = (mood) => {
    const moodObj = moods.find(m => m.value === mood);
    return moodObj ? moodObj.label.split(' ')[0] : '🎵';
  };

  if (loading) return <div className="loading">Loading songs...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="song-list">
      <div className="song-list-header">
        <h2>🎵 All Songs ({songs.length})</h2>
        
        <div className="mood-filter">
          <label>Filter by Mood:</label>
          <select 
            value={filterMood} 
            onChange={(e) => setFilterMood(e.target.value)}
          >
            {moods.map(mood => (
              <option key={mood.value} value={mood.value}>
                {mood.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="songs-grid">
        {songs.map(song => (
          <div key={song.id} className="song-card">
            <div className="song-header">
              <span className="mood-badge">{getMoodEmoji(song.mood)}</span>
              <h3>{song.title}</h3>
            </div>
            
            <div className="song-info">
              <p className="artist">🎤 {song.artist}</p>
              <p className="album">💿 {song.album || 'Single'}</p>
              <p className="meta">
                🎵 {song.genre} • ⏱️ {formatDuration(song.duration)}
              </p>
            </div>
            
            <div className="song-actions">
              <button 
                className="play-btn"
                onClick={() => onSongSelect(song)}
              >
                ▶ Play Full Song
              </button>
              <audio 
                controls 
                src={song.url}
                className="audio-preview"
              >
                Your browser does not support audio.
              </audio>
            </div>
          </div>
        ))}
      </div>

      {songs.length === 0 && (
        <div className="no-songs">
          <p>No songs found. Upload some music to get started! 🎵</p>
        </div>
      )}
    </div>
  );
}

const formatDuration = (seconds) => {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default SongList;