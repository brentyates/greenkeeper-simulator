import { DialogNode } from '../DialogRenderer';
import { UI_THEME } from '../UITheme';

export function buildStandardHintBlock(config: {
  hintId: string;
  hintText: string;
  stateId: string;
  stateText: string;
}): DialogNode[] {
  return [
    {
      type: 'text',
      id: config.hintId,
      text: config.hintText,
      color: UI_THEME.colors.text.secondary,
      fontSize: UI_THEME.typography.scale.s10,
      height: 16,
    },
    {
      type: 'text',
      id: config.stateId,
      text: config.stateText,
      color: UI_THEME.colors.text.secondary,
      fontSize: UI_THEME.typography.scale.s10,
      height: 16,
    },
  ];
}

export function buildStandardPrimaryDangerFooter(config: {
  id: string;
  rowWidth: number;
  rowHeight: number;
  gap: number;
  paddingTop?: number;
  primary: { id: string; label: string; onClick: () => void };
  danger: { id: string; label: string; onClick: () => void };
}): DialogNode {
  return {
    type: 'rowButtons',
    id: config.id,
    rowWidth: config.rowWidth,
    rowHeight: config.rowHeight,
    gap: config.gap,
    paddingTop: config.paddingTop,
    specs: [
      {
        id: config.primary.id,
        label: config.primary.label,
        onClick: config.primary.onClick,
        background: UI_THEME.colors.action.success.normal,
        hoverBackground: UI_THEME.colors.action.success.hover,
        color: UI_THEME.colors.text.primary,
      },
      {
        id: config.danger.id,
        label: config.danger.label,
        onClick: config.danger.onClick,
        background: UI_THEME.colors.action.danger.normal,
        hoverBackground: UI_THEME.colors.action.danger.hover,
        color: UI_THEME.colors.text.primary,
      },
    ],
  };
}

export function buildFieldLabel(config: {
  id: string;
  text: string;
  paddingTop?: number;
}): DialogNode {
  return {
    type: 'label',
    config: {
      id: config.id,
      text: config.text,
      tone: 'muted',
      fontSize: UI_THEME.typography.scale.s11,
      height: 20,
      paddingTop: config.paddingTop ?? 8,
    },
  };
}

