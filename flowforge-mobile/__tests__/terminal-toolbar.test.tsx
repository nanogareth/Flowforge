import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import TerminalToolbar from "../components/TerminalToolbar";

describe("TerminalToolbar", () => {
  it("should render all key buttons", () => {
    const onSendKey = jest.fn();
    const { getByText } = render(<TerminalToolbar onSendKey={onSendKey} />);

    expect(getByText("ESC")).toBeTruthy();
    expect(getByText("Tab")).toBeTruthy();
    expect(getByText("Ctrl")).toBeTruthy();
    expect(getByText("/")).toBeTruthy();
    expect(getByText("|")).toBeTruthy();
    expect(getByText("~")).toBeTruthy();
  });

  it("should send ESC key sequence", () => {
    const onSendKey = jest.fn();
    const { getByText } = render(<TerminalToolbar onSendKey={onSendKey} />);

    fireEvent.press(getByText("ESC"));
    expect(onSendKey).toHaveBeenCalledWith("\x1b");
  });

  it("should send Tab key sequence", () => {
    const onSendKey = jest.fn();
    const { getByText } = render(<TerminalToolbar onSendKey={onSendKey} />);

    fireEvent.press(getByText("Tab"));
    expect(onSendKey).toHaveBeenCalledWith("\t");
  });

  it("should send character keys directly", () => {
    const onSendKey = jest.fn();
    const { getByText } = render(<TerminalToolbar onSendKey={onSendKey} />);

    fireEvent.press(getByText("/"));
    expect(onSendKey).toHaveBeenCalledWith("/");

    fireEvent.press(getByText("|"));
    expect(onSendKey).toHaveBeenCalledWith("|");

    fireEvent.press(getByText("~"));
    expect(onSendKey).toHaveBeenCalledWith("~");
  });

  it("should toggle Ctrl mode without sending key", () => {
    const onSendKey = jest.fn();
    const { getByText } = render(<TerminalToolbar onSendKey={onSendKey} />);

    fireEvent.press(getByText("Ctrl"));
    expect(onSendKey).not.toHaveBeenCalled();
  });

  it("should show Ctrl combos when Ctrl is active", () => {
    const onSendKey = jest.fn();
    const { getByText } = render(<TerminalToolbar onSendKey={onSendKey} />);

    // Ctrl combos should not be visible initially
    expect(() => getByText("Ctrl+C")).toThrow();

    // Toggle Ctrl on
    fireEvent.press(getByText("Ctrl"));

    // Now combos should be visible
    expect(getByText("Ctrl+C")).toBeTruthy();
    expect(getByText("Ctrl+D")).toBeTruthy();
    expect(getByText("Ctrl+Z")).toBeTruthy();
    expect(getByText("Ctrl+L")).toBeTruthy();
    expect(getByText("Ctrl+A")).toBeTruthy();
    expect(getByText("Ctrl+E")).toBeTruthy();
  });

  it("should send Ctrl+C sequence and deactivate Ctrl", () => {
    const onSendKey = jest.fn();
    const { getByText, queryByText } = render(
      <TerminalToolbar onSendKey={onSendKey} />,
    );

    // Activate Ctrl
    fireEvent.press(getByText("Ctrl"));

    // Press Ctrl+C
    fireEvent.press(getByText("Ctrl+C"));

    expect(onSendKey).toHaveBeenCalledWith("\x03");

    // Ctrl combos should be hidden again
    expect(queryByText("Ctrl+C")).toBeNull();
  });

  it("should send correct sequences for all Ctrl combos", () => {
    const onSendKey = jest.fn();
    const { getByText } = render(<TerminalToolbar onSendKey={onSendKey} />);

    const combos = [
      { label: "Ctrl+C", expected: "\x03" },
      { label: "Ctrl+D", expected: "\x04" },
      { label: "Ctrl+Z", expected: "\x1a" },
      { label: "Ctrl+L", expected: "\x0c" },
      { label: "Ctrl+A", expected: "\x01" },
      { label: "Ctrl+E", expected: "\x05" },
    ];

    for (const combo of combos) {
      // Activate Ctrl
      fireEvent.press(getByText("Ctrl"));
      // Press combo
      fireEvent.press(getByText(combo.label));
      expect(onSendKey).toHaveBeenCalledWith(combo.expected);
    }
  });
});
