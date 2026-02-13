const TARGET_FILENAMES = new Set([
  'TeeSheetPanel.ts',
  'WalkOnQueuePanel.ts',
  'ResearchPanel.ts',
  'EmployeePanel.ts',
  'EquipmentStorePanel.ts',
  'AmenityPanel.ts',
  'CourseLayoutPanel.ts',
]);

const ROW_NAME_PREFIXES = [
  'row_',
  'research_',
  'emp_',
  'cand_',
  'available_',
  'owned_',
  'upgrade_',
  'courseHole_',
];

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow manual list-row Rectangle creation in migrated files.',
    },
    schema: [],
    messages: {
      manualRow:
        'Use createListRowCard(...) for list row/card containers instead of new Rectangle(...).',
    },
  },
  create(context) {
    const filename = context.getFilename().split('/').pop();
    if (!filename || !TARGET_FILENAMES.has(filename)) {
      return {};
    }

    return {
      NewExpression(node) {
        if (node.callee?.type !== 'Identifier' || node.callee.name !== 'Rectangle') {
          return;
        }
        const [firstArg] = node.arguments;
        if (!firstArg || firstArg.type !== 'TemplateLiteral') {
          return;
        }
        const raw = firstArg.quasis?.[0]?.value?.raw ?? '';
        if (ROW_NAME_PREFIXES.some((prefix) => raw.startsWith(prefix))) {
          context.report({
            node,
            messageId: 'manualRow',
          });
        }
      },
    };
  },
};
