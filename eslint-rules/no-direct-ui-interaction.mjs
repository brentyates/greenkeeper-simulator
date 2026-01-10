export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow direct UI interactions in E2E tests - use window.game.* API instead',
      category: 'Best Practices',
    },
    messages: {
      noClick: 'Use window.game.* API instead of page.click(). See CLAUDE.md for available methods.',
      noMouse: 'Use window.game.* API instead of page.mouse.*. See CLAUDE.md for available methods.',
      noKeyboard: 'Use window.game.* API instead of page.keyboard.*. See CLAUDE.md for available methods.',
      noLocator: 'Use window.game.* API instead of page.locator(). See CLAUDE.md for available methods.',
      noGetBy: 'Use window.game.* API instead of getByRole/getByText. See CLAUDE.md for available methods.',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type === 'MemberExpression') {
          const obj = node.callee.object;
          const prop = node.callee.property;

          // Check for page.click()
          if (obj.name === 'page' && prop.name === 'click') {
            context.report({ node, messageId: 'noClick' });
          }

          // Check for page.mouse.*
          if (obj.type === 'MemberExpression' &&
              obj.object.name === 'page' &&
              obj.property.name === 'mouse') {
            context.report({ node, messageId: 'noMouse' });
          }

          // Check for page.keyboard.*
          if (obj.type === 'MemberExpression' &&
              obj.object.name === 'page' &&
              obj.property.name === 'keyboard') {
            context.report({ node, messageId: 'noKeyboard' });
          }

          // Check for page.locator()
          if (obj.name === 'page' && prop.name === 'locator') {
            context.report({ node, messageId: 'noLocator' });
          }

          // Check for page.getByRole() or page.getByText()
          if (obj.name === 'page' && (prop.name === 'getByRole' || prop.name === 'getByText')) {
            context.report({ node, messageId: 'noGetBy' });
          }
        }
      },
    };
  },
};
