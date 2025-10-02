import React, { useState } from 'react';
import SongList from '../pages/SongList';
import UploadForm from '../pages/UploadForm';
import Player from '../pages/Player';
import '../pages/App.css'

function App() {
  const [currentSong, setCurrentSong] = useState(null);
  const [view, setView] = useState('songs');

  return (
    <div className="app">
      <header className="app-header">
        <h1>🎵 Music Stream</h1>
        <nav>
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

      <main className="main-content">
        {view === 'songs' ? (
          <SongList onSongSelect={setCurrentSong} />
        ) : (
          <UploadForm />
        )}
      </main>

      {currentSong && (
        <Player
          song={currentSong}
          onClose={() => setCurrentSong(null)}
        />
      )}
    </div>
  );
}

export default App;