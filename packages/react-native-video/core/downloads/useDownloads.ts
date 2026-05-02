// React hooks for download status. Thin wrappers over the manager's pubsub —
// no polling, no extra state. Components re-render only when the underlying
// download status actually changes.

import { useEffect, useState } from 'react';

import {
  type DownloadStatus,
  getStatus,
  hydrate,
  subscribe,
  subscribeAll,
} from './manager';
import { type DownloadRecord, readRegistry } from './storage';

/**
 * Subscribe to a single video's download status. Returns the live status
 * (state, progress, localUri, etc.).
 */
export function useDownloadStatus(videoId: string): DownloadStatus {
  const [status, setStatus] = useState<DownloadStatus>(() => getStatus(videoId));

  useEffect(() => {
    let mounted = true;
    // Hydrate from disk on first call so status reflects already-downloaded files.
    hydrate().then(() => {
      if (mounted) setStatus(getStatus(videoId));
    });
    const unsub = subscribe(videoId, (s) => {
      if (mounted) setStatus(s);
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, [videoId]);

  return status;
}

/**
 * Subscribe to ALL downloaded videos — for the downloads-list screen.
 * Returns the registry as an array sorted newest-first by downloadedAt.
 * Refreshes whenever any download status changes.
 */
export function useAllDownloads(): DownloadRecord[] {
  const [records, setRecords] = useState<DownloadRecord[]>([]);

  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      readRegistry().then((reg) => {
        if (!mounted) return;
        const list = Object.values(reg).sort((a, b) => b.downloadedAt - a.downloadedAt);
        setRecords(list);
      });
    };

    hydrate().then(refresh);
    // Refresh on any download-status change (added, deleted, completed, etc.).
    const unsub = subscribeAll(() => refresh());
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  return records;
}
