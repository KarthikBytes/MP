import React, { useRef, useEffect, useState } from 'react';

function Player({ song, onClose }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const handleEnd = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('ended', handleEnd);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('ended', handleEnd);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, []);

  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolume = (e) => {
    const newVolume = parseFloat(e.target.value);
    audioRef.current.volume = newVolume;
    setVolume(newVolume);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = () => {
    const duration = audioRef.current?.duration || 1;
    return (currentTime / duration) * 100;
  };

  return (
    <div className="player">
      <div className="player-header">
        <h3>Now Playing</h3>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="player-content">
        <div className="song-details">
          <h4>{song.title}</h4>
          <p className="artist">🎤 {song.artist}</p>
          <p className="album">💿 {song.album || 'Single'}</p>
          <p className="meta">🎵 {song.genre} • ⏱️ {formatTime(song.duration)}</p>
        </div>

        <audio
          ref={audioRef}
          src={song.url}
          preload="metadata"
        />

        <div className="player-controls">
          <div className="progress-bar">
            <span className="time current">{formatTime(currentTime)}</span>
            <div className="seek-container">
              <input
                type="range"
                min="0"
                max={audioRef.current?.duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="seek-bar"
                style={{ background: `linear-gradient(to right, #764ba2 0%, #764ba2 ${getProgressPercentage()}%, #e0e0e0 ${getProgressPercentage()}%, #e0e0e0 100%)` }}
              />
            </div>
            <span className="time total">{formatTime(audioRef.current?.duration || 0)}</span>
          </div>

          <div className="control-buttons">
            <button onClick={togglePlay} className="play-pause-btn">
              {isPlaying ? '⏸️ Pause' : '▶️ Play'}
            </button>

            <div className="volume-control">
              <span>🔊</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolume}
                className="volume-bar"
              />
              <span className="volume-text">{Math.round(volume * 100)}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Player;