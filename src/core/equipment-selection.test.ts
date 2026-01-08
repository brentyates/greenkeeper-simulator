import { describe, it, expect } from "vitest";
import {
  EquipmentSelectionState,
  createInitialSelectionState,
  handleEquipmentButton,
  slotToEquipmentType,
  isEquipmentActive,
  isMowerActive,
} from "./equipment-selection";

describe("equipment-selection", () => {
  describe("createInitialSelectionState", () => {
    it("starts with nothing selected", () => {
      const state = createInitialSelectionState();
      expect(state.selected).toBeNull();
    });
  });

  describe("handleEquipmentButton", () => {
    it("selects equipment when nothing is selected", () => {
      const state: EquipmentSelectionState = { selected: null };
      const result = handleEquipmentButton(state, "mower");
      expect(result.selected).toBe("mower");
    });

    it("selects different equipment when pressing different button", () => {
      const state: EquipmentSelectionState = { selected: "mower" };
      const result = handleEquipmentButton(state, "sprinkler");
      expect(result.selected).toBe("sprinkler");
    });

    it("deselects when pressing same button", () => {
      const state: EquipmentSelectionState = { selected: "mower" };
      const result = handleEquipmentButton(state, "mower");
      expect(result.selected).toBeNull();
    });

    it("can reselect after deselecting", () => {
      let state: EquipmentSelectionState = { selected: "mower" };
      state = handleEquipmentButton(state, "mower");
      expect(state.selected).toBeNull();
      state = handleEquipmentButton(state, "mower");
      expect(state.selected).toBe("mower");
    });

    it("switching equipment does not require intermediate deselection", () => {
      let state: EquipmentSelectionState = { selected: "mower" };
      state = handleEquipmentButton(state, "sprinkler");
      expect(state.selected).toBe("sprinkler");
      state = handleEquipmentButton(state, "spreader");
      expect(state.selected).toBe("spreader");
    });
  });

  describe("slotToEquipmentType", () => {
    it("maps slot 1 to mower", () => {
      expect(slotToEquipmentType(1)).toBe("mower");
    });

    it("maps slot 2 to sprinkler", () => {
      expect(slotToEquipmentType(2)).toBe("sprinkler");
    });

    it("maps slot 3 to spreader", () => {
      expect(slotToEquipmentType(3)).toBe("spreader");
    });
  });

  describe("isEquipmentActive", () => {
    it("returns false when nothing selected", () => {
      expect(isEquipmentActive({ selected: null })).toBe(false);
    });

    it("returns true when mower selected", () => {
      expect(isEquipmentActive({ selected: "mower" })).toBe(true);
    });

    it("returns true when sprinkler selected", () => {
      expect(isEquipmentActive({ selected: "sprinkler" })).toBe(true);
    });

    it("returns true when spreader selected", () => {
      expect(isEquipmentActive({ selected: "spreader" })).toBe(true);
    });
  });

  describe("isMowerActive", () => {
    it("returns false when nothing selected", () => {
      expect(isMowerActive({ selected: null })).toBe(false);
    });

    it("returns true when mower selected", () => {
      expect(isMowerActive({ selected: "mower" })).toBe(true);
    });

    it("returns false when sprinkler selected", () => {
      expect(isMowerActive({ selected: "sprinkler" })).toBe(false);
    });

    it("returns false when spreader selected", () => {
      expect(isMowerActive({ selected: "spreader" })).toBe(false);
    });
  });

  describe("full user flow scenarios", () => {
    it("scenario: user mows grass then switches to watering", () => {
      let state = createInitialSelectionState();

      // Press 1 to select mower
      state = handleEquipmentButton(state, "mower");
      expect(state.selected).toBe("mower");
      expect(isMowerActive(state)).toBe(true);

      // Press 2 to switch to sprinkler
      state = handleEquipmentButton(state, "sprinkler");
      expect(state.selected).toBe("sprinkler");
      expect(isMowerActive(state)).toBe(false);

      // Press 2 again to deselect
      state = handleEquipmentButton(state, "sprinkler");
      expect(state.selected).toBeNull();
      expect(isEquipmentActive(state)).toBe(false);
    });

    it("scenario: user toggles mower on and off repeatedly", () => {
      let state = createInitialSelectionState();

      state = handleEquipmentButton(state, "mower");
      expect(state.selected).toBe("mower");

      state = handleEquipmentButton(state, "mower");
      expect(state.selected).toBeNull();

      state = handleEquipmentButton(state, "mower");
      expect(state.selected).toBe("mower");

      state = handleEquipmentButton(state, "mower");
      expect(state.selected).toBeNull();
    });

    it("scenario: user cycles through all equipment", () => {
      let state = createInitialSelectionState();

      state = handleEquipmentButton(state, "mower");
      expect(state.selected).toBe("mower");

      state = handleEquipmentButton(state, "sprinkler");
      expect(state.selected).toBe("sprinkler");

      state = handleEquipmentButton(state, "spreader");
      expect(state.selected).toBe("spreader");

      state = handleEquipmentButton(state, "mower");
      expect(state.selected).toBe("mower");
    });
  });
});
