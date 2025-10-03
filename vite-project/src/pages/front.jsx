import React, { useState } from 'react';
import SongList from '../pages/SongList';
import UploadForm from '../pages/UploadForm';
import Player from '../pages/Player';
import '../basic.css';

function App() {
  const [currentSong, setCurrentSong] = useState(null);
  const [view, setView] = useState('songs');

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-title">🎵 Music Stream</h1>
        <nav className="app-nav">
          <button
            className={view === 'songs' ? 'active' : ''}
            onClick={() => setView('songs')}
          >
            All Songs
          </button>
          <button
            className={view === 'upload' ? 'active' : ''}
            onClick={() => setView('upload')}
          >
            Upload Song
          </button>
        </nav>
      </header>

      <main className="app-main">
        {view === 'songs' ? (
          <SongList onSongSelect={setCurrentSong} />
        ) : (
          <UploadForm />
        )}
      </main>

      {currentSong && (
        <div className="player-overlay">
          <Player
            song={currentSong}
            onClose={() => setCurrentSong(null)}
          />
        </div>
      )}
    </div>
  );
}

export default App;