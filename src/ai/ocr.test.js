import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({ createWorker: vi.fn() }));
vi.mock('tesseract.js', () => ({ createWorker: fake.createWorker }));
import { recognizeLines, stopOcr } from './ocr.js';

const empty = { data: { blocks: [] } };
let records;
let hangRecognition;
beforeEach(() => {
  records = [];
  hangRecognition = false;
  fake.createWorker.mockReset().mockImplementation(async (languages, mode, options) => {
    const worker = { recognize: vi.fn(async () => { if (hangRecognition) return new Promise(() => {}); options.logger({ status: 'recognizing text', progress: .5 }); return empty; }), terminate: vi.fn() };
    records.push({ worker, options, languages });
    return worker;
  });
});
afterEach(async () => { await stopOcr(); });
describe('OCR request ownership', () => {
  it('routes progress to each consecutive request without retaining its predecessor', async () => {
    const first = vi.fn(); const second = vi.fn();
    await recognizeLines({}, { onProgress: first });
    await recognizeLines({}, { onProgress: second });
    expect(records).toHaveLength(1);
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    records[0].options.logger({ status: 'recognizing text', progress: 1 });
    expect(second).toHaveBeenCalledOnce();
  });
  it('cancels an in-flight recognition promptly and safely retries', async () => {
    hangRecognition = true;
    const controller = new AbortController(); const oldProgress = vi.fn();
    const pending = recognizeLines({}, { signal: controller.signal, onProgress: oldProgress });
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(records).toHaveLength(1));
    controller.abort();
    await rejected;
    hangRecognition = false;
    const progress = vi.fn();
    await recognizeLines({}, { onProgress: progress });
    records[0].options.logger({ status: 'recognizing text', progress: 1 });
    expect(oldProgress).not.toHaveBeenCalled();
    expect(progress).toHaveBeenCalledOnce();
    expect(records[0].worker.terminate).toHaveBeenCalledOnce();
  });
  it('does not let a failed cancelled initialization erase a replacement worker', async () => {
    let failOld;
    fake.createWorker.mockImplementationOnce(() => new Promise((_, reject) => { failOld = reject; }));
    const controller = new AbortController();
    const pending = recognizeLines({}, { signal: controller.signal });
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(failOld).toBeTypeOf('function'));
    controller.abort();
    await rejected;
    const first = vi.fn();
    await recognizeLines({}, { onProgress: first });
    failOld(new Error('old initialization failed'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const second = vi.fn();
    await recognizeLines({}, { onProgress: second });
    expect(fake.createWorker).toHaveBeenCalledTimes(2);
    expect(first).toHaveBeenCalledOnce(); expect(second).toHaveBeenCalledOnce();
  });
  it('uses new language assets and terminates the previous worker on a language change', async () => {
    await recognizeLines({}, { locale: 'es' });
    await recognizeLines({}, { locale: 'gl' });
    expect(records[0].worker.terminate).toHaveBeenCalledOnce();
    expect(records[1].languages).toBe('spa+eng+glg');
  });
});
