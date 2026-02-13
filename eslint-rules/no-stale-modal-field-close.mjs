function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const value of Object.values(node)) {
    if (!value) continue;
    if (Array.isArray(value)) {
      for (const item of value) walk(item, visit);
      continue;
    }
    walk(value, visit);
  }
}

function getAssignedThisField(node) {
  if (
    node?.left?.type === 'MemberExpression' &&
    node.left.object?.type === 'ThisExpression' &&
    node.left.property?.type === 'Identifier'
  ) {
    return node.left.property.name;
  }
  return null;
}

function isDialogCtor(node) {
  return (
    node?.type === 'NewExpression' &&
    node.callee?.type === 'Identifier' &&
    node.callee.name.endsWith('Dialog')
  );
}

function getCallbacksArg(node) {
  if (!isDialogCtor(node)) return null;
  const callbackArg = node.arguments?.[1];
  return callbackArg?.type === 'ObjectExpression' ? callbackArg : null;
}

function getCallee(node) {
  if (node?.type === 'ChainExpression') {
    return node.expression?.callee ?? null;
  }
  return node?.callee ?? null;
}

function isFieldDisposeCall(node, fieldName) {
  if (node?.type !== 'CallExpression' && node?.type !== 'ChainExpression') return false;
  const callee = getCallee(node);
  if (
    callee?.type !== 'MemberExpression' ||
    callee.property?.type !== 'Identifier' ||
    callee.property.name !== 'dispose'
  ) {
    return false;
  }
  const target = callee.object;
  return (
    target?.type === 'MemberExpression' &&
    target.object?.type === 'ThisExpression' &&
    target.property?.type === 'Identifier' &&
    target.property.name === fieldName
  );
}

function isFieldNullAssign(node, fieldName) {
  if (node?.type !== 'AssignmentExpression') return false;
  if (node.right?.type !== 'Literal' || node.right.value !== null) return false;
  return getAssignedThisField(node) === fieldName;
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow closing dialog instances via mutable field references inside constructor callbacks',
      category: 'Best Practices',
    },
    schema: [],
    messages: {
      noStaleFieldClose:
        'Do not close dialog instances via `this.{{field}}` inside callbacks passed to `new ...Dialog(...)`. Use a local instance-scoped close function.',
    },
  },
  create(context) {
    return {
      AssignmentExpression(node) {
        const fieldName = getAssignedThisField(node);
        if (!fieldName || !isDialogCtor(node.right)) return;

        const callbacks = getCallbacksArg(node.right);
        if (!callbacks) return;

        for (const prop of callbacks.properties) {
          if (prop?.type !== 'Property') continue;
          const value = prop.value;
          const isFn =
            value?.type === 'ArrowFunctionExpression' ||
            value?.type === 'FunctionExpression';
          if (!isFn) continue;

          let violationNode = null;
          walk(value.body, (inner) => {
            if (violationNode) return;
            if (isFieldDisposeCall(inner, fieldName) || isFieldNullAssign(inner, fieldName)) {
              violationNode = inner;
            }
          });

          if (violationNode) {
            context.report({
              node: violationNode,
              messageId: 'noStaleFieldClose',
              data: { field: fieldName },
            });
          }
        }
      },
    };
  },
};
