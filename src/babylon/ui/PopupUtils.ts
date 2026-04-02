import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Button } from '@babylonjs/gui/2D/controls/button';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { UIParent } from './UIParent';
import { UI_THEME } from './UITheme';

export interface PopupColors {
  border: string;
  background: string;
  title: string;
}

export const POPUP_COLORS = {
  green: {
    border: UI_THEME.colors.border.strong,
    background: UI_THEME.colors.surfaces.panel,
    title: UI_THEME.colors.text.accent,
  },
  blue: {
    border: UI_THEME.colors.border.info,
    background: UI_THEME.colors.surfaces.panelAlt,
    title: UI_THEME.colors.text.info,
  },
  purple: {
    border: '#8f7e64',
    background: 'rgba(40, 33, 24, 0.97)',
    title: UI_THEME.colors.text.accent,
  },
} as const;

interface PopupConfig {
  name: string;
  width: number;
  height: number;
  colors: PopupColors;
  padding?: number;
}

interface OverlayPopupResult {
  overlay: Rectangle;
  panel: Rectangle;
  stack: StackPanel;
}

interface DirectPopupResult {
  panel: Rectangle;
  stack: StackPanel;
}

interface DockedPanelConfig {
  name: string;
  width: number;
  height: number;
  colors: PopupColors;
  horizontalAlignment: number;
  verticalAlignment: number;
  left?: number;
  top?: number;
  padding?: number;
}

export function createOverlayPopup(
  texture: AdvancedDynamicTexture,
  config: PopupConfig
): OverlayPopupResult {
  const padding = config.padding ?? 15;
  const stackWidth = config.width - padding * 2;

  const overlay = new Rectangle(`${config.name}Overlay`);
  overlay.width = '100%';
  overlay.height = '100%';
  overlay.background = UI_THEME.colors.surfaces.overlay;
  overlay.thickness = 0;
  overlay.isVisible = false;
  overlay.isPointerBlocker = true;
  texture.addControl(overlay);

  const panel = new Rectangle(`${config.name}Panel`);
  panel.width = `${config.width}px`;
  panel.height = `${config.height}px`;
  panel.cornerRadius = UI_THEME.radii.panel;
  panel.color = config.colors.border;
  panel.thickness = 2;
  panel.background = config.colors.background;
  panel.shadowColor = UI_THEME.colors.effects.overlayShadow;
  panel.shadowBlur = 18;
  panel.shadowOffsetY = 8;
  overlay.addControl(panel);

  const stack = new StackPanel(`${config.name}Stack`);
  stack.width = `${stackWidth}px`;
  stack.paddingTop = `${padding}px`;
  panel.addControl(stack);

  return { overlay, panel, stack };
}

export function createDirectPopup(
  texture: AdvancedDynamicTexture,
  config: PopupConfig
): DirectPopupResult {
  const padding = config.padding ?? 12;
  const stackWidth = config.width - padding * 2;

  const panel = new Rectangle(`${config.name}Panel`);
  panel.width = `${config.width}px`;
  panel.height = `${config.height}px`;
  panel.cornerRadius = UI_THEME.radii.panel;
  panel.color = config.colors.border;
  panel.thickness = 2;
  panel.background = config.colors.background;
  panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  panel.isVisible = false;
  panel.isPointerBlocker = true;
  panel.shadowColor = UI_THEME.colors.effects.overlayShadow;
  panel.shadowBlur = 18;
  panel.shadowOffsetY = 8;
  texture.addControl(panel);

  const stack = new StackPanel(`${config.name}Stack`);
  stack.width = `${stackWidth}px`;
  stack.paddingTop = `${padding}px`;
  stack.paddingBottom = `${padding}px`;
  panel.addControl(stack);

  return { panel, stack };
}

