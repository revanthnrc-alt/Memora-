import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';

const isDev = import.meta.env.DEV;

interface RemoteImageProps {
  src: string;
  alt?: string;
  className?: string;
  devMode?: boolean;
}

const RemoteImage: React.FC<RemoteImageProps> = ({ src, alt, className, devMode }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [showUrl, setShowUrl] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (blobUrl) {
        try { URL.revokeObjectURL(blobUrl); } catch { /* ignore */ }
      }
    };
  }, [blobUrl, src]);

  if (!src) return <div className={`${className} flex items-center justify-center glass-card text-[#7A7582]`}>No image</div>;

  const effectiveSrc = blobUrl || src;
  const key = `${effectiveSrc}-${attempt}`;

  const tryFetchBlob = async (url: string) => {
    if (isDev) console.debug('[RemoteImage] trying fetch blob fallback for', url);
    try {
      const headers: Record<string, string> = { 'ngrok-skip-browser-warning': '1' };
      const resp = await fetch(url, { headers });
      if (!resp.ok) throw new Error('fetch status ' + resp.status);
      const b = await resp.blob();
      try {
        if (isDev) console.debug('[RemoteImage] fetched blob', { size: b.size, type: b.type });
        const slice = await b.slice(0, 16).arrayBuffer();
        const bytes = new Uint8Array(slice);
        const hex = Array.from(bytes).map(x => x.toString(16).padStart(2, '0')).join(' ');
        if (isDev) console.debug('[RemoteImage] blob head bytes', hex);
        const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
        const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length-2] === 0xff;
        if (!isPng && !isJpg) {
          console.warn('[RemoteImage] fetched blob does not look like PNG/JPEG');
        }
      } catch (diagErr) { if (isDev) console.debug('[RemoteImage] blob diagnostics failed', diagErr); }
      const o = URL.createObjectURL(b);
      setBlobUrl(o);
      setError(null);
      setLoading(false);
      if (isDev) console.debug('[RemoteImage] fetch blob fallback succeeded', url);
      return true;
    } catch (err) {
      console.warn('[RemoteImage] fetch blob fallback failed', url, err);
      return false;
    }
  };

  return (
    <div className={`${className} relative`}> 
      {loading && !error && (
        <div className="w-full h-full flex items-center justify-center glass-card text-[#7A7582]">
          Loading...
        </div>
      )}
      {error && (
        <div className="w-full h-full flex flex-col items-center justify-center glass-card text-[#A8A0B4] p-4">
          <div className="text-sm mb-3">Image failed to load</div>
          {devMode && (
            <div className="flex gap-2">
              <button 
                className="px-4 py-2 rounded-xl text-xs glass-card touch-feedback" 
                onClick={async () => { 
                  setError(null); 
                  setLoading(true); 
                  setAttempt(a => a + 1); 
                  if (isDev) console.debug('[RemoteImage] retry', src); 
                  const ok = await tryFetchBlob(src); 
                  if (!ok) setError('failed'); 
                }}
              >
                Retry
              </button>
              <button 
                className="px-4 py-2 rounded-xl text-xs glass-card touch-feedback" 
                onClick={() => setShowUrl(s => !s)}
              >
                {showUrl ? 'Hide URL' : 'Show URL'}
              </button>
            </div>
          )}
          {devMode && showUrl && <div className="mt-2 text-xs break-all">{src}</div>}
        </div>
      )}
      {!error && (
        <img
          key={key}
          src={effectiveSrc}
          alt={alt}
          className="w-full h-full object-cover"
          onLoad={() => { if (isDev) console.debug('[RemoteImage] loaded', effectiveSrc); setLoading(false); setError(null); }}
          onError={async (e) => {
            console.error('[RemoteImage] load error', effectiveSrc, e);
            setLoading(false);
            if (!blobUrl) {
              const ok = await tryFetchBlob(src);
              if (!ok) setError('failed');
            } else {
              setError('failed');
            }
          }}
        />
      )}
      {devMode && !error && (
        <button 
          className="absolute top-2 right-2 text-xs px-3 py-1.5 rounded-lg glass-card text-[#A8A0B4]" 
          onClick={() => setShowUrl(s => !s)}
        >
          {showUrl ? 'Hide URL' : 'URL'}
        </button>
      )}
      {devMode && showUrl && !error && (
        <div className="absolute bottom-2 left-2 text-xs glass-card px-2 py-1 rounded-lg break-all max-w-[90%]">
          {src}
        </div>
      )}
    </div>
  );
};

interface MemoryAlbumViewProps {
  onBack: () => void;
}

const MemoryAlbumView: React.FC<MemoryAlbumViewProps> = ({ onBack }) => {
  const { state } = useAppContext();
  const devMode = state.devMode;
  const { memories } = state;

  return (
    <div className="relative p-4 sm:p-6 h-[calc(100vh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex flex-col glass-card rounded-3xl">
      <header className="flex items-center mb-6 border-b border-[rgba(255,255,255,0.06)] pb-4">
        <button onClick={onBack} className="text-[#A8A0B4] text-sm p-2 rounded-xl touch-feedback flex items-center gap-1">
          <span className='text-lg'>&larr;</span> Back
        </button>
        <h2 className="font-display text-2xl font-semibold text-[#F5F0E8] ml-2">Your Memory Album</h2>
      </header>
      
      {memories.length === 0 ? (
        <div className="flex-grow flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[#C9B896] to-[#B8A9C9] mb-4 text-3xl">
            📷
          </div>
          <h3 className="font-display text-2xl font-medium text-[#A8A0B4]">No memories yet.</h3>
          <p className="text-[#7A7582] mt-2">Your family can share photos with you here.</p>
        </div>
      ) : (
        <div className="space-y-6 overflow-y-auto pr-2 flex-grow pb-4">
          {memories.map(memory => {
            if (isDev) console.debug('[MemoryAlbumView] rendering memory', { id: memory.id, imageUrl: memory.imageUrl });
            return (
              <div key={memory.id} className="rounded-2xl overflow-hidden glass-card">
                <RemoteImage src={memory.imageUrl} alt={memory.caption} className="w-full h-60" devMode={devMode} />
                <div className="p-4">
                  <p className="font-display text-lg text-[#F5F0E8] italic">"{memory.caption}"</p>
                  <p className="text-right text-sm text-[#A8A0B4] mt-2">- {memory.sharedBy}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MemoryAlbumView;
