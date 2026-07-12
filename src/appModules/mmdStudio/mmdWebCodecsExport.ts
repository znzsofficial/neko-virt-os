import {
  AudioBufferSource,
  BufferTarget,
  canEncodeVideo,
  CanvasSource,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
  Mp4OutputFormat,
  Output,
  WebMOutputFormat,
  type AudioCodec,
  type VideoCodec,
} from "mediabunny";
import type { MmdExportCodec } from "./mmdStudioStore";

export function isWebCodecsExportSupported() {
  return typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined";
}

function evenDim(n: number) {
  const v = Math.max(2, Math.round(n));
  return v % 2 === 0 ? v : v - 1;
}

function videoCodecCandidates(prefer: MmdExportCodec): VideoCodec[] {
  if (prefer === "vp8") return ["vp8", "vp9", "avc"];
  if (prefer === "vp9") return ["vp9", "vp8", "avc"];
  // auto / h264 → prefer AVC (MP4)
  return ["avc", "vp9", "vp8"];
}

function audioCodecCandidates(videoCodec: VideoCodec): AudioCodec[] {
  if (videoCodec === "avc") return ["aac", "opus"];
  return ["opus", "aac"];
}

async function decodeAudioUrl(url: string): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    const ctx = new AudioContext();
    try {
      return await ctx.decodeAudioData(buf.slice(0));
    } finally {
      void ctx.close();
    }
  } catch {
    return null;
  }
}

function sliceAudioBuffer(source: AudioBuffer, startSec: number, endSec: number): AudioBuffer | null {
  const sampleRate = source.sampleRate;
  const start = Math.max(0, Math.floor(startSec * sampleRate));
  const end = Math.min(source.length, Math.ceil(endSec * sampleRate));
  const length = Math.max(1, end - start);
  const tmp = new AudioContext();
  try {
    const out = tmp.createBuffer(source.numberOfChannels, length, sampleRate);
    for (let ch = 0; ch < source.numberOfChannels; ch += 1) {
      const src = source.getChannelData(ch);
      out.copyToChannel(src.subarray(start, start + length), ch);
    }
    return out;
  } finally {
    void tmp.close();
  }
}

export type WebCodecsExportOptions = {
  canvas: HTMLCanvasElement;
  fps: number;
  startTime: number;
  endTime: number;
  videoBitrate: number;
  audioBitrate: number;
  preferCodec: MmdExportCodec;
  includeAudio: boolean;
  audioUrl: string | null;
  seek: (time: number) => void;
  waitFrame: () => Promise<void>;
  onProgress?: (ratio: number, frame: number, total: number) => void;
  isCancelled?: () => boolean;
};

export type WebCodecsExportResult = {
  blob: Blob;
  mimeType: string;
  extension: "mp4" | "webm";
  videoCodec: VideoCodec;
  frameCount: number;
};

export async function exportWithWebCodecs(options: WebCodecsExportOptions): Promise<WebCodecsExportResult> {
  if (!isWebCodecsExportSupported()) {
    throw new Error("WebCodecs not supported");
  }

  // Caller should already even via setRecordingCanvasSize; re-even as safety.
  const encodeWidth = evenDim(options.canvas.width || 1920);
  const encodeHeight = evenDim(options.canvas.height || 1080);

  const fps = Math.max(1, options.fps);
  const frameDuration = 1 / fps;
  const start = Math.max(0, options.startTime);
  const end = Math.max(start + frameDuration, options.endTime);
  const frameCount = Math.max(1, Math.floor((end - start) / frameDuration) + 1);

  const bitrate = Math.max(500_000, Math.round(options.videoBitrate));
  const videoCodec = await getFirstEncodableVideoCodec(videoCodecCandidates(options.preferCodec), {
    width: encodeWidth,
    height: encodeHeight,
    bitrate,
  });
  if (!videoCodec) {
    throw new Error("No encodable video codec");
  }

  // Sanity check with explicit size.
  const ok = await canEncodeVideo(videoCodec, { width: encodeWidth, height: encodeHeight, bitrate });
  if (!ok) {
    throw new Error(`Cannot encode ${videoCodec} at ${encodeWidth}x${encodeHeight}`);
  }

  const useMp4 = videoCodec === "avc";
  const target = new BufferTarget();
  const output = new Output({
    format: useMp4 ? new Mp4OutputFormat() : new WebMOutputFormat(),
    target,
  });

  const videoSource = new CanvasSource(options.canvas, {
    codec: videoCodec,
    bitrate,
    keyFrameInterval: 2,
    latencyMode: "quality",
  });
  output.addVideoTrack(videoSource);

  let audioSource: AudioBufferSource | null = null;
  let slicedAudio: AudioBuffer | null = null;
  if (options.includeAudio && options.audioUrl) {
    const decoded = await decodeAudioUrl(options.audioUrl);
    if (decoded) {
      slicedAudio = sliceAudioBuffer(decoded, start, end);
      const audioCodec = await getFirstEncodableAudioCodec(audioCodecCandidates(videoCodec), {
        numberOfChannels: slicedAudio?.numberOfChannels ?? 2,
        sampleRate: slicedAudio?.sampleRate ?? 48000,
        bitrate: options.audioBitrate,
      });
      if (audioCodec && slicedAudio) {
        audioSource = new AudioBufferSource({
          codec: audioCodec,
          bitrate: Math.max(64_000, options.audioBitrate),
        });
        output.addAudioTrack(audioSource);
      }
    }
  }

  await output.start();

  try {
    for (let i = 0; i < frameCount; i += 1) {
      if (options.isCancelled?.()) {
        throw new Error("cancelled");
      }
      const time = Math.min(end, start + i * frameDuration);
      options.seek(time);
      // Two rAFs: settle animation + post FX present.
      await options.waitFrame();
      await options.waitFrame();
      await videoSource.add(i * frameDuration, frameDuration, {
        keyFrame: i === 0 || i % Math.max(1, Math.round(fps * 2)) === 0,
      });
      options.onProgress?.((i + 1) / frameCount, i + 1, frameCount);
    }

    if (audioSource && slicedAudio) {
      await audioSource.add(slicedAudio);
    }

    await output.finalize();
  } catch (error) {
    try {
      await output.cancel();
    } catch {
      // ignore
    }
    throw error;
  }

  const buffer = target.buffer;
  if (!buffer) throw new Error("Empty export buffer");
  const mimeType = useMp4 ? "video/mp4" : "video/webm";
  return {
    blob: new Blob([buffer], { type: mimeType }),
    mimeType,
    extension: useMp4 ? "mp4" : "webm",
    videoCodec,
    frameCount,
  };
}