export function createDockedPanel(
  parent: UIParent,
  config: DockedPanelConfig
): DirectPopupResult {
  const padding = config.padding ?? 12;
  const stackWidth = config.width - padding * 2;

  const panel = new Rectangle(`${config.name}Panel`);
  panel.width = `${config.width}px`;
  panel.height = `${config.height}px`;
  panel.cornerRadius = UI_THEME.radii.panel;
  panel.color = config.colors.border;
  panel.thickness = 2;
  panel.background = config.colors.background;
  panel.horizontalAlignment = config.horizontalAlignment;
  panel.verticalAlignment = config.verticalAlignment;
  panel.left = `${config.left ?? 0}px`;
  panel.top = `${config.top ?? 0}px`;
  panel.isVisible = false;
  panel.isPointerBlocker = true;
  panel.shadowColor = UI_THEME.colors.effects.shadow;
  panel.shadowBlur = 14;
  panel.shadowOffsetY = 6;
  parent.addControl(panel);

  const stack = new StackPanel(`${config.name}Stack`);
  stack.width = `${stackWidth}px`;
  stack.paddingTop = `${padding}px`;
  stack.paddingBottom = `${padding}px`;
  panel.addControl(stack);

  return { panel, stack };
}

const ACTION_BUTTON_COLORS = UI_THEME.colors.action;

interface HeaderConfig {
  title: string;
  titleColor?: string;
  width: number;
  onClose: () => void;
  closeLabel?: string;
  onCloseButtonCreated?: (button: Button) => void;
}

interface ActionButtonConfig {
  id: string;
  label: string;
  tone?: keyof typeof ACTION_BUTTON_COLORS;
  width: number;
  height?: number;
  fontSize?: number;
  cornerRadius?: number;
  thickness?: number;
  isEnabled?: boolean;
  onClick: () => void;
}

interface SelectableButtonStyle {
  selectedBackground: string;
  selectedColor: string;
  unselectedBackground: string;
  unselectedColor: string;
  hoverBackground?: string;
  selectedThickness?: number;
  unselectedThickness?: number;
}

interface SelectableButtonConfig {
  id: string;
  label: string;
  width: number;
  height: number;
  fontSize?: number;
  cornerRadius?: number;
  style: SelectableButtonStyle;
  selected?: boolean;
  onClick: () => void;
}

interface ListRowCardConfig {
  name: string;
  width: number;
  height: number;
  background: string;
  borderColor: string;
  thickness?: number;
  cornerRadius?: number;
  paddingTop?: number;
  paddingBottom?: number;
}

export function createActionButton(config: ActionButtonConfig): Button {
  const palette = ACTION_BUTTON_COLORS[config.tone ?? 'neutral'];
  const button = Button.CreateSimpleButton(config.id, config.label);
  button.width = `${config.width}px`;
  button.height = `${config.height ?? UI_THEME.sizing.actionButtonHeight}px`;
  button.cornerRadius = config.cornerRadius ?? UI_THEME.radii.button;
  button.background = palette.normal;
  button.color = palette.text;
  button.thickness = config.thickness ?? 2;
  button.fontSize = config.fontSize ?? UI_THEME.typography.bodySize;
  button.fontFamily = UI_THEME.typography.fontFamily;
  button.isEnabled = config.isEnabled ?? true;
  button.shadowColor = UI_THEME.colors.effects.shadow;
  button.shadowBlur = 8;
  button.shadowOffsetY = 3;
  button.onPointerClickObservable.add(config.onClick);
  button.onPointerEnterObservable.add(() => {
    if (button.isEnabled) {
      button.background = palette.hover;
    }
  });
  button.onPointerOutObservable.add(() => {
    button.background = button.isEnabled ? palette.normal : UI_THEME.colors.surfaces.buttonDisabled;
  });
  if (!button.isEnabled) {
    button.alpha = 0.55;
    button.background = UI_THEME.colors.surfaces.buttonDisabled;
  }
  return button;
}

function applySelectableState(button: Button, selected: boolean, style: SelectableButtonStyle): void {
  button.background = selected ? style.selectedBackground : style.unselectedBackground;
  button.color = selected ? style.selectedColor : style.unselectedColor;
  button.thickness = selected
    ? (style.selectedThickness ?? 2)
    : (style.unselectedThickness ?? 1);
}

