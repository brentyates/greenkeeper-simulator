const TARGET_FILENAMES = new Set(['EmployeePanel.ts']);

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow manual action-bar container/grid construction in migrated files.',
    },
    schema: [],
    messages: {
      useHelper: 'Use addDialogActionBar(...) for dialog action rows instead of manual container/grid layout.',
    },
  },
  create(context) {
    const filename = context.getFilename().split('/').pop();
    if (!filename || !TARGET_FILENAMES.has(filename)) {
      return {};
    }

    return {
      CallExpression(node) {
        if (node.callee?.type !== 'Identifier' || node.callee.name !== 'createPanelSection') {
          return;
        }
        const config = node.arguments[1];
        if (!config || config.type !== 'ObjectExpression') {
          return;
        }
        const nameProp = config.properties.find(
          (prop) =>
            prop.type === 'Property' &&
            prop.key?.type === 'Identifier' &&
            prop.key.name === 'name' &&
            prop.value?.type === 'Literal' &&
            prop.value.value === 'buttonContainer'
        );
        if (nameProp) {
          context.report({ node, messageId: 'useHelper' });
        }
      },
      NewExpression(node) {
        if (node.callee?.type !== 'Identifier' || node.callee.name !== 'Grid') {
          return;
        }
        const firstArg = node.arguments[0];
        if (
          firstArg &&
          firstArg.type === 'Literal' &&
          firstArg.value === 'buttonGrid'
        ) {
          context.report({ node, messageId: 'useHelper' });
        }
      },
    };
  },
};
