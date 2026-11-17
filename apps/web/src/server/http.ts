export class InvalidBody extends Error {}
export class BodyTooLarge extends InvalidBody {}
/** Reads a request body while enforcing a byte ceiling during streaming. */
export async function readBytes(
  request: Request,
  limit: number,
): Promise<Uint8Array> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > limit) throw new BodyTooLarge();
  const reader = request.body?.getReader();
  if (!reader) throw new InvalidBody();
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new BodyTooLarge();
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof BodyTooLarge) throw error;
    throw new InvalidBody();
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
export async function readJson(
  request: Request,
  limit = 16384,
): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new InvalidBody();
  const bytes = await readBytes(request, limit).catch(() => {
    throw new InvalidBody();
  });
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new InvalidBody();
  }
}
