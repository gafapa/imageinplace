export async function checkCancelled(signal) {
  signal?.throwIfAborted();
  // Yield to input events even when the preceding operation completed synchronously.
  await new Promise((resolve) => setTimeout(resolve, 0));
  signal?.throwIfAborted();
}
