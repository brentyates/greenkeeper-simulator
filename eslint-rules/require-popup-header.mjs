const TARGET_FILE_PATTERN = /(Panel|Dialog|Popup|Toolbar|UI)\.ts$/;

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require popup/dialog UI shells to use createPopupHeader() for consistent headers.',
    },
    schema: [],
    messages: {
      missingHeader:
        'UI shell files should use createPopupHeader(...) instead of custom title/close rows.',
    },
  },
  create(context) {
    const filename = context.getFilename();
    const isTargetFile = TARGET_FILE_PATTERN.test(filename);
    if (!isTargetFile) {
      return {};
    }

    let hasPopupHeaderCall = false;
    let hasDialogRendererCall = false;

    return {
      CallExpression(node) {
        if (node.callee?.type === 'Identifier' && node.callee.name === 'createPopupHeader') {
          hasPopupHeaderCall = true;
        }
        if (node.callee?.type === 'Identifier' && node.callee.name === 'renderDialog') {
          hasDialogRendererCall = true;
        }
      },
      'Program:exit'(node) {
        if (!hasPopupHeaderCall && !hasDialogRendererCall) {
          context.report({
            node,
            messageId: 'missingHeader',
          });
        }
      },
    };
  },
};
