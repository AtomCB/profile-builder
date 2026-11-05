import { describe, expect, it } from "vitest";
import { encodeSse } from "./encode";
import { createSseParser, type RawSseEvent } from "./parse";

function collect(chunks: string[]) {
  const events: RawSseEvent[] = [];
  const parser = createSseParser((e) => events.push(e));
  for (const c of chunks) parser.push(c);
  parser.flush();
  return events;
}

describe("SSE parser", () => {
  it("parses multiple events in one chunk", () => {
    const text = encodeSse("token", { text: "Hi" }) + encodeSse("token", { text: " there" });
    expect(collect([text])).toEqual([
      { event: "token", data: '{"text":"Hi"}' },
      { event: "token", data: '{"text":" there"}' },
    ]);
  });

  it("handles events split across chunks at any point", () => {
    const text = encodeSse("tool", { name: "getDestinationInfo", arg: "Kyoto", found: true }) + encodeSse("done", { message: null } as never);
    for (let i = 1; i < text.length; i++) {
      const events = collect([text.slice(0, i), text.slice(i)]);
      expect(events.map((e) => e.event)).toEqual(["tool", "done"]);
    }
  });

  it("handles CRLF, comments and multi-line data", () => {
    expect(collect([": ping\r\n\r\nevent: x\r\ndata: a\r\ndata: b\r\n\r\n"])).toEqual([{ event: "x", data: "a\nb" }]);
  });

  it("flushes a trailing event without a blank line", () => {
    expect(collect(["event: done\ndata: {}"])).toEqual([{ event: "done", data: "{}" }]);
  });
});
