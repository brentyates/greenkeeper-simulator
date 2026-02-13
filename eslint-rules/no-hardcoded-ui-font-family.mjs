export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow hardcoded fontFamily literals in UI panels/dialogs',
      category: 'Best Practices',
    },
    schema: [],
    messages: {
      noHardcodedFontFamily:
        'Do not hardcode `fontFamily` in UI files. Use UI_THEME typography tokens or shared helper defaults.',
    },
  },
  create(context) {
    const sourcePath = context.getFilename().replaceAll('\\', '/');
    const isTargetUIFile =
      sourcePath.includes('/src/babylon/ui/') &&
      /(?:Panel|Dialog|Popup|Toolbar|UI|Screen|Manual)\.ts$/.test(sourcePath);
    const isExemptFile =
      sourcePath.endsWith('/src/babylon/ui/UITheme.ts') ||
      sourcePath.endsWith('/src/babylon/ui/PopupUtils.ts') ||
      sourcePath.endsWith('/src/babylon/ui/LayoutUtils.ts') ||
      sourcePath.endsWith('/src/babylon/ui/DialogBlueprint.ts');

    if (!isTargetUIFile || isExemptFile) {
      return {};
    }

    return {
      AssignmentExpression(node) {
        if (
          node.left?.type === 'MemberExpression' &&
          node.left.property?.type === 'Identifier' &&
          node.left.property.name === 'fontFamily' &&
          node.right?.type === 'Literal' &&
          typeof node.right.value === 'string'
        ) {
          context.report({ node, messageId: 'noHardcodedFontFamily' });
        }
      },
    };
  },
};
