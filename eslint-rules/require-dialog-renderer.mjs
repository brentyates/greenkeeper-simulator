export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require migrated dialog files to use renderDialog()',
      category: 'Best Practices',
    },
    schema: [],
    messages: {
      missingRenderer: 'This migrated dialog must use renderDialog(...) for schema-driven UI composition.',
    },
  },
  create(context) {
    let hasRenderDialogCall = false;
    return {
      CallExpression(node) {
        if (node.callee?.type === 'Identifier' && node.callee.name === 'renderDialog') {
          hasRenderDialogCall = true;
        }
      },
      'Program:exit'(node) {
        if (!hasRenderDialogCall) {
          context.report({
            node,
            messageId: 'missingRenderer',
          });
        }
      },
    };
  },
};

