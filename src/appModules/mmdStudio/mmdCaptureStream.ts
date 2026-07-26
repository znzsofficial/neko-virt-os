export function stopCaptureVideoTracks(stream: Pick<MediaStream, "getVideoTracks"> | null | undefined) {
  stream?.getVideoTracks().forEach((track) => track.stop());
}
