const TARGET_FILENAMES = new Set([
  'DaySummaryPopup.ts',
  'TeeSheetPanel.ts',
  'WalkOnQueuePanel.ts',
  'AmenityPanel.ts',
  'EquipmentStorePanel.ts',
]);

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow manual action button creation in migrated dialog files.',
    },
    schema: [],
    messages: {
      manualAction:
        'Use createActionButton(...) for dialog action buttons instead of Button.CreateSimpleButton(...).',
    },
  },
  create(context) {
    const filename = context.getFilename().split('/').pop();
    if (!filename || !TARGET_FILENAMES.has(filename)) {
      return {};
    }

    return {
      CallExpression(node) {
        if (
          node.callee?.type === 'MemberExpression' &&
          node.callee.object?.type === 'Identifier' &&
          node.callee.object.name === 'Button' &&
          node.callee.property?.type === 'Identifier' &&
          node.callee.property.name === 'CreateSimpleButton'
        ) {
          context.report({
            node,
            messageId: 'manualAction',
          });
        }
      },
    };
  },
};
