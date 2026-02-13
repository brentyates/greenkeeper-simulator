const TARGET_FILENAMES = new Set([
  'ResearchPanel.ts',
  'EmployeePanel.ts',
]);

const SELECTOR_BUTTON_PREFIXES = ['funding_', 'cat_', 'role_'];

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow manual selector button creation in migrated files.',
    },
    schema: [],
    messages: {
      manualSelector:
        'Use createSelectableButton(...) for selector/toggle buttons instead of Button.CreateSimpleButton(...).',
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
          node.callee?.type !== 'MemberExpression' ||
          node.callee.object?.type !== 'Identifier' ||
          node.callee.object.name !== 'Button' ||
          node.callee.property?.type !== 'Identifier' ||
          node.callee.property.name !== 'CreateSimpleButton'
        ) {
          return;
        }
        const [firstArg] = node.arguments;
        if (!firstArg || firstArg.type !== 'Literal' || typeof firstArg.value !== 'string') {
          return;
        }
        if (SELECTOR_BUTTON_PREFIXES.some((prefix) => firstArg.value.startsWith(prefix))) {
          context.report({
            node,
            messageId: 'manualSelector',
          });
        }
      },
    };
  },
};
