export class RequestBodyError extends Error {
  readonly status: 400 | 413;

  constructor(
    message: string,
    status: 400 | 413,
  ) {
    super(message);
    this.name = "RequestBodyError";
    this.status = status;
  }
}

// Count streamed bytes as well as checking the optional Content-Length header.
async function readBody(request: Request, maximumBytes: number): Promise<ArrayBuffer> {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes <= 0) {
    throw new RangeError("The request body limit must be a positive safe integer.");
  }

  const tooLarge = () => new RequestBodyError("Request body is too large.", 413);
  if (Number(request.headers.get("content-length")) > maximumBytes) {
    await request.body?.cancel().catch(() => undefined);
    throw tooLarge();
  }
  if (!request.body) return new ArrayBuffer(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw tooLarge();
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError("Request body could not be read.", 400);
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
}

export async function readRequestText(request: Request, maximumBytes: number) {
  return new TextDecoder().decode(await readBody(request, maximumBytes));
}

export async function readRequestJson(
  request: Request,
  maximumBytes: number,
): Promise<unknown> {
  const text = await readRequestText(request, maximumBytes);
  try {
    return JSON.parse(text);
  } catch {
    throw new RequestBodyError("Request body must be valid JSON.", 400);
  }
}

export async function readRequestFormData(request: Request, maximumBytes: number) {
  const body = await readBody(request, maximumBytes);
  try {
    return await new Response(body, { headers: request.headers }).formData();
  } catch {
    throw new RequestBodyError("Request body must be valid form data.", 400);
  }
}
