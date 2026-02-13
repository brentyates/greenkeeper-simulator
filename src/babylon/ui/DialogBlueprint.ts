import { ScrollViewer } from '@babylonjs/gui/2D/controls/scrollViewers/scrollViewer';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Button } from '@babylonjs/gui/2D/controls/button';
import { createActionButton, createPanelSection, SectionTheme } from './PopupUtils';
import { configureDialogScrollViewer, DialogScrollOptions } from './LayoutUtils';
import { UIParent } from './UIParent';
import { UI_THEME } from './UITheme';

export interface DialogSectionTitle {
  text: string;
  color?: string;
  fontSize?: number;
  fontWeight?: string;
  height?: number;
  paddingTop?: number;
}

export interface DialogBlockConfig {
  id: string;
  title?: DialogSectionTitle;
  width: number;
  height: number;
  theme?: SectionTheme;
  paddingTop?: number;
  paddingBottom?: number;
  cornerRadius?: number;
  thickness?: number;
  background?: string;
  borderColor?: string;
}

export interface DialogScrollBlockConfig extends DialogBlockConfig {
  scroll: {
    name: string;
    width: number;
    height: number;
    contentName: string;
    contentWidth: string;
    options?: DialogScrollOptions;
  };
}

export interface DialogScrollBlockResult {
  container: ReturnType<typeof createPanelSection>;
  scrollViewer: ScrollViewer;
  content: StackPanel;
}

export interface DialogActionSpec {
  id: string;
  label: string;
  tone?: 'primary' | 'danger' | 'warning' | 'neutral' | 'success';
  onClick: () => void;
  fontSize?: number;
}

export interface DialogActionBarConfig {
  id: string;
  width: number;
  height?: number;
  theme?: SectionTheme;
  paddingTop?: number;
  paddingBottom?: number;
  actions: DialogActionSpec[];
}

export interface DialogActionBarResult {
  container: ReturnType<typeof createPanelSection>;
  buttons: Button[];
}

export function addDialogTitle(parent: StackPanel, title: DialogSectionTitle): TextBlock {
  const sectionLabel = new TextBlock(`${title.text}_label`);
  sectionLabel.text = title.text;
  sectionLabel.color = title.color ?? UI_THEME.colors.text.info;
  sectionLabel.fontSize = title.fontSize ?? UI_THEME.typography.bodySize;
  if (title.fontWeight) {
    sectionLabel.fontWeight = title.fontWeight;
  }
  sectionLabel.height = `${title.height ?? UI_THEME.sizing.sectionLabelHeight}px`;
  sectionLabel.fontFamily = UI_THEME.typography.fontFamily;
  sectionLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  if (title.paddingTop !== undefined) {
    sectionLabel.paddingTop = `${title.paddingTop}px`;
  }
  parent.addControl(sectionLabel);
  return sectionLabel;
}

export interface DialogLabelConfig {
  id: string;
  text: string;
  tone?: 'default' | 'success' | 'info' | 'muted';
  fontSize?: number;
  fontWeight?: string;
  height?: number;
  paddingTop?: number;
}

const LABEL_TONES: Record<NonNullable<DialogLabelConfig['tone']>, string> = {
  default: UI_THEME.colors.text.info,
  success: UI_THEME.colors.text.success,
  info: UI_THEME.colors.text.info,
  muted: UI_THEME.colors.text.secondary,
};

export function addDialogSectionLabel(parent: UIParent, config: DialogLabelConfig): TextBlock {
  const label = new TextBlock(config.id);
  label.text = config.text;
  label.color = LABEL_TONES[config.tone ?? 'default'];
  label.fontSize = config.fontSize ?? UI_THEME.typography.bodySize;
  if (config.fontWeight) {
    label.fontWeight = config.fontWeight;
  }
  label.height = `${config.height ?? UI_THEME.sizing.sectionLabelHeight}px`;
  label.fontFamily = UI_THEME.typography.fontFamily;
  label.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  if (config.paddingTop !== undefined) {
    label.paddingTop = `${config.paddingTop}px`;
  }
  parent.addControl(label);
  return label;
}

export function addDialogPanelBlock(parent: StackPanel, block: DialogBlockConfig) {
  if (block.title) {
    addDialogTitle(parent, block.title);
  }
  return createPanelSection(parent, {
    name: block.id,
    width: block.width,
    height: block.height,
    theme: block.theme ?? 'green',
    paddingTop: block.paddingTop,
    paddingBottom: block.paddingBottom,
    cornerRadius: block.cornerRadius,
    thickness: block.thickness,
    background: block.background,
    borderColor: block.borderColor,
  });
}

export function addDialogScrollBlock(
  parent: StackPanel,
  block: DialogScrollBlockConfig
): DialogScrollBlockResult {
  const container = addDialogPanelBlock(parent, block);
  const scrollViewer = new ScrollViewer(block.scroll.name);
  scrollViewer.width = `${block.scroll.width}px`;
  scrollViewer.height = `${block.scroll.height}px`;
  configureDialogScrollViewer(scrollViewer, block.scroll.options);
  container.addControl(scrollViewer);

  const content = new StackPanel(block.scroll.contentName);
  content.width = block.scroll.contentWidth;
  scrollViewer.addControl(content);

  return { container, scrollViewer, content };
}

export function addDialogActionBar(
  parent: StackPanel,
  config: DialogActionBarConfig
): DialogActionBarResult {
  const container = createPanelSection(parent, {
    name: config.id,
    width: config.width,
    height: config.height ?? 56,
    theme: config.theme ?? 'green',
    paddingTop: config.paddingTop ?? 6,
    paddingBottom: config.paddingBottom ?? 6,
  });

  const row = new StackPanel(`${config.id}_row`);
  row.isVertical = false;
  row.width = `${config.width - 12}px`;
  row.height = `${UI_THEME.sizing.actionButtonHeight + 1}px`;
  container.addControl(row);

  const gap = UI_THEME.spacing.sm;
  const buttonWidth = Math.floor((config.width - 12 - gap * (config.actions.length - 1)) / config.actions.length);
  const buttons: Button[] = [];

  config.actions.forEach((action, index) => {
    const button = createActionButton({
      id: action.id,
      label: action.label,
      tone: action.tone ?? 'neutral',
      width: buttonWidth,
      fontSize: action.fontSize ?? UI_THEME.typography.bodySize,
      thickness: 2,
      onClick: action.onClick,
    });
    row.addControl(button);
    buttons.push(button);

    if (index < config.actions.length - 1) {
      const spacer = new TextBlock(`${config.id}_gap_${index}`);
      spacer.text = '';
      spacer.width = `${gap}px`;
      spacer.height = '1px';
      row.addControl(spacer);
    }
  });

  return { container, buttons };
}
