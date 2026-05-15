export const MAX_HTTP_BODY_SIZE = 10 * 1024 * 1024;

export async function requestBodyExceedsLimit(
  request: Request,
  maxBodySize: number = MAX_HTTP_BODY_SIZE,
): Promise<boolean> {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const parsedLength = Number.parseInt(contentLength, 10);
    if (Number.isFinite(parsedLength) && parsedLength > maxBodySize) {
      return true;
    }
  }

  if (!request.body) {
    return false;
  }

  const reader = request.clone().body!.getReader();
  let receivedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        return false;
      }

      receivedBytes += value.byteLength;
      if (receivedBytes > maxBodySize) {
        await reader.cancel();
        return true;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
