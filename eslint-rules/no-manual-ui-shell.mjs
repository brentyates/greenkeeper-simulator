export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow manual popup/dialog shell construction in UI panel classes',
      category: 'Best Practices',
    },
    messages: {
      noManualShell:
        'Do not manually construct dialog/panel shells with Rectangle. Use PopupUtils helpers (createOverlayPopup, createDirectPopup, createDockedPanel).',
    },
    schema: [],
  },
  create(context) {
    const sourcePath = context.getFilename();
    const normalizedPath = sourcePath.replaceAll('\\', '/');

    // Enforce on all primary UI surface files.
    const isTargetUIFile =
      normalizedPath.includes('/src/babylon/ui/') &&
      /(?:Panel|Dialog|Popup|Toolbar|UI)\.ts$/.test(normalizedPath);
    // Helper/provider files can construct shared primitives.
    const isExemptFile =
      normalizedPath.endsWith('/src/babylon/ui/PopupUtils.ts') ||
      normalizedPath.endsWith('/src/babylon/ui/LayoutUtils.ts');

    if (!isTargetUIFile || isExemptFile) {
      return {};
    }

    const isShellField = (propertyName) =>
      propertyName === 'panel' ||
      propertyName === 'overlay' ||
      propertyName === 'dialog';

    const isRectangleCtor = (node) =>
      node?.type === 'NewExpression' &&
      node.callee?.type === 'Identifier' &&
      node.callee.name === 'Rectangle';

    return {
      AssignmentExpression(node) {
        if (
          node.left?.type === 'MemberExpression' &&
          node.left.object?.type === 'ThisExpression' &&
          node.left.property?.type === 'Identifier' &&
          isShellField(node.left.property.name) &&
          isRectangleCtor(node.right)
        ) {
          context.report({ node, messageId: 'noManualShell' });
        }
      },
    };
  },
};
