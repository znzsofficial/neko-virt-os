import { Icon } from "@iconify-icon/react";
import { clsx } from "clsx";
import { useRef } from "react";
import { formatBytes } from "../formatUtils";
import { useLanguageStore } from "../languageStore";
import { useLocalMediaPlaylist } from "./useLocalMediaPlaylist";

export function MusicPlayerApp() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const t = useLanguageStore((state) => state.t);
  const { items: tracks, currentItem: currentTrack, currentItemId: currentTrackId, playing, setPlaying, addFiles, togglePlayback, selectItem, moveItem, removeItem } = useLocalMediaPlaylist("audio", audioRef);

  return (
    <div className="music-player-app">
      <section className="music-now-playing">
        <div className="music-cover">
          <Icon icon="solar:music-note-3-bold-duotone" width={54} height={54} />
        </div>
        <div>
          <span>{t("musicNowPlaying")}</span>
          <h2>{currentTrack?.name ?? t("musicNoTracks")}</h2>
          {currentTrack ? <p>{formatBytes(currentTrack.size)}</p> : null}
        </div>
      </section>

      <audio ref={audioRef} controls src={currentTrack?.url} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => moveItem(1)} />

      <div className="music-controls">
        <label className="button-ghost music-upload-button">
          {t("musicAddFiles")}
          <input type="file" accept="audio/*" multiple onChange={(event) => addFiles(event.target.files)} />
        </label>
        <button className="button-ghost" onClick={() => moveItem(-1)} disabled={!tracks.length}>{t("previous")}</button>
        <button className="button-primary" onClick={togglePlayback} disabled={!currentTrack}>{playing ? t("musicPause") : t("musicPlay")}</button>
        <button className="button-ghost" onClick={() => moveItem(1)} disabled={!tracks.length}>{t("next")}</button>
      </div>

      <section className="music-playlist">
        <h3>{t("musicPlaylist")}</h3>
        <div className="music-track-list">
          {tracks.length ? tracks.map((track) => (
            <div key={track.id} className={clsx("music-track", currentTrackId === track.id && "is-active")}>
              <button type="button" onClick={() => selectItem(track.id)}>
                <Icon icon="solar:music-note-slider-bold-duotone" width={22} height={22} />
                <span>{track.name}</span>
                <small>{formatBytes(track.size)}</small>
              </button>
              <button type="button" className="music-remove" aria-label={t("musicRemoveTrack")} onClick={() => removeItem(track.id)}>×</button>
            </div>
          )) : <div className="empty-state compact"><p>{t("musicNoTracks")}</p></div>}
        </div>
      </section>
    </div>
  );
}
