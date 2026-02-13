import { Button } from '@babylonjs/gui/2D/controls/button';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { ScrollViewer } from '@babylonjs/gui/2D/controls/scrollViewers/scrollViewer';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { UI_THEME } from './UITheme';

export const UI_SPACING = {
  xs: UI_THEME.spacing.xs,
  sm: UI_THEME.spacing.sm,
  md: UI_THEME.spacing.md,
  lg: UI_THEME.spacing.lg,
} as const;

export function addVerticalSpacer(parent: StackPanel, heightPx: number, name: string = 'spacer'): Rectangle {
  const spacer = new Rectangle(name);
  spacer.height = `${Math.max(0, heightPx)}px`;
  spacer.width = '1px';
  spacer.thickness = 0;
  spacer.background = 'transparent';
  parent.addControl(spacer);
  return spacer;
}

export function createHorizontalRow(
  parent: StackPanel,
  options: {
    name: string;
    widthPx: number;
    heightPx: number;
    paddingTopPx?: number;
  }
): StackPanel {
  const row = new StackPanel(options.name);
  row.isVertical = false;
  row.width = `${options.widthPx}px`;
  row.height = `${options.heightPx}px`;
  if (options.paddingTopPx) {
    row.paddingTop = `${options.paddingTopPx}px`;
  }
  parent.addControl(row);
  return row;
}

export interface UniformButtonSpec {
  id: string;
  label: string;
  onClick: () => void;
  background?: string;
  color?: string;
  hoverBackground?: string;
  fontSize?: number;
}

export function addUniformButtons(
  row: StackPanel,
  options: {
    rowWidthPx: number;
    rowHeightPx: number;
    gapPx: number;
    cornerRadius?: number;
    specs: UniformButtonSpec[];
  }
): Button[] {
  const { rowWidthPx, rowHeightPx, gapPx, cornerRadius = UI_THEME.radii.button, specs } = options;
  if (specs.length === 0) return [];

  const buttonWidth = Math.floor((rowWidthPx - gapPx * (specs.length - 1)) / specs.length);
  const created: Button[] = [];

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const normalBg = spec.background ?? '#2a5a3a';
    const hoverBg = spec.hoverBackground ?? normalBg;

    const btn = Button.CreateSimpleButton(spec.id, spec.label);
    btn.width = `${buttonWidth}px`;
    btn.height = `${rowHeightPx}px`;
    btn.cornerRadius = cornerRadius;
    btn.background = normalBg;
    btn.color = spec.color ?? UI_THEME.colors.text.primary;
    btn.thickness = 0;
    btn.fontSize = spec.fontSize ?? UI_THEME.typography.bodySize;
    btn.fontFamily = UI_THEME.typography.fontFamily;
    btn.onPointerUpObservable.add(spec.onClick);
    btn.onPointerEnterObservable.add(() => {
      btn.background = hoverBg;
    });
    btn.onPointerOutObservable.add(() => {
      btn.background = normalBg;
    });
    row.addControl(btn);
    created.push(btn);

    if (i < specs.length - 1 && gapPx > 0) {
      const gap = new Rectangle(`${spec.id}_gap`);
      gap.width = `${gapPx}px`;
      gap.height = '1px';
      gap.thickness = 0;
      gap.background = 'transparent';
      row.addControl(gap);
    }
  }

  return created;
}

export interface DialogScrollOptions {
  barSize?: number;
  barColor?: string;
  barBackground?: string;
  wheelPrecision?: number;
}

export function configureDialogScrollViewer(
  scrollViewer: ScrollViewer,
  options: DialogScrollOptions = {}
): ScrollViewer {
  scrollViewer.thickness = 0;
  scrollViewer.barSize = options.barSize ?? 8;
  scrollViewer.barColor = options.barColor ?? '#4a8a5a';
  if (options.barBackground !== undefined) {
    scrollViewer.barBackground = options.barBackground;
  }
  // Smaller precision improves trackpad control for compact dialog lists.
  scrollViewer.wheelPrecision = options.wheelPrecision ?? 0.015;
  return scrollViewer;
}
