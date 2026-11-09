import { useEffect, useRef, useState } from 'react';

export default function useBatchTask() {
  const controller = useRef(null);
  const [progress, setProgress] = useState(0);
  useEffect(() => () => controller.current?.abort(), []);
  const start = () => {
    controller.current?.abort();
    controller.current = new AbortController();
    setProgress(0);
    return controller.current.signal;
  };
  return { start, progress, advance: setProgress, cancel: () => controller.current?.abort() };
}

export { checkCancelled } from './batchTask.js';
