export const MAX_HTTP_BODY_SIZE = 10 * 1024 * 1024;

export async function requestBodyExceedsLimit(
  request: Request,
  maxBodySize: number = MAX_HTTP_BODY_SIZE,
): Promise<boolean> {
  const contentLength = request.headers.get("content-length");
  if (!contentLength) {
    return false;
  }

  const parsedLength = Number.parseInt(contentLength, 10);
  return Number.isFinite(parsedLength) && parsedLength > maxBodySize;
}
