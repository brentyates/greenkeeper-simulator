import type { Control } from "@babylonjs/gui/2D/controls/control";

export interface AutomationControlBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AutomationControlState {
  id: string;
  label: string;
  role: string;
  visible: boolean;
  enabled: boolean;
  bounds: AutomationControlBounds | null;
}

interface AutomationRegistration {
  id: string;
  label: string;
  role: string;
  getControl: () => Control | null;
  isVisible?: () => boolean;
  isEnabled?: () => boolean;
  onActivate?: () => void;
}

interface UIAutomationDebugAPI {
  getState: () => Record<string, unknown>;
  listControls: () => AutomationControlState[];
  click: (id: string) => boolean;
  focusCanvas: () => boolean;
  setDomMirrorsEnabled: (enabled: boolean) => void;
  setHighlightsEnabled: (enabled: boolean) => void;
}

declare global {
  interface Window {
    __uiDebug?: UIAutomationDebugAPI;
  }
}

class UIAutomationBridge {
  private registrations = new Map<string, AutomationRegistration>();
  private mirrorElements = new Map<string, HTMLButtonElement>();
  private contextProvider: (() => Record<string, unknown>) | null = null;
  private domMirrorsEnabled = false;
  private highlightsEnabled = false;
  private root: HTMLDivElement | null = null;
  private running = false;
  private lastState: AutomationControlState[] = [];

  register(registration: AutomationRegistration): void {
    this.registrations.set(registration.id, registration);
    this.install();
  }

  unregister(id: string): void {
    this.registrations.delete(id);
    const mirror = this.mirrorElements.get(id);
    mirror?.remove();
    this.mirrorElements.delete(id);
  }

  unregisterPrefix(prefix: string): void {
    for (const id of Array.from(this.registrations.keys())) {
      if (id.startsWith(prefix)) {
        this.unregister(id);
      }
    }
  }

  setContextProvider(provider: (() => Record<string, unknown>) | null): void {
    this.contextProvider = provider;
    this.install();
  }

  setDomMirrorsEnabled(enabled: boolean): void {
    this.domMirrorsEnabled = enabled;
    if (typeof window !== "undefined") {
      window.localStorage.setItem("ui-debug-mirrors", enabled ? "1" : "0");
    }
    this.ensureRoot();
    this.sync();
  }

  setHighlightsEnabled(enabled: boolean): void {
    this.highlightsEnabled = enabled;
    if (typeof window !== "undefined") {
      window.localStorage.setItem("ui-debug-highlights", enabled ? "1" : "0");
    }
    this.ensureRoot();
    this.sync();
  }

  listControls(): AutomationControlState[] {
    return this.lastState;
  }

  click(id: string): boolean {
    const registration = this.registrations.get(id);
    if (!registration) return false;
    const visible = registration.isVisible?.() ?? this.getControlVisibility(registration.getControl());
    const enabled = registration.isEnabled?.() ?? true;
    if (!visible || !enabled) return false;
    registration.onActivate?.();
    return true;
  }

  focusCanvas(): boolean {
    if (typeof document === "undefined") return false;
    const canvas = document.querySelector('canvas');
    if (!(canvas instanceof HTMLCanvasElement)) return false;
    canvas.focus();
    return document.activeElement === canvas;
  }

  getState(): Record<string, unknown> {
    return {
      ...this.contextProvider?.(),
      controls: this.lastState,
      canvasFocused: typeof document !== "undefined" && document.activeElement instanceof HTMLCanvasElement,
      domMirrorsEnabled: this.domMirrorsEnabled,
      highlightsEnabled: this.highlightsEnabled,
    };
  }

  private install(): void {
    if (typeof window === "undefined") return;
    if (!window.__uiDebug) {
      window.__uiDebug = {
        getState: () => this.getState(),
        listControls: () => this.listControls(),
        click: (id: string) => this.click(id),
        focusCanvas: () => this.focusCanvas(),
        setDomMirrorsEnabled: (enabled: boolean) => this.setDomMirrorsEnabled(enabled),
        setHighlightsEnabled: (enabled: boolean) => this.setHighlightsEnabled(enabled),
      };
    }

    if (!this.running) {
      this.domMirrorsEnabled = window.localStorage.getItem("ui-debug-mirrors") === "1";
      this.highlightsEnabled = window.localStorage.getItem("ui-debug-highlights") === "1";
      this.running = true;
      const tick = () => {
        this.sync();
        window.requestAnimationFrame(tick);
      };
      window.requestAnimationFrame(tick);
    }
  }

