import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_HISTORY = 20;
const MAX_HISTORY_BYTES = 256 * 1024 * 1024;

export function retainedBytes(snapshots) {
  const sizes = new Map();
  for (const snapshot of snapshots) for (const item of snapshot) {
    if (item.url) sizes.set(item.url, item.size || 0);
    if (item.originalUrl) sizes.set(item.originalUrl, item.originalSize || item.file?.size || 0);
    if (item.originalThumbnailUrl) sizes.set(item.originalThumbnailUrl, item.originalThumbnailSize || 1024 * 1024);
    if (item.thumbnailUrl) sizes.set(item.thumbnailUrl, item.thumbnailSize || 1024 * 1024);
  }
  return [...sizes.values()].reduce((sum, size) => sum + size, 0);
}

const cloneItems = (items) => (Array.isArray(items) ? items.map((item) => ({ ...item })) : []);

const itemsEqual = (left, right) => {
  if (left === right) return true;
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return left.every((item, index) => {
    const other = right[index];
    if (item === other) return true;
    if (!item || !other) return item === other;
    const keys = new Set([...Object.keys(item), ...Object.keys(other)]);
    return [...keys].every((key) => Object.is(item[key], other[key]));
  });
};

/**
 * Keep a bounded undo/redo history for the gallery's image items.
 *
 * `setItems` accepts either a value or a React-style updater function. The hook
 * owns image, original and thumbnail object URLs and releases them once no
 * retained snapshot references them. All owned URLs are released on unmount.
 */
export default function useImageHistory(initialItems = []) {
  const [initialSnapshot] = useState(() => cloneItems(initialItems));
  const [items, setItemsState] = useState(initialSnapshot);
  const [availability, setAvailability] = useState({ canUndo: false, canRedo: false });
  const itemsRef = useRef(initialSnapshot);
  const pastRef = useRef([]);
  const futureRef = useRef([]);
  const knownUrlsRef = useRef(new Set());

  const rememberSnapshotUrls = useCallback((snapshots) => {
    snapshots.forEach((snapshot) => {
      snapshot.forEach((item) => {
        if (typeof item?.originalThumbnailUrl === 'string') knownUrlsRef.current.add(item.originalThumbnailUrl);
        if (typeof item?.thumbnailUrl === 'string') knownUrlsRef.current.add(item.thumbnailUrl);
        if (typeof item?.url === 'string') knownUrlsRef.current.add(item.url);
        if (typeof item?.originalUrl === 'string') knownUrlsRef.current.add(item.originalUrl);
      });
    });
  }, []);

  const publish = useCallback((snapshot) => {
    setItemsState(snapshot);
    setAvailability({ canUndo: pastRef.current.length > 0, canRedo: futureRef.current.length > 0 });
  }, []);

  const releaseUnretainedUrls = useCallback(() => {
    const retained = [itemsRef.current, ...pastRef.current, ...futureRef.current];
    rememberSnapshotUrls(retained);
    const retainedUrls = new Set();
    const retainedOriginalUrls = new Set();
    retained.forEach((snapshot) => snapshot.forEach((item) => {
      if (typeof item?.originalUrl === 'string') retainedOriginalUrls.add(item.originalUrl);
      if (typeof item?.originalThumbnailUrl === 'string') retainedUrls.add(item.originalThumbnailUrl);
      if (typeof item?.thumbnailUrl === 'string') retainedUrls.add(item.thumbnailUrl);
      if (typeof item?.url === 'string') retainedUrls.add(item.url);
    }));

    knownUrlsRef.current.forEach((url) => {
      if (retainedUrls.has(url) || retainedOriginalUrls.has(url)) return;
      if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
      knownUrlsRef.current.delete(url);
    });
  }, [rememberSnapshotUrls]);

  const commit = useCallback((nextItems) => {
    const nextSnapshot = cloneItems(nextItems);
    const currentSnapshot = cloneItems(itemsRef.current);
    if (itemsEqual(currentSnapshot, nextSnapshot)) return;

    pastRef.current = [...pastRef.current, currentSnapshot].slice(-MAX_HISTORY);
    futureRef.current = [];
    while (pastRef.current.length && retainedBytes([nextSnapshot, ...pastRef.current]) > MAX_HISTORY_BYTES) pastRef.current.shift();
    itemsRef.current = nextSnapshot;
    rememberSnapshotUrls([nextSnapshot, currentSnapshot, ...pastRef.current]);
    publish(nextSnapshot);
    releaseUnretainedUrls();
  }, [publish, rememberSnapshotUrls, releaseUnretainedUrls]);

  const setItems = useCallback((valueOrUpdater) => {
    const current = itemsRef.current;
    const next = typeof valueOrUpdater === 'function' ? valueOrUpdater(current) : valueOrUpdater;
    commit(next);
  }, [commit]);

  const undo = useCallback(() => {
    if (!pastRef.current.length) return;
    const previous = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [cloneItems(itemsRef.current), ...futureRef.current];
    itemsRef.current = cloneItems(previous);
    rememberSnapshotUrls([itemsRef.current, ...pastRef.current, ...futureRef.current]);
    publish(itemsRef.current);
    releaseUnretainedUrls();
  }, [publish, rememberSnapshotUrls, releaseUnretainedUrls]);

  const redo = useCallback(() => {
    if (!futureRef.current.length) return;
    const next = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);
    pastRef.current = [...pastRef.current, cloneItems(itemsRef.current)].slice(-MAX_HISTORY);
    itemsRef.current = cloneItems(next);
    rememberSnapshotUrls([itemsRef.current, ...pastRef.current, ...futureRef.current]);
    publish(itemsRef.current);
    releaseUnretainedUrls();
  }, [publish, rememberSnapshotUrls, releaseUnretainedUrls]);

  const restoreOriginals = useCallback((ids) => {
    const selectedIds = ids == null ? null : new Set(Array.isArray(ids) ? ids : [ids]);
    setItems((current) => current.map((item) => {
      if (selectedIds && !selectedIds.has(item.id)) return item;
      const file = item.file;
      const originalUrl = item.originalUrl || (file ? URL.createObjectURL(file) : item.url);
      return {
        ...item,
        name: item.originalName ?? file?.name ?? item.name,
        type: item.originalType ?? file?.type ?? item.type,
        size: item.originalSize ?? file?.size ?? item.size,
        url: originalUrl,
        thumbnailUrl: item.originalThumbnailUrl || undefined,
        thumbnailSize: item.originalThumbnailSize,
        width: item.originalWidth || item.width,
        height: item.originalHeight || item.height,
        ...(item.originalUrl || !file ? {} : { originalUrl }),
      };
    }));
  }, [setItems]);

  useEffect(() => {
    rememberSnapshotUrls([initialSnapshot]);
    const knownUrls = knownUrlsRef.current;
    return () => {
      knownUrls.forEach((url) => {
        if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
      });
      knownUrls.clear();
    };
  }, [initialSnapshot, rememberSnapshotUrls]);

  return {
    items,
    setItems,
    undo,
    redo,
    canUndo: availability.canUndo,
    canRedo: availability.canRedo,
    restoreOriginals,
  };
}
