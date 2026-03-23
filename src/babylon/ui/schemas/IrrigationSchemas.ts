import { DialogNode } from '../DialogRenderer';
import { UI_THEME } from '../UITheme';
import { UI_SPACING } from '../LayoutUtils';
import { buildStandardHintBlock, buildStandardPrimaryDangerFooter } from './DialogSchemaPresets';

export interface IrrigationScheduleNodeHandlers {
  onToggleEnabled: () => void;
  onToggleRainSkip: () => void;
  onPresetDawn: () => void;
  onPresetEvening: () => void;
  onPresetDual: () => void;
  onPresetOff: () => void;
  onClearWindows: () => void;
  onSave: () => void;
  onClose: () => void;
}

export function buildIrrigationScheduleNodes(
  handlers: IrrigationScheduleNodeHandlers
): DialogNode[] {
  return [
    { type: 'spacer', id: 'scheduleHeaderGap', size: UI_SPACING.xs },
    ...buildStandardHintBlock({
      hintId: 'saveHint',
      hintText: 'Preset buttons change the live draft. Apply Program commits it to the selected head.',
      stateId: 'saveState',
      stateText: 'Select a sprinkler head to edit',
    }),
    { type: 'label', config: { id: 'systemLabel', text: 'Controller State', tone: 'info', fontSize: UI_THEME.typography.scale.s12, height: 20, paddingTop: 2 } },
    { type: 'text', id: 'target', text: 'No sprinkler selected', color: UI_THEME.colors.text.secondary, fontSize: UI_THEME.typography.scale.s12, height: 24 },
    { type: 'text', id: 'enabled', text: 'System: Armed', color: UI_THEME.colors.text.success, fontSize: UI_THEME.typography.scale.s12, height: 22 },
    { type: 'text', id: 'skipRain', text: 'Rain Skip: Off', color: UI_THEME.colors.text.info, fontSize: UI_THEME.typography.scale.s12, height: 22 },
    { type: 'text', id: 'windows', text: 'Windows: 5:00 AM-7:00 AM, 6:00 PM-8:00 PM', color: UI_THEME.colors.legacy.c_dddddd, fontSize: UI_THEME.typography.scale.s11, height: 54 },
    {
      type: 'rowButtons',
      id: 'toggleRow',
      rowWidth: 356,
      rowHeight: 32,
      gap: UI_SPACING.sm,
      specs: [
        { id: 'enabledBtn', label: 'Arm / Disarm', onClick: handlers.onToggleEnabled, background: UI_THEME.colors.legacy.c_2a5a3a, hoverBackground: UI_THEME.colors.legacy.c_3a6a4a },
        { id: 'rainBtn', label: 'Rain Skip', onClick: handlers.onToggleRainSkip },
      ],
    },
    { type: 'label', config: { id: 'presetsLabel', text: 'Quick Programs', tone: 'success', fontSize: UI_THEME.typography.scale.s12, height: 20, paddingTop: 6 } },
    {
      type: 'rowButtons',
      id: 'presetsTop',
      rowWidth: 356,
      rowHeight: 32,
      gap: UI_SPACING.xs,
      specs: [
        { id: 'dawnBtn', label: 'Morning', onClick: handlers.onPresetDawn },
        { id: 'eveningBtn', label: 'Evening', onClick: handlers.onPresetEvening },
        { id: 'dualBtn', label: 'Twice Daily', onClick: handlers.onPresetDual },
      ],
    },
    {
      type: 'rowButtons',
      id: 'presetsBottom',
      rowWidth: 356,
      rowHeight: 32,
      gap: UI_SPACING.sm,
      paddingTop: UI_SPACING.xs,
      specs: [
        { id: 'offBtn', label: 'Shut Off', onClick: handlers.onPresetOff },
        { id: 'clearBtn', label: 'Clear Windows', onClick: handlers.onClearWindows },
      ],
    },
    buildStandardPrimaryDangerFooter({
      id: 'actions',
      rowWidth: 356,
      rowHeight: 34,
      gap: UI_SPACING.sm,
      paddingTop: UI_SPACING.sm,
      primary: { id: 'saveBtn', label: 'Apply Program', onClick: handlers.onSave },
      danger: { id: 'closeBtn', label: 'Close Panel', onClick: handlers.onClose },
    }),
  ];
}

export function buildIrrigationInfoNodes(
  renderInfoContent: (parent: import('@babylonjs/gui/2D/controls/stackPanel').StackPanel) => void
): DialogNode[] {
  return [
    { type: 'custom', id: 'irrigationInfoBody', render: (parent) => renderInfoContent(parent) },
  ];
}
