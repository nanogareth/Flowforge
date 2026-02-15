import { getTerminalHtml } from "../lib/terminal-html";

describe("getTerminalHtml", () => {
  const wsUrl =
    "ws://192.168.1.100:7433/terminal?session=abc-123&token=jwt-token";
  const html = getTerminalHtml(wsUrl);

  it("should return valid HTML document", () => {
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html>");
    expect(html).toContain("</html>");
  });

  it("should include xterm.js library", () => {
    expect(html).toContain("@xterm/xterm");
    expect(html).toContain("xterm.min.js");
    expect(html).toContain("xterm.min.css");
  });

  it("should include xterm fit addon", () => {
    expect(html).toContain("@xterm/addon-fit");
    expect(html).toContain("addon-fit.min.js");
  });

  it("should embed the WebSocket URL", () => {
    expect(html).toContain(wsUrl);
    expect(html).toContain(`new WebSocket('${wsUrl}')`);
  });

  it("should configure terminal with dark theme", () => {
    expect(html).toContain("background: '#0a0a0a'");
    expect(html).toContain("cursor: '#238636'");
  });

  it("should set up terminal container", () => {
    expect(html).toContain('id="terminal"');
    expect(html).toContain("term.open(");
  });

  it("should handle WebSocket message types", () => {
    expect(html).toContain("case 'output':");
    expect(html).toContain("case 'scrollback':");
    expect(html).toContain("case 'exit':");
    expect(html).toContain("case 'error':");
  });

  it("should send resize events", () => {
    expect(html).toContain("type: 'resize'");
    expect(html).toContain("ResizeObserver");
  });

  it("should implement ping keepalive", () => {
    expect(html).toContain("type: 'ping'");
    expect(html).toContain("30000");
  });

  it("should include Android double-Enter debounce", () => {
    expect(html).toContain("lastEnterTime");
    expect(html).toContain("50"); // 50ms debounce
  });

  it("should disable user scaling", () => {
    expect(html).toContain("user-scalable=no");
  });
});
