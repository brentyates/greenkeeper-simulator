export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow manual dialog/panel section containers; use shared helpers',
      category: 'Best Practices',
    },
    messages: {
      noManualSection:
        'Use createPanelSection(...) or DialogBlueprint helpers for section/container blocks instead of new Rectangle(...).',
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
        if (node.callee?.type !== 'Identifier' || node.callee.name !== 'Rectangle') return;
        const firstArg = node.arguments[0];
        if (!firstArg || firstArg.type !== 'Literal' || typeof firstArg.value !== 'string') return;

        const name = firstArg.value;
        if (name.includes('Container') || name.includes('Section')) {
          context.report({ node, messageId: 'noManualSection' });
        }
      },
    };
  },
};
