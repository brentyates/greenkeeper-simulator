import { Control } from '@babylonjs/gui/2D/controls/control';
import { InputText } from '@babylonjs/gui/2D/controls/inputText';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { addDialogSectionLabel, DialogLabelConfig } from './DialogBlueprint';
import { addUniformButtons, addVerticalSpacer, createHorizontalRow } from './LayoutUtils';
import { createDirectPopup, createDockedPanel, createOverlayPopup, createPopupHeader, PopupColors } from './PopupUtils';
import { UI_THEME } from './UITheme';

export type DialogShellType = 'overlay' | 'direct' | 'docked';

export interface DialogDockConfig {
  horizontalAlignment: number;
  verticalAlignment: number;
  left?: number;
  top?: number;
}

export interface DialogActionSpec {
  id: string;
  label: string;
  onClick: () => void;
  background?: string;
  hoverBackground?: string;
  color?: string;
  fontSize?: number;
}

export interface DialogRowButtonsNode {
  type: 'rowButtons';
  id: string;
  rowWidth: number;
  rowHeight: number;
  gap: number;
  paddingTop?: number;
  buttonCornerRadius?: number;
  specs: DialogActionSpec[];
}

export interface DialogTextNode {
  type: 'text';
  id: string;
  text: string;
  color?: string;
  fontSize?: number;
  height?: number;
  align?: number;
  paddingTop?: number;
}

export interface DialogInputNode {
  type: 'input';
  id: string;
  text: string;
  height?: number;
  background?: string;
}

export interface DialogLabelNode {
  type: 'label';
  config: DialogLabelConfig;
}

export interface DialogSpacerNode {
  type: 'spacer';
  id: string;
  size: number;
}

export interface DialogCustomNode {
  type: 'custom';
  id: string;
  render: (parent: StackPanel, controls: DialogRenderControls) => void;
}

export type DialogNode =
  | DialogTextNode
  | DialogInputNode
  | DialogLabelNode
  | DialogSpacerNode
  | DialogRowButtonsNode
  | DialogCustomNode;

export interface DialogSchema {
  name: string;
  shell: DialogShellType;
  width: number;
  height: number;
  padding: number;
  colors: PopupColors;
  dock?: DialogDockConfig;
  title: string;
  titleColor?: string;
  headerWidth: number;
  onClose: () => void;
  nodes: DialogNode[];
}

export interface DialogRenderControls {
  texts: Map<string, TextBlock>;
  inputs: Map<string, InputText>;
  rows: Map<string, StackPanel>;
}

export interface DialogRenderResult {
  panel: Rectangle;
  stack: StackPanel;
  overlay?: Rectangle;
  controls: DialogRenderControls;
}

export function renderDialog(
  texture: AdvancedDynamicTexture,
  schema: DialogSchema
): DialogRenderResult {
  const controls: DialogRenderControls = {
    texts: new Map(),
    inputs: new Map(),
    rows: new Map(),
  };

  const renderNodes = (stack: StackPanel): void => {
    createPopupHeader(stack, {
      title: schema.title,
      titleColor: schema.titleColor,
      width: schema.headerWidth,
      onClose: schema.onClose,
    });

    for (const node of schema.nodes) {
      if (node.type === 'label') {
        addDialogSectionLabel(stack, node.config);
        continue;
      }
      if (node.type === 'spacer') {
        addVerticalSpacer(stack, node.size, node.id);
        continue;
      }
      if (node.type === 'text') {
        const text = new TextBlock(node.id);
        text.text = node.text;
        text.color = node.color ?? UI_THEME.colors.text.secondary;
        text.fontSize = node.fontSize ?? UI_THEME.typography.bodySize;
        text.fontFamily = UI_THEME.typography.fontFamily;
        text.height = `${node.height ?? 20}px`;
        text.textHorizontalAlignment = node.align ?? Control.HORIZONTAL_ALIGNMENT_LEFT;
        if (node.paddingTop !== undefined) {
          text.paddingTop = `${node.paddingTop}px`;
        }
        stack.addControl(text);
        controls.texts.set(node.id, text);
        continue;
      }
      if (node.type === 'input') {
        const input = new InputText(node.id);
        input.width = '100%';
        input.height = `${node.height ?? UI_THEME.sizing.inputHeight}px`;
        input.text = node.text;
        input.color = UI_THEME.colors.text.primary;
        input.fontSize = UI_THEME.typography.bodySize;
        input.fontFamily = UI_THEME.typography.fontFamily;
        input.background = node.background ?? UI_THEME.colors.legacy.c_0d1f15;
        input.focusedBackground = UI_THEME.colors.legacy.c_1a3a2a;
        input.thickness = 1;
        input.focusedColor = UI_THEME.colors.text.success;
        input.paddingLeft = '8px';
        stack.addControl(input);
        controls.inputs.set(node.id, input);
        continue;
      }
      if (node.type === 'rowButtons') {
        const row = createHorizontalRow(stack, {
          name: node.id,
          widthPx: node.rowWidth,
          heightPx: node.rowHeight,
          paddingTopPx: node.paddingTop,
        });
        addUniformButtons(row, {
          rowWidthPx: node.rowWidth,
          rowHeightPx: node.rowHeight,
          gapPx: node.gap,
          cornerRadius: node.buttonCornerRadius ?? UI_THEME.radii.button,
          specs: node.specs,
        });
        controls.rows.set(node.id, row);
        continue;
      }
      node.render(stack, controls);
    }
  };

  if (schema.shell === 'overlay') {
    const popup = createOverlayPopup(texture, {
      name: schema.name,
      width: schema.width,
      height: schema.height,
      colors: schema.colors,
      padding: schema.padding,
    });
    renderNodes(popup.stack);
    return { panel: popup.panel, stack: popup.stack, overlay: popup.overlay, controls };
  }

  if (schema.shell === 'docked') {
    const popup = createDockedPanel(texture, {
      name: schema.name,
      width: schema.width,
      height: schema.height,
      colors: schema.colors,
      horizontalAlignment: schema.dock?.horizontalAlignment ?? Control.HORIZONTAL_ALIGNMENT_LEFT,
      verticalAlignment: schema.dock?.verticalAlignment ?? Control.VERTICAL_ALIGNMENT_TOP,
      left: schema.dock?.left ?? 0,
      top: schema.dock?.top ?? 0,
      padding: schema.padding,
    });
    renderNodes(popup.stack);
    return { panel: popup.panel, stack: popup.stack, controls };
  }

  const popup = createDirectPopup(texture, {
    name: schema.name,
    width: schema.width,
    height: schema.height,
    colors: schema.colors,
    padding: schema.padding,
  });
  renderNodes(popup.stack);
  return { panel: popup.panel, stack: popup.stack, controls };
}
