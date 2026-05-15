import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { requestBodyExceedsLimit } from "../src/http_request_guards.ts";

describe("requestBodyExceedsLimit", () => {
  it("rejects declared bodies above the limit", async () => {
    const request = new Request("http://localhost/mcp", {
      method: "POST",
      headers: { "content-length": "11" },
      body: "short",
    });

    assertEquals(await requestBodyExceedsLimit(request, 10), true);
  });

  it("allows streamed bodies without a content length to preserve streaming", async () => {
    const request = new Request("http://localhost/mcp", {
      method: "POST",
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(6));
          controller.enqueue(new Uint8Array(6));
          controller.close();
        },
      }),
    });

    assertEquals(await requestBodyExceedsLimit(request, 10), false);
  });

  it("allows bodies that fit inside the limit", async () => {
    const request = new Request("http://localhost/mcp", {
      method: "POST",
      body: "1234567890",
    });

    assertEquals(await requestBodyExceedsLimit(request, 10), false);
  });
});
