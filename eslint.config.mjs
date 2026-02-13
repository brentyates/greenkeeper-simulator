import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import noDirectUIInteraction from './eslint-rules/no-direct-ui-interaction.mjs';
import noManualUIShell from './eslint-rules/no-manual-ui-shell.mjs';
import noManualHorizontalButtonRows from './eslint-rules/no-manual-horizontal-button-rows.mjs';
import requireConfiguredScrollViewer from './eslint-rules/require-configured-scrollviewer.mjs';
import requireDialogBlueprintScroll from './eslint-rules/require-dialog-blueprint-scroll.mjs';
import noManualDialogSections from './eslint-rules/no-manual-dialog-sections.mjs';
import requirePopupHeader from './eslint-rules/require-popup-header.mjs';
import noManualDialogLabels from './eslint-rules/no-manual-dialog-labels.mjs';
import noManualActionButtons from './eslint-rules/no-manual-action-buttons.mjs';
import noManualSelectorButtons from './eslint-rules/no-manual-selector-buttons.mjs';
import noManualListRowCards from './eslint-rules/no-manual-list-row-cards.mjs';
import noManualDialogActionBar from './eslint-rules/no-manual-dialog-action-bar.mjs';
import noManualPopupContentStack from './eslint-rules/no-manual-popup-content-stack.mjs';
import noStaleModalFieldClose from './eslint-rules/no-stale-modal-field-close.mjs';
import noHardcodedUIFontFamily from './eslint-rules/no-hardcoded-ui-font-family.mjs';
import noHardcodedUIFontSize from './eslint-rules/no-hardcoded-ui-font-size.mjs';
import noHardcodedUIColors from './eslint-rules/no-hardcoded-ui-colors.mjs';
import noHardcodedUIRadius from './eslint-rules/no-hardcoded-ui-radius.mjs';
import requireDialogRenderer from './eslint-rules/require-dialog-renderer.mjs';

export default [
  {
    files: ['tests/**/*.spec.ts', 'tests/**/*.test.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'custom': {
        rules: {
          'no-direct-ui-interaction': noDirectUIInteraction,
        },
      },
    },
    rules: {
      'custom/no-direct-ui-interaction': 'error',
    },
  },
  {
    files: ['src/babylon/ui/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      custom: {
        rules: {
          'no-manual-ui-shell': noManualUIShell,
          'require-configured-scrollviewer': requireConfiguredScrollViewer,
          'require-dialog-blueprint-scroll': requireDialogBlueprintScroll,
          'no-manual-dialog-sections': noManualDialogSections,
          'require-popup-header': requirePopupHeader,
          'no-manual-dialog-labels': noManualDialogLabels,
          'no-manual-action-buttons': noManualActionButtons,
          'no-manual-selector-buttons': noManualSelectorButtons,
          'no-manual-list-row-cards': noManualListRowCards,
          'no-manual-dialog-action-bar': noManualDialogActionBar,
          'no-manual-popup-content-stack': noManualPopupContentStack,
          'no-hardcoded-ui-font-family': noHardcodedUIFontFamily,
          'no-hardcoded-ui-font-size': noHardcodedUIFontSize,
          'no-hardcoded-ui-colors': noHardcodedUIColors,
          'no-hardcoded-ui-radius': noHardcodedUIRadius,
        },
      },
    },
    rules: {
      'custom/no-manual-ui-shell': 'error',
      'custom/require-configured-scrollviewer': 'error',
      'custom/require-dialog-blueprint-scroll': 'error',
      'custom/no-manual-dialog-sections': 'error',
      'custom/require-popup-header': 'error',
      'custom/no-manual-dialog-labels': 'error',
      'custom/no-manual-action-buttons': 'error',
      'custom/no-manual-selector-buttons': 'error',
      'custom/no-manual-list-row-cards': 'error',
      'custom/no-manual-dialog-action-bar': 'error',
      'custom/no-manual-popup-content-stack': 'error',
      'custom/no-hardcoded-ui-font-family': 'error',
      'custom/no-hardcoded-ui-font-size': 'error',
      'custom/no-hardcoded-ui-colors': 'error',
      'custom/no-hardcoded-ui-radius': 'error',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/babylon/ui/**/*.{ts,tsx}', 'tests/**/*.spec.ts', 'tests/**/*.test.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      customModal: {
        rules: {
          'no-stale-modal-field-close': noStaleModalFieldClose,
        },
      },
    },
    rules: {
      'customModal/no-stale-modal-field-close': 'error',
    },
  },
  {
    files: [
      'src/babylon/ui/CourseSetupDialog.ts',
      'src/babylon/ui/IrrigationSchedulePanel.ts',
    ],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      customLayout: {
        rules: {
          'no-manual-horizontal-button-rows': noManualHorizontalButtonRows,
        },
      },
    },
    rules: {
      'customLayout/no-manual-horizontal-button-rows': 'error',
    },
  },
  {
    files: [
      'src/babylon/ui/CourseSetupDialog.ts',
      'src/babylon/ui/IrrigationSchedulePanel.ts',
      'src/babylon/ui/IrrigationInfoPanel.ts',
      'src/babylon/ui/EmployeePanel.ts',
    ],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      customRenderer: {
        rules: {
          'require-dialog-renderer': requireDialogRenderer,
        },
      },
    },
    rules: {
      'customRenderer/require-dialog-renderer': 'error',
    },
  },
];