export function createSelectableButton(config: SelectableButtonConfig): Button {
  const button = Button.CreateSimpleButton(config.id, config.label);
  button.width = `${config.width}px`;
  button.height = `${config.height}px`;
  button.cornerRadius = config.cornerRadius ?? UI_THEME.radii.chip;
  button.fontSize = config.fontSize ?? UI_THEME.typography.bodySize;
  button.metadata = {
    selected: config.selected ?? false,
    selectableStyle: config.style,
  };
  applySelectableState(button, config.selected ?? false, config.style);
  button.onPointerClickObservable.add(config.onClick);
  button.onPointerEnterObservable.add(() => {
    const metadata = button.metadata as
      | { selected: boolean; selectableStyle: SelectableButtonStyle }
      | undefined;
    if (!metadata || metadata.selected) return;
    button.background = metadata.selectableStyle.hoverBackground ?? metadata.selectableStyle.unselectedBackground;
  });
  button.onPointerOutObservable.add(() => {
    const metadata = button.metadata as
      | { selected: boolean; selectableStyle: SelectableButtonStyle }
      | undefined;
    if (!metadata) return;
    applySelectableState(button, metadata.selected, metadata.selectableStyle);
  });
  return button;
}

export function setSelectableButtonState(button: Button, selected: boolean): void {
  const metadata = button.metadata as
    | { selected: boolean; selectableStyle: SelectableButtonStyle }
    | undefined;
  if (!metadata) return;
  metadata.selected = selected;
  applySelectableState(button, selected, metadata.selectableStyle);
}

export function createListRowCard(config: ListRowCardConfig): Rectangle {
  const row = new Rectangle(config.name);
  row.width = `${config.width}px`;
  row.height = `${config.height}px`;
  row.cornerRadius = config.cornerRadius ?? 4;
  row.background = config.background;
  row.thickness = config.thickness ?? 1;
  row.color = config.borderColor;
  row.paddingTop = `${config.paddingTop ?? 4}px`;
  row.paddingBottom = `${config.paddingBottom ?? 4}px`;
  return row;
}

export function createPopupHeader(parent: StackPanel, config: HeaderConfig): Rectangle {
  const container = new Rectangle('headerContainer');
  container.height = `${UI_THEME.sizing.headerHeight}px`;
  container.width = `${config.width}px`;
  container.cornerRadius = UI_THEME.radii.section;
  container.thickness = 0;
  container.background = UI_THEME.colors.surfaces.stripe;
  parent.addControl(container);

  const divider = new Rectangle('headerDivider');
  divider.width = `${config.width}px`;
  divider.height = '1px';
  divider.background = UI_THEME.colors.border.muted;
  divider.thickness = 0;
  divider.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  container.addControl(divider);

  const title = new TextBlock('title');
  title.text = config.title;
  title.color = config.titleColor ?? UI_THEME.colors.text.accent;
  title.fontSize = UI_THEME.typography.titleSize;
  title.fontWeight = 'bold';
  title.fontFamily = UI_THEME.typography.fontFamily;
  title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  title.left = '12px';
  container.addControl(title);

  const closeLabel = config.closeLabel ?? '✕';
  const isBackButton = closeLabel === '← Back';
  const colors = isBackButton ? UI_THEME.colors.headerButton.back : UI_THEME.colors.headerButton.close;

  const closeBtn = Button.CreateSimpleButton('closeBtn', closeLabel);
  closeBtn.width = isBackButton ? '78px' : '30px';
  closeBtn.height = `${UI_THEME.sizing.closeButtonSize}px`;
  closeBtn.cornerRadius = UI_THEME.radii.chip;
  closeBtn.background = colors.normal;
  closeBtn.color = UI_THEME.colors.text.primary;
  closeBtn.thickness = 0;
  closeBtn.fontSize = isBackButton ? UI_THEME.typography.bodySize : 14;
  closeBtn.fontFamily = UI_THEME.typography.fontFamily;
  closeBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  closeBtn.left = '-4px';
  closeBtn.shadowColor = UI_THEME.colors.effects.shadow;
  closeBtn.shadowBlur = 8;
  closeBtn.shadowOffsetY = 2;
  closeBtn.onPointerClickObservable.add(config.onClose);
  closeBtn.onPointerEnterObservable.add(() => {
    closeBtn.background = colors.hover;
  });
  closeBtn.onPointerOutObservable.add(() => {
    closeBtn.background = colors.normal;
  });
  container.addControl(closeBtn);
  config.onCloseButtonCreated?.(closeBtn);

  return container;
}

