// Downloads feature — public surface.
//
// Player owns: storage, queue, progress, file lifecycle.
// Consumer owns: where to put the Download button, how to render the
// downloads list, what to do when a download fails.
//
// Typical consumer usage:
//
//   import {
//     downloadVideo,
//     cancelDownload,
//     deleteDownload,
//     useDownloadStatus,
//     useAllDownloads,
//     isDownloadable,
//   } from '@/packages/react-native-video';
//
//   const status = useDownloadStatus(video.id);
//   if (isDownloadable(video) && status.state === 'idle') {
//     <Button onPress={() => downloadVideo(video)}>Download</Button>
//   }

export {
  cancelDownload,
  deleteDownload,
  downloadVideo,
  getLocalUri,
  getStatus,
  hydrate,
  type DownloadInput,
  type DownloadState,
  type DownloadStatus,
} from './manager';
export { isDownloadable } from './isDownloadable';
export {
  type DownloadRecord,
  totalDiskUsage,
} from './storage';
export { useAllDownloads, useDownloadStatus } from './useDownloads';
