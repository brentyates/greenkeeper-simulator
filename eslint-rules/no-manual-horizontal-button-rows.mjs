export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require LayoutUtils helpers for horizontal button rows',
      category: 'Best Practices',
    },
    messages: {
      noManualHorizontalButtons:
        'Horizontal button rows must use LayoutUtils helpers (createHorizontalRow + addUniformButtons) instead of manual Button.CreateSimpleButton + addControl chains.',
    },
    schema: [],
  },
  create(context) {
    const sourcePath = context.getFilename().replaceAll('\\', '/');
    const isTargetUIFile =
      sourcePath.includes('/src/babylon/ui/') &&
      /(?:Panel|Dialog|Popup|Toolbar)\.ts$/.test(sourcePath);

    if (!isTargetUIFile) {
      return {};
    }

    const sourceCode = context.getSourceCode();
    const horizontalRows = new Set();
    const buttonVariables = new Set();
    const rowButtonCounts = new Map();

    const keyFor = (node) => sourceCode.getText(node);

    const isButtonCreateCall = (node) =>
      node?.type === 'CallExpression' &&
      node.callee?.type === 'MemberExpression' &&
      node.callee.object?.type === 'Identifier' &&
      node.callee.object.name === 'Button' &&
      node.callee.property?.type === 'Identifier' &&
      node.callee.property.name === 'CreateSimpleButton';

    return {
      AssignmentExpression(node) {
        if (
          node.left?.type === 'MemberExpression' &&
          node.left.property?.type === 'Identifier' &&
          node.left.property.name === 'isVertical' &&
          node.right?.type === 'Literal' &&
          node.right.value === false
        ) {
          horizontalRows.add(keyFor(node.left.object));
        }
      },
      VariableDeclarator(node) {
        if (node.id?.type === 'Identifier' && isButtonCreateCall(node.init)) {
          buttonVariables.add(node.id.name);
        }
      },
      CallExpression(node) {
        if (
          node.callee?.type !== 'MemberExpression' ||
          node.callee.property?.type !== 'Identifier' ||
          node.callee.property.name !== 'addControl'
        ) {
          return;
        }

        const rowKey = keyFor(node.callee.object);
        if (!horizontalRows.has(rowKey)) {
          return;
        }

        const firstArg = node.arguments[0];
        const addingButtonVar =
          firstArg?.type === 'Identifier' && buttonVariables.has(firstArg.name);
        const addingButtonInline = isButtonCreateCall(firstArg);
        if (!addingButtonVar && !addingButtonInline) {
          return;
        }

        const nextCount = (rowButtonCounts.get(rowKey) ?? 0) + 1;
        rowButtonCounts.set(rowKey, nextCount);

        if (nextCount >= 2) {
          context.report({ node, messageId: 'noManualHorizontalButtons' });
        }
      },
    };
  },
};
