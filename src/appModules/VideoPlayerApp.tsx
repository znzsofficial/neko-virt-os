import { Icon } from "@iconify-icon/react";
import { clsx } from "clsx";
import { useRef } from "react";
import { formatBytes } from "../formatUtils";
import { useLanguageStore } from "../languageStore";
import { useLocalMediaPlaylist } from "./useLocalMediaPlaylist";

type FullscreenVideoElement = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

export function VideoPlayerApp() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const t = useLanguageStore((state) => state.t);
  const { items: videos, currentItem: currentVideo, currentItemId: currentVideoId, playing, setPlaying, addFiles, togglePlayback, selectItem, moveItem, removeItem } = useLocalMediaPlaylist("video", videoRef);

  function enterFullscreen() {
    const video = videoRef.current as FullscreenVideoElement | null;
    if (!video) return;
    if (video.requestFullscreen) {
      void video.requestFullscreen().catch(() => video.webkitEnterFullscreen?.());
      return;
    }
    video.webkitEnterFullscreen?.();
  }

  return (
    <div className="video-player-app">
      <section className="video-screen">
        {currentVideo ? (
          <video
            ref={videoRef}
            controls
            src={currentVideo.url}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => moveItem(1)}
          />
        ) : (
          <div className="video-empty-screen">
            <Icon icon="solar:video-frame-play-horizontal-bold-duotone" width={54} height={54} />
            <p>{t("videoNoFiles")}</p>
          </div>
        )}
      </section>

      <section className="video-now-playing">
        <div>
          <span>{t("videoNowPlaying")}</span>
          <h2>{currentVideo?.name ?? t("videoNoFiles")}</h2>
          {currentVideo ? <p>{formatBytes(currentVideo.size)}</p> : null}
        </div>
        <div className="video-controls">
          <label className="button-ghost video-upload-button">
            {t("videoAddFiles")}
            <input type="file" accept="video/*" multiple onChange={(event) => addFiles(event.target.files)} />
          </label>
          <button className="button-ghost" onClick={() => moveItem(-1)} disabled={!videos.length}>{t("previous")}</button>
          <button className="button-primary" onClick={togglePlayback} disabled={!currentVideo}>{playing ? t("musicPause") : t("musicPlay")}</button>
          <button className="button-ghost" onClick={() => moveItem(1)} disabled={!videos.length}>{t("next")}</button>
          <button className="button-ghost" onClick={enterFullscreen} disabled={!currentVideo}>{t("videoFullscreen")}</button>
        </div>
      </section>

      <section className="video-playlist">
        <h3>{t("videoPlaylist")}</h3>
        <div className="video-list">
          {videos.length ? videos.map((video) => (
            <div key={video.id} className={clsx("video-item", currentVideoId === video.id && "is-active")}>
              <button type="button" onClick={() => selectItem(video.id)}>
                <Icon icon="solar:video-frame-play-horizontal-bold-duotone" width={22} height={22} />
                <span>{video.name}</span>
                <small>{formatBytes(video.size)}</small>
              </button>
              <button type="button" className="video-remove" aria-label={t("videoRemoveFile")} onClick={() => removeItem(video.id)}>×</button>
            </div>
          )) : <div className="empty-state compact"><p>{t("videoNoFiles")}</p></div>}
        </div>
      </section>
    </div>
  );
}
