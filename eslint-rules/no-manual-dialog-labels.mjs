const TARGET_FILENAMES = new Set([
  'AmenityPanel.ts',
  'ResearchPanel.ts',
  'IrrigationSchedulePanel.ts',
  'IrrigationToolbar.ts',
  'HoleBuilderToolbar.ts',
  'TeeSheetPanel.ts',
  'EmployeePanel.ts',
  'DaySummaryPopup.ts',
  'CourseLayoutPanel.ts',
]);

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow manual TextBlock section labels where dialog label helper should be used.',
    },
    schema: [],
    messages: {
      manualLabel:
        'Use addDialogSectionLabel(...) for dialog/panel labels instead of new TextBlock(...).',
    },
  },
  create(context) {
    const filename = context.getFilename().split('/').pop();
    if (!filename || !TARGET_FILENAMES.has(filename)) {
      return {};
    }

    return {
      NewExpression(node) {
        if (node.callee?.type !== 'Identifier' || node.callee.name !== 'TextBlock') {
          return;
        }
        const [firstArg] = node.arguments;
        if (!firstArg || firstArg.type !== 'Literal' || typeof firstArg.value !== 'string') {
          return;
        }
        if (/(Label|Title)$/.test(firstArg.value)) {
          context.report({
            node,
            messageId: 'manualLabel',
          });
        }
      },
    };
  },
};
