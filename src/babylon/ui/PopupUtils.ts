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
    border: '#5a9a6a',
    background: 'rgba(20, 45, 35, 0.95)',
    title: '#ffcc00',
  },
  blue: {
    border: '#4a7a9a',
    background: 'rgba(20, 35, 55, 0.95)',
    title: '#ffcc00',
  },
  purple: {
    border: '#6a5a8a',
    background: 'rgba(35, 25, 55, 0.95)',
    title: '#ffcc00',
  },
} as const;

export interface PopupConfig {
  name: string;
  width: number;
  height: number;
  colors: PopupColors;
  padding?: number;
}

export interface OverlayPopupResult {
  overlay: Rectangle;
  panel: Rectangle;
  stack: StackPanel;
}

export interface DirectPopupResult {
  panel: Rectangle;
  stack: StackPanel;
}

export interface DockedPanelConfig {
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
  overlay.background = 'rgba(0, 0, 0, 0.6)';
  overlay.thickness = 0;
  overlay.isVisible = false;
  overlay.isPointerBlocker = true;
  texture.addControl(overlay);

  const panel = new Rectangle(`${config.name}Panel`);
  panel.width = `${config.width}px`;
  panel.height = `${config.height}px`;
  panel.cornerRadius = UI_THEME.radii.scale.r10;
  panel.color = config.colors.border;
  panel.thickness = 2;
  panel.background = config.colors.background;
  panel.shadowColor = 'rgba(0, 0, 0, 0.5)';
  panel.shadowBlur = 15;
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
  panel.cornerRadius = UI_THEME.radii.scale.r8;
  panel.color = config.colors.border;
  panel.thickness = 2;
  panel.background = config.colors.background;
  panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  panel.isVisible = false;
  panel.isPointerBlocker = true;
  panel.shadowColor = 'rgba(0, 0, 0, 0.5)';
  panel.shadowBlur = 10;
  panel.shadowOffsetX = 3;
  panel.shadowOffsetY = 3;
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
  panel.cornerRadius = UI_THEME.radii.scale.r8;
  panel.color = config.colors.border;
  panel.thickness = 2;
  panel.background = config.colors.background;
  panel.horizontalAlignment = config.horizontalAlignment;
  panel.verticalAlignment = config.verticalAlignment;
  panel.left = `${config.left ?? 0}px`;
  panel.top = `${config.top ?? 0}px`;
  panel.isVisible = false;
  panel.isPointerBlocker = true;
  panel.shadowColor = 'rgba(0, 0, 0, 0.5)';
  panel.shadowBlur = 10;
  panel.shadowOffsetX = 3;
  panel.shadowOffsetY = 3;
  parent.addControl(panel);

  const stack = new StackPanel(`${config.name}Stack`);
  stack.width = `${stackWidth}px`;
  stack.paddingTop = `${padding}px`;
  stack.paddingBottom = `${padding}px`;
  panel.addControl(stack);

  return { panel, stack };
}

const ACTION_BUTTON_COLORS = UI_THEME.colors.action;

export interface HeaderConfig {
  title: string;
  titleColor?: string;
  width: number;
  onClose: () => void;
  closeLabel?: string;
}

export interface ActionButtonConfig {
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

export interface SelectableButtonStyle {
  selectedBackground: string;
  selectedColor: string;
  unselectedBackground: string;
  unselectedColor: string;
  hoverBackground?: string;
  selectedThickness?: number;
  unselectedThickness?: number;
}

export interface SelectableButtonConfig {
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

export interface ListRowCardConfig {
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
  button.thickness = config.thickness ?? 1;
  button.fontSize = config.fontSize ?? UI_THEME.typography.bodySize;
  button.isEnabled = config.isEnabled ?? true;
  button.onPointerClickObservable.add(config.onClick);
  button.onPointerEnterObservable.add(() => {
    if (button.isEnabled) {
      button.background = palette.hover;
    }
  });
  button.onPointerOutObservable.add(() => {
    button.background = palette.normal;
  });
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
  container.thickness = 0;
  container.background = 'transparent';
  parent.addControl(container);

  const title = new TextBlock('title');
  title.text = config.title;
  title.color = config.titleColor ?? UI_THEME.colors.text.accent;
  title.fontSize = UI_THEME.typography.titleSize;
  title.fontWeight = 'bold';
  title.fontFamily = UI_THEME.typography.fontFamily;
  title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  title.left = '0px';
  container.addControl(title);

  const closeLabel = config.closeLabel ?? '✕';
  const isBackButton = closeLabel === '← Back';
  const colors = isBackButton ? UI_THEME.colors.headerButton.back : UI_THEME.colors.headerButton.close;

  const closeBtn = Button.CreateSimpleButton('closeBtn', closeLabel);
  closeBtn.width = isBackButton ? '70px' : '28px';
  closeBtn.height = `${UI_THEME.sizing.closeButtonSize}px`;
  closeBtn.cornerRadius = UI_THEME.radii.chip;
  closeBtn.background = colors.normal;
  closeBtn.color = UI_THEME.colors.text.primary;
  closeBtn.thickness = 0;
  closeBtn.fontSize = isBackButton ? UI_THEME.typography.bodySize : 14;
  closeBtn.fontFamily = UI_THEME.typography.fontFamily;
  closeBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  closeBtn.onPointerClickObservable.add(config.onClose);
  closeBtn.onPointerEnterObservable.add(() => {
    closeBtn.background = colors.hover;
  });
  closeBtn.onPointerOutObservable.add(() => {
    closeBtn.background = colors.normal;
  });
  container.addControl(closeBtn);

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
  container.cornerRadius = UI_THEME.radii.scale.r4;
  container.background = 'rgba(30, 60, 45, 0.8)';
  container.thickness = 1;
  container.color = UI_THEME.colors.legacy.c_3a5a4a;
  container.paddingTop = `${marginTop}px`;
  parent.addControl(container);
  return container;
}

export type SectionTheme = 'green' | 'blue' | 'purple' | 'neutral';

const SECTION_THEMES: Record<SectionTheme, { background: string; border: string }> = {
  green: { background: 'rgba(30, 60, 45, 0.8)', border: '#3a5a4a' },
  blue: { background: 'rgba(30, 50, 70, 0.8)', border: '#3a5a7a' },
  purple: { background: 'rgba(50, 40, 70, 0.8)', border: '#5a4a7a' },
  neutral: { background: 'transparent', border: 'transparent' },
};

export interface PanelSectionConfig {
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

export function createPanelSection(parent: UIParent, config: PanelSectionConfig): Rectangle {
  const theme = SECTION_THEMES[config.theme ?? 'green'];
  const container = new Rectangle(config.name);
  container.height = `${config.height}px`;
  container.width = `${config.width}px`;
  container.cornerRadius = config.cornerRadius ?? 6;
  container.background = config.background ?? theme.background;
  container.thickness = config.thickness ?? 1;
  container.color = config.borderColor ?? theme.border;
  container.paddingTop = `${config.paddingTop ?? 6}px`;
  container.paddingBottom = `${config.paddingBottom ?? 4}px`;
  if ((config.marginTop ?? 0) > 0) {
    container.paddingTop = `${(config.paddingTop ?? 6) + (config.marginTop ?? 0)}px`;
  }
  parent.addControl(container);
  return container;
}
