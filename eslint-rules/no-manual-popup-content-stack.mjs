export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow manually adding root content stacks to popup shell containers',
      category: 'Best Practices',
    },
    schema: [],
    messages: {
      noManualPopupStack:
        'Do not manually add a new root StackPanel to popup shell containers (panel/dialog/overlay). Use the stack returned by popup helpers.',
    },
  },
  create(context) {
    const sourcePath = context.getFilename().replaceAll('\\', '/');
    const isTargetUIFile =
      sourcePath.includes('/src/babylon/ui/') &&
      /(?:Panel|Dialog|Popup|Toolbar|UI)\.ts$/.test(sourcePath);
    const isExemptFile =
      sourcePath.endsWith('/src/babylon/ui/PopupUtils.ts') ||
      sourcePath.endsWith('/src/babylon/ui/LayoutUtils.ts') ||
      sourcePath.endsWith('/src/babylon/ui/DialogBlueprint.ts');

    if (!isTargetUIFile || isExemptFile) {
      return {};
    }

    const rootStackVars = new Set();

    return {
      VariableDeclarator(node) {
        if (
          node.id?.type === 'Identifier' &&
          node.init?.type === 'NewExpression' &&
          node.init.callee?.type === 'Identifier' &&
          node.init.callee.name === 'StackPanel'
        ) {
          rootStackVars.add(node.id.name);
        }
      },
      CallExpression(node) {
        if (
          node.callee?.type !== 'MemberExpression' ||
          node.callee.property?.type !== 'Identifier' ||
          node.callee.property.name !== 'addControl' ||
          node.arguments.length === 0
        ) {
          return;
        }

        const firstArg = node.arguments[0];
        if (firstArg?.type !== 'Identifier' || !rootStackVars.has(firstArg.name)) {
          return;
        }

        const receiver = node.callee.object;

        const isShellReceiver =
          (receiver?.type === 'Identifier' &&
            (receiver.name === 'panel' || receiver.name === 'dialog' || receiver.name === 'overlay')) ||
          (receiver?.type === 'MemberExpression' &&
            receiver.object?.type === 'ThisExpression' &&
            receiver.property?.type === 'Identifier' &&
            (receiver.property.name === 'panel' ||
              receiver.property.name === 'dialog' ||
              receiver.property.name === 'overlay'));

        if (isShellReceiver) {
          context.report({ node, messageId: 'noManualPopupStack' });
        }
      },
    };
  },
};
