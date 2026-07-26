// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { SettingsChoiceGroup, SettingsSwitch } from "./SettingsControls";

describe("SettingsSwitch", () => {
  it("exposes its name and checked state with native switch semantics", () => {
    const onChange = vi.fn();
    render(<SettingsSwitch checked label="Show FPS" onChange={onChange} />);
    const control = screen.getByRole("switch", { name: "Show FPS" });
    expect(control).toBeChecked();
    fireEvent.click(control);
    expect(onChange).toHaveBeenCalledWith(false);
  });
});

describe("SettingsChoiceGroup", () => {
  it("exposes a named radio group and selected option", () => {
    const onChange = vi.fn();
    render(<SettingsChoiceGroup label="Theme" value="dark" onChange={onChange} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />);
    expect(screen.getByRole("group", { name: "Theme" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "Light" }));
    expect(onChange).toHaveBeenCalledWith("light");
  });
});
