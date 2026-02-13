function isTargetUIFile(path) {
  return path.includes('/src/babylon/ui/') && /(?:Panel|Dialog|Popup|Toolbar|UI|Screen|Manual)\.ts$/.test(path);
}

function isExempt(path) {
  return path.endsWith('/src/babylon/ui/UITheme.ts') ||
    path.endsWith('/src/babylon/ui/PopupUtils.ts') ||
    path.endsWith('/src/babylon/ui/LayoutUtils.ts') ||
    path.endsWith('/src/babylon/ui/DialogBlueprint.ts');
}

function isButtonLikeTarget(node) {
  if (node?.type !== 'MemberExpression') return false;
  const target = node.object;
  if (target?.type === 'Identifier') {
    const name = target.name.toLowerCase();
    return name.includes('btn') || name.includes('button');
  }
  if (target?.type === 'MemberExpression' && target.property?.type === 'Identifier') {
    const name = target.property.name.toLowerCase();
    return name.includes('btn') || name.includes('button');
  }
  return false;
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow hardcoded button cornerRadius literals in UI files',
      category: 'Best Practices',
    },
    schema: [],
    messages: {
      noHardcodedRadius: 'Do not hardcode button cornerRadius in UI files. Use UI_THEME radius tokens or shared helper defaults.',
    },
  },
  create(context) {
    const sourcePath = context.getFilename().replaceAll('\\\\', '/');
    if (!isTargetUIFile(sourcePath) || isExempt(sourcePath)) return {};

    return {
      AssignmentExpression(node) {
        if (
          node.left?.type === 'MemberExpression' &&
          node.left.property?.type === 'Identifier' &&
          node.left.property.name === 'cornerRadius' &&
          node.right?.type === 'Literal' &&
          typeof node.right.value === 'number' &&
          isButtonLikeTarget(node.left)
        ) {
          context.report({ node, messageId: 'noHardcodedRadius' });
        }
      },
    };
  },
};
