export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require DialogBlueprint scroll blocks for panel/dialog/popup/toolbar UI files',
      category: 'Best Practices',
    },
    messages: {
      noManualScroll:
        'Use DialogBlueprint.addDialogScrollBlock(...) instead of new ScrollViewer(...) in panel/dialog/popup/toolbar files.',
    },
    schema: [],
  },
  create(context) {
    const sourcePath = context.getFilename().replaceAll('\\', '/');
    const isTargetUIFile =
      sourcePath.includes('/src/babylon/ui/') &&
      /(?:Panel|Dialog|Popup|Toolbar|UI)\.ts$/.test(sourcePath);

    if (!isTargetUIFile) return {};

    return {
      NewExpression(node) {
        if (node.callee?.type === 'Identifier' && node.callee.name === 'ScrollViewer') {
          context.report({ node, messageId: 'noManualScroll' });
        }
      },
    };
  },
};