  private ensureRoot(): void {
    if (typeof document === "undefined") return;
    if (this.root) return;

    const root = document.createElement("div");
    root.id = "ui-debug-mirror-root";
    root.style.position = "fixed";
    root.style.inset = "0";
    root.style.zIndex = "2147483647";
    root.style.pointerEvents = "none";
    document.body.appendChild(root);
    this.root = root;
  }

  private sync(): void {
    if (typeof window === "undefined") return;
    this.ensureRoot();

    const nextState: AutomationControlState[] = [];
    for (const registration of this.registrations.values()) {
      const control = registration.getControl();
      const visible = registration.isVisible?.() ?? this.getControlVisibility(control);
      const enabled = registration.isEnabled?.() ?? true;
      const bounds = visible ? this.getControlBounds(control) : null;
      nextState.push({
        id: registration.id,
        label: registration.label,
        role: registration.role,
        visible,
        enabled,
        bounds,
      });
      this.syncMirror(registration, visible, enabled, bounds);
    }

    this.lastState = nextState.sort((a, b) => a.id.localeCompare(b.id));
  }

  private getControlVisibility(control: Control | null): boolean {
    if (!control) return false;
    return control.isVisible;
  }

  private getControlBounds(control: Control | null): AutomationControlBounds | null {
    if (!control) return null;
    const measure = (control as unknown as { _currentMeasure?: { left: number; top: number; width: number; height: number } })._currentMeasure;
    if (!measure) return null;
    return {
      x: measure.left,
      y: measure.top,
      width: measure.width,
      height: measure.height,
    };
  }

  private syncMirror(
    registration: AutomationRegistration,
    visible: boolean,
    enabled: boolean,
    bounds: AutomationControlBounds | null
  ): void {
    if (!this.root) return;

    let element = this.mirrorElements.get(registration.id);
    if (!element) {
      element = document.createElement("button");
      element.type = "button";
      element.dataset.uiDebugId = registration.id;
      element.setAttribute("aria-label", registration.label);
      element.title = registration.label;
      element.style.position = "fixed";
      element.style.margin = "0";
      element.style.borderRadius = "4px";
      element.style.background = "rgba(83, 181, 255, 0.08)";
      element.style.border = "1px dashed rgba(83, 181, 255, 0.55)";
      element.style.color = "transparent";
      element.style.pointerEvents = "auto";
      element.style.cursor = "pointer";
      element.style.fontSize = "0";
      element.style.padding = "0";
      element.style.opacity = "0.01";
      element.addEventListener("click", (event) => {
        event.preventDefault();
        registration.onActivate?.();
      });
      this.root.appendChild(element);
      this.mirrorElements.set(registration.id, element);
    }

    const shouldShow = this.domMirrorsEnabled && visible && bounds;
    element.style.display = shouldShow ? "block" : "none";
    if (!shouldShow || !bounds) return;

    element.disabled = !enabled;
    element.style.left = `${bounds.x}px`;
    element.style.top = `${bounds.y}px`;
    element.style.width = `${Math.max(1, bounds.width)}px`;
    element.style.height = `${Math.max(1, bounds.height)}px`;
    if (this.highlightsEnabled) {
      element.style.opacity = enabled ? "0.18" : "0.1";
      element.style.background = enabled ? "rgba(83, 181, 255, 0.16)" : "rgba(255, 140, 80, 0.10)";
      element.style.border = enabled
        ? "1px dashed rgba(83, 181, 255, 0.85)"
        : "1px dashed rgba(255, 140, 80, 0.7)";
    } else {
      element.style.opacity = "0.01";
      element.style.background = "rgba(83, 181, 255, 0.08)";
      element.style.border = "1px dashed rgba(83, 181, 255, 0.55)";
    }
  }
}

export const uiAutomationBridge = new UIAutomationBridge();
