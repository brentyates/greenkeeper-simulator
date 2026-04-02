import { describe, expect, it, vi } from "vitest";
import { Control } from "@babylonjs/gui/2D/controls/control";

import { renderDialog } from "./DialogRenderer";
import { POPUP_COLORS } from "./PopupUtils";

function createMockTexture(width: number, height: number) {
  return {
    addControl: vi.fn(),
    getSize: vi.fn().mockReturnValue({ width, height }),
  } as any;
}

describe("DialogRenderer viewport fitting", () => {
  it("clamps oversized direct dialogs to the viewport", () => {
    const texture = createMockTexture(320, 240);

    const rendered = renderDialog(texture, {
      name: "oversizedDirect",
      shell: "direct",
      width: 800,
      height: 600,
      padding: 12,
      colors: POPUP_COLORS.green,
      title: "Oversized",
      headerWidth: 760,
      onClose: () => {},
      nodes: [],
    });

    expect(rendered.panel.width).toBe("272px");
    expect(rendered.panel.height).toBe("192px");
  });

  it("clamps docked dialog offsets so the panel stays in bounds", () => {
    const texture = createMockTexture(420, 300);

    const rendered = renderDialog(texture, {
      name: "oversizedDocked",
      shell: "docked",
      width: 260,
      height: 180,
      padding: 12,
      colors: POPUP_COLORS.blue,
      dock: {
        horizontalAlignment: Control.HORIZONTAL_ALIGNMENT_RIGHT,
        verticalAlignment: Control.VERTICAL_ALIGNMENT_TOP,
        left: -500,
        top: 500,
      },
      title: "Docked",
      headerWidth: 220,
      onClose: () => {},
      nodes: [],
    });

    expect(rendered.panel.left).toBe("-136px");
    expect(rendered.panel.top).toBe("96px");
  });
});
