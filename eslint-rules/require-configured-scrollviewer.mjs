export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require ScrollViewer instances to use configureDialogScrollViewer',
      category: 'Best Practices',
    },
    messages: {
      mustConfigure:
        'ScrollViewer must be configured via configureDialogScrollViewer(scrollViewer, ...).',
    },
    schema: [],
  },
  create(context) {
    const filename = context.getFilename().replaceAll('\\', '/');
    const isUIFile = filename.includes('/src/babylon/ui/') && filename.endsWith('.ts');
    if (!isUIFile) return {};

    const created = new Map(); // key -> node
    const configured = new Set(); // key
    const sourceCode = context.getSourceCode();

    const keyFor = (node) => sourceCode.getText(node);

    const isScrollViewerCtor = (node) =>
      node?.type === 'NewExpression' &&
      node.callee?.type === 'Identifier' &&
      node.callee.name === 'ScrollViewer';

    return {
      VariableDeclarator(node) {
        if (node.id?.type === 'Identifier' && isScrollViewerCtor(node.init)) {
          created.set(node.id.name, node);
        }
      },
      AssignmentExpression(node) {
        if (isScrollViewerCtor(node.right)) {
          const key = keyFor(node.left);
          created.set(key, node);
        }
      },
      CallExpression(node) {
        if (
          node.callee?.type === 'Identifier' &&
          node.callee.name === 'configureDialogScrollViewer' &&
          node.arguments.length > 0
        ) {
          const arg = node.arguments[0];
          if (arg.type === 'Identifier') {
            configured.add(arg.name);
          } else {
            configured.add(keyFor(arg));
          }
        }
      },
      'Program:exit'() {
        for (const [key, node] of created.entries()) {
          if (!configured.has(key)) {
            context.report({ node, messageId: 'mustConfigure' });
          }
        }
      },
    };
  },
};