export function createSection(
  parent: StackPanel,
  width: number,
  height: number,
  marginTop: number = 8
): Rectangle {
  const container = new Rectangle('section');
  container.height = `${height}px`;
  container.width = `${width}px`;
  container.cornerRadius = UI_THEME.radii.section;
  container.background = UI_THEME.colors.surfaces.section;
  container.thickness = 1;
  container.color = UI_THEME.colors.border.default;
  container.paddingTop = `${marginTop}px`;
  parent.addControl(container);
  return container;
}

export type SectionTheme = 'green' | 'blue' | 'purple' | 'neutral';

const SECTION_THEMES: Record<SectionTheme, { background: string; border: string }> = {
  green: { background: UI_THEME.colors.surfaces.section, border: UI_THEME.colors.border.default },
  blue: { background: 'rgba(27, 47, 62, 0.84)', border: UI_THEME.colors.border.info },
  purple: { background: 'rgba(55, 44, 31, 0.82)', border: '#8f7e64' },
  neutral: { background: 'transparent', border: 'transparent' },
};

interface PanelSectionConfig {
  name: string;
  width: number;
  height: number;
  theme?: SectionTheme;
  marginTop?: number;
  paddingTop?: number;
  paddingBottom?: number;
  cornerRadius?: number;
  thickness?: number;
  background?: string;
  borderColor?: string;
}

export function createSectionDivider(parent: UIParent, label: string, width: number): StackPanel {
  const row = new StackPanel();
  row.isVertical = false;
  row.height = '24px';
  row.width = `${width}px`;
  row.paddingTop = '10px';

  const lineW = Math.floor((width - 140) / 2);

  const line1 = new Rectangle();
  line1.height = '1px';
  line1.width = `${lineW}px`;
  line1.background = UI_THEME.colors.border.muted;
  line1.thickness = 0;
  line1.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  row.addControl(line1);

  const text = new TextBlock();
  text.text = label;
  text.color = UI_THEME.colors.text.secondary;
  text.fontSize = 10;
  text.fontFamily = UI_THEME.typography.fontFamily;
  text.width = '140px';
  row.addControl(text);

  const line2 = new Rectangle();
  line2.height = '1px';
  line2.width = `${lineW}px`;
  line2.background = UI_THEME.colors.border.muted;
  line2.thickness = 0;
  line2.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  row.addControl(line2);

  parent.addControl(row);
  return row;
}

export function createPanelSection(parent: UIParent, config: PanelSectionConfig): Rectangle {
  const theme = SECTION_THEMES[config.theme ?? 'green'];
  const container = new Rectangle(config.name);
  container.height = `${config.height}px`;
  container.width = `${config.width}px`;
  container.cornerRadius = config.cornerRadius ?? UI_THEME.radii.section;
  container.background = config.background ?? theme.background;
  container.thickness = config.thickness ?? 1;
  container.color = config.borderColor ?? theme.border;
  container.shadowColor = UI_THEME.colors.effects.shadow;
  container.shadowBlur = 6;
  container.shadowOffsetY = 2;
  container.paddingTop = `${config.paddingTop ?? 6}px`;
  container.paddingBottom = `${config.paddingBottom ?? 4}px`;
  if ((config.marginTop ?? 0) > 0) {
    container.paddingTop = `${(config.paddingTop ?? 6) + (config.marginTop ?? 0)}px`;
  }
  parent.addControl(container);
  return container;
}
