import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Button } from '@babylonjs/gui/2D/controls/button';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';

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
  panel.cornerRadius = 10;
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
  panel.cornerRadius = 8;
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

export interface HeaderConfig {
  title: string;
  titleColor?: string;
  width: number;
  onClose: () => void;
  closeLabel?: string;
}

export function createPopupHeader(parent: StackPanel, config: HeaderConfig): Rectangle {
  const container = new Rectangle('headerContainer');
  container.height = '36px';
  container.width = `${config.width}px`;
  container.thickness = 0;
  container.background = 'transparent';
  parent.addControl(container);

  const title = new TextBlock('title');
  title.text = config.title;
  title.color = config.titleColor ?? '#ffcc00';
  title.fontSize = 16;
  title.fontWeight = 'bold';
  title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  title.left = '0px';
  container.addControl(title);

  const closeLabel = config.closeLabel ?? '✕';
  const isBackButton = closeLabel === '← Back';

  const closeBtn = Button.CreateSimpleButton('closeBtn', closeLabel);
  closeBtn.width = isBackButton ? '70px' : '28px';
  closeBtn.height = '28px';
  closeBtn.cornerRadius = 4;
  closeBtn.background = isBackButton ? '#4a6a5a' : '#aa4444';
  closeBtn.color = 'white';
  closeBtn.thickness = 0;
  closeBtn.fontSize = isBackButton ? 12 : 14;
  closeBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  closeBtn.onPointerClickObservable.add(config.onClose);
  closeBtn.onPointerEnterObservable.add(() => {
    closeBtn.background = isBackButton ? '#5a7a6a' : '#cc5555';
  });
  closeBtn.onPointerOutObservable.add(() => {
    closeBtn.background = isBackButton ? '#4a6a5a' : '#aa4444';
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
  container.cornerRadius = 4;
  container.background = 'rgba(30, 60, 45, 0.8)';
  container.thickness = 1;
  container.color = '#3a5a4a';
  container.paddingTop = `${marginTop}px`;
  parent.addControl(container);
  return container;
}
