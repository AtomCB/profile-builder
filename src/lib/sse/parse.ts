export interface RawSseEvent {
  event: string;
  data: string;
}

/**
 * Incremental SSE parser. Feed it text chunks as they arrive (chunks may split
 * an event anywhere); it calls onEvent once per complete event.
 */
export function createSseParser(onEvent: (e: RawSseEvent) => void) {
  let buffer = "";

  function dispatch(block: string) {
    let event = "message";
    const data: string[] = [];
    for (const line of block.split("\n")) {
      if (!line || line.startsWith(":")) continue;
      const colon = line.indexOf(":");
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? "" : line.slice(colon + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      if (field === "event") event = value;
      else if (field === "data") data.push(value);
    }
    if (data.length) onEvent({ event, data: data.join("\n") });
  }

  return {
    push(chunk: string) {
      buffer += chunk.replace(/\r\n?/g, "\n");
      let end: number;
      while ((end = buffer.indexOf("\n\n")) !== -1) {
        dispatch(buffer.slice(0, end));
        buffer = buffer.slice(end + 2);
      }
    },
    /** Dispatches any trailing event without a final blank line. */
    flush() {
      if (buffer.trim()) dispatch(buffer);
      buffer = "";
    },
  };
}
