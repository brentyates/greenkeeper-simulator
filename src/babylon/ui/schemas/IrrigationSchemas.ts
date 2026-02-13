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
      hintText: 'Changes apply when you press Save',
      stateId: 'saveState',
      stateText: 'Select a sprinkler to edit',
    }),
    { type: 'text', id: 'target', text: 'No sprinkler selected', color: UI_THEME.colors.text.secondary, fontSize: UI_THEME.typography.scale.s12, height: 20 },
    { type: 'text', id: 'enabled', text: 'Enabled: Yes', color: UI_THEME.colors.text.success, fontSize: UI_THEME.typography.scale.s12, height: 20 },
    { type: 'text', id: 'skipRain', text: 'Skip rain: No', color: UI_THEME.colors.text.info, fontSize: UI_THEME.typography.scale.s12, height: 20 },
    { type: 'text', id: 'windows', text: 'Windows: 5:00 AM-7:00 AM, 6:00 PM-8:00 PM', color: UI_THEME.colors.legacy.c_dddddd, fontSize: UI_THEME.typography.scale.s11, height: 48 },
    {
      type: 'rowButtons',
      id: 'toggleRow',
      rowWidth: 300,
      rowHeight: 28,
      gap: UI_SPACING.sm,
      specs: [
        { id: 'enabledBtn', label: 'Toggle Enabled', onClick: handlers.onToggleEnabled, background: UI_THEME.colors.legacy.c_2a5a3a, hoverBackground: UI_THEME.colors.legacy.c_3a6a4a },
        { id: 'rainBtn', label: 'Toggle Rain Skip', onClick: handlers.onToggleRainSkip },
      ],
    },
    { type: 'label', config: { id: 'presetsLabel', text: 'Presets', tone: 'success', fontSize: UI_THEME.typography.scale.s12, height: 20, paddingTop: 4 } },
    {
      type: 'rowButtons',
      id: 'presetsTop',
      rowWidth: 300,
      rowHeight: 28,
      gap: UI_SPACING.xs,
      specs: [
        { id: 'dawnBtn', label: 'Dawn', onClick: handlers.onPresetDawn },
        { id: 'eveningBtn', label: 'Evening', onClick: handlers.onPresetEvening },
        { id: 'dualBtn', label: 'Dawn+Evening', onClick: handlers.onPresetDual },
      ],
    },
    {
      type: 'rowButtons',
      id: 'presetsBottom',
      rowWidth: 300,
      rowHeight: 28,
      gap: UI_SPACING.sm,
      paddingTop: UI_SPACING.xs,
      specs: [
        { id: 'offBtn', label: 'Disable Watering', onClick: handlers.onPresetOff },
        { id: 'clearBtn', label: 'Clear Windows', onClick: handlers.onClearWindows },
      ],
    },
    buildStandardPrimaryDangerFooter({
      id: 'actions',
      rowWidth: 300,
      rowHeight: 30,
      gap: UI_SPACING.sm,
      paddingTop: UI_SPACING.sm,
      primary: { id: 'saveBtn', label: 'Save', onClick: handlers.onSave },
      danger: { id: 'closeBtn', label: 'Close', onClick: handlers.onClose },
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
