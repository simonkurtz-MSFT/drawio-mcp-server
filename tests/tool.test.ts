import { describe, expect, it, vi, type Mocked, type Mock } from "vitest";
import { build_channel, default_tool, Handler } from "../src/tool.js";
import { Bus, BusListener, Context, IdGenerator, Logger } from "../src/types.js";
import {
  CallToolResult,
  ServerNotification,
  ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { create_logger } from "../src/standard_console_logger.js";

describe("build_channel", () => {
  let mockBus: Mocked<Bus>;
  let mockIdGenerator: { generate: Mock<() => string> };
  let context: Context;
  const mockHandler = vi.fn<Handler>();
  const log = create_logger();

  beforeEach(() => {
    mockBus = {
      send_to_extension: vi.fn(),
      on_reply_from_extension: vi.fn(),
    } as unknown as Mocked<Bus>;

    mockIdGenerator = {
      generate: vi.fn<() => string>().mockReturnValue("123"),
    };

    context = {
      bus: mockBus,
      id_generator: mockIdGenerator,
      log,
    };

    mockHandler.mockReset();
  });

  it("should create a function that sends a message via bus", async () => {
    const eventName = "test-event";
    const toolFn = build_channel(context, eventName, mockHandler);

    const args = { key: "value" };
    const extra = {} as RequestHandlerExtra<ServerRequest, ServerNotification>;

    const promise = toolFn(args, extra);

    expect(mockBus.send_to_extension).toHaveBeenCalledWith({
      __event: eventName,
      __request_id: "123",
      key: "value",
    });
  });

  it("should wait for reply and call handler with response", async () => {
    const eventName = "test-event";
    const toolFn = build_channel(context, eventName, mockHandler);

    const mockResponse: CallToolResult = {
      content: [{ type: "text", text: "response" }],
    };
    mockHandler.mockReturnValue(mockResponse);

    const promise = toolFn(
      {},
      {} as RequestHandlerExtra<ServerRequest, ServerNotification>,
    );

    // Simulate reply callback
    const replyCallback = mockBus.on_reply_from_extension.mock.calls[0][1];
    replyCallback({ data: "test" });

    const result = await promise;

    expect(mockBus.on_reply_from_extension).toHaveBeenCalledWith(
      "test-event.123",
      expect.any(Function),
    );
    expect(mockHandler).toHaveBeenCalledWith({ data: "test" });
    expect(result).toEqual(mockResponse);
  });

  it("should use correct reply channel name format", async () => {
    mockIdGenerator.generate.mockReturnValue("456");
    const eventName = "another-event";
    const toolFn = build_channel(context, eventName, mockHandler);

    toolFn({}, {} as RequestHandlerExtra<ServerRequest, ServerNotification>);

    expect(mockBus.on_reply_from_extension).toHaveBeenCalledWith(
      "another-event.456",
      expect.any(Function),
    );
  });
});

describe("default_tool", () => {
  let mockBus: Mocked<Bus>;
  let mockIdGenerator: { generate: Mock<() => string> };
  const log = create_logger();
  let context: Context;

  beforeEach(() => {
    mockBus = {
      send_to_extension: vi.fn(),
      on_reply_from_extension: vi.fn((_, callback: BusListener<unknown>) => {
        callback({ test: "data" });
      }),
    } as unknown as Mocked<Bus>;

    mockIdGenerator = {
      generate: vi.fn<() => string>().mockReturnValue("789"),
    };

    context = {
      bus: mockBus,
      id_generator: mockIdGenerator,
      log,
    };
  });

  it("should create a tool that returns JSON stringified response", async () => {
    const toolName = "default-tool";
    const tool = default_tool(toolName, context);

    const result = await tool(
      {},
      {} as RequestHandlerExtra<ServerRequest, ServerNotification>,
    );

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: JSON.stringify({ test: "data" }),
        },
      ],
    });
  });

  it("should use the provided tool name in the channel", async () => {
    const toolName = "custom-tool";
    const tool = default_tool(toolName, context);

    await tool(
      {},
      {} as RequestHandlerExtra<ServerRequest, ServerNotification>,
    );

    expect(mockBus.send_to_extension).toHaveBeenCalledWith({
      __event: toolName,
      __request_id: "789",
    });
  });
});
