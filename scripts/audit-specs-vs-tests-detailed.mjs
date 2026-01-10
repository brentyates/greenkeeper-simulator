#!/usr/bin/env node
/**
 * Detailed Spec vs Tests Audit
 *
 * Shows exactly which test files cover which spec features.
 * More strict matching to avoid false positives.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Parse spec document
function parseSpecDocument(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);

  const features = [];

  // Extract ## and ### headings
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(#{2,3})\s+(.+)$/);

    if (match) {
      const level = match[1].length;
      const heading = match[2].trim();

      // Skip structural headings
      if (['Overview', 'Core Philosophy', 'Summary', 'References', 'Table of Contents'].includes(heading)) {
        continue;
      }

      features.push({
        level,
        heading,
        lineNumber: i + 1
      });
    }
  }

  return {
    fileName,
    specName: fileName.replace('.md', ''),
    features
  };
}

// Parse test files
function parseTestFiles() {
  const testFiles = new Map();
  const testDir = path.join(rootDir, 'src/core');

  const files = fs.readdirSync(testDir).filter(f => f.endsWith('.test.ts'));

  files.forEach(file => {
    const filePath = path.join(testDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    const testMatches = content.match(/^\s*(test|it)\(/gm);
    const testCount = testMatches ? testMatches.length : 0;

    const describeMatches = content.matchAll(/describe\(['"]([^'"]+)['"]/g);
    const features = Array.from(describeMatches, m => m[1]);

    testFiles.set(file, {
      file,
      testCount,
      features,
      sourceFile: file.replace('.test.ts', '.ts')
    });
  });

  return testFiles;
}

// Map specs to test files manually
const SPEC_TO_TEST_MAPPING = {
  'COURSE_MAINTENANCE_SPEC': {
    testFiles: ['terrain.test.ts', 'grass-simulation.test.ts', 'irrigation.test.ts'],
    implemented: true
  },
  'ECONOMY_SYSTEM_SPEC': {
    testFiles: ['economy.test.ts'],
    implemented: true
  },
  'EMPLOYEE_SYSTEM_SPEC': {
    testFiles: ['employees.test.ts', 'employee-work.test.ts'],
    implemented: true
  },
  'EQUIPMENT_SYSTEM_SPEC': {
    testFiles: ['equipment-logic.test.ts', 'equipment-selection.test.ts'],
    implemented: true
  },
  'PRESTIGE_SYSTEM_SPEC': {
    testFiles: ['prestige.test.ts', 'reputation.test.ts', 'prestige-hiring.test.ts'],
    implemented: true
  },
  'RESEARCH_TREE_SPEC': {
    testFiles: ['research.test.ts'],
    implemented: true
  },
  'TEE_TIME_SYSTEM_SPEC': {
    testFiles: ['tee-times.test.ts', 'advanced-tee-time.test.ts', 'walk-ons.test.ts', 'tee-revenue.test.ts', 'marketing.test.ts'],
    implemented: true
  },
  'PLACEABLE_ASSETS_SPEC': {
    testFiles: ['terrain-editor-logic.test.ts', 'amenities.test.ts'],
    implemented: 'partial'
  },
  'TOURNAMENT_SYSTEM_SPEC': {
    testFiles: [],
    implemented: false
  },
  'FUTURE_SYSTEMS_SPEC': {
    testFiles: ['weather.test.ts', 'irrigation.test.ts'],
    implemented: 'partial'
  }
};

// Generate report
function generateReport() {
  console.log('='.repeat(80));
  console.log('DETAILED SPEC vs TESTS AUDIT');
  console.log('='.repeat(80));
  console.log();

  const docsDir = path.join(rootDir, 'docs');
  const specs = fs.readdirSync(docsDir)
    .filter(f => f.endsWith('_SPEC.md'))
    .map(f => {
      const filePath = path.join(docsDir, f);
      return parseSpecDocument(filePath);
    });

  const testFiles = parseTestFiles();

  let totalSpecs = 0;
  let implementedSpecs = 0;
  let partialSpecs = 0;
  let unimplementedSpecs = 0;

  specs.forEach(spec => {
    totalSpecs++;
    const mapping = SPEC_TO_TEST_MAPPING[spec.specName];

    console.log(`📄 ${spec.fileName}`);
    console.log('-'.repeat(80));
    console.log(`Features documented: ${spec.features.length}`);

    if (!mapping || mapping.testFiles.length === 0) {
      if (mapping && mapping.implemented === false) {
        console.log('❌ NOT IMPLEMENTED - No test files found');
        console.log('   This is a future/planned feature.');
        unimplementedSpecs++;
      } else {
        console.log('⚠️  NO TEST FILE MAPPING - Unable to verify coverage');
        unimplementedSpecs++;
      }
    } else {
      let totalTests = 0;
      console.log();
      console.log('Test files:');
      mapping.testFiles.forEach(testFile => {
        const test = testFiles.get(testFile);
        if (test) {
          totalTests += test.testCount;
          console.log(`   ✅ ${testFile.padEnd(40)} ${test.testCount.toString().padStart(3)} tests`);

          if (test.features.length > 0) {
            console.log(`      Features tested:`);
            test.features.slice(0, 5).forEach(feature => {
              console.log(`        - ${feature}`);
            });
            if (test.features.length > 5) {
              console.log(`        ... and ${test.features.length - 5} more`);
            }
          }
        } else {
          console.log(`   ❌ ${testFile.padEnd(40)} NOT FOUND`);
        }
      });

      console.log();
      if (mapping.implemented === 'partial') {
        console.log(`⚠️  PARTIALLY IMPLEMENTED - ${totalTests} tests, but some features may be missing`);
        partialSpecs++;
      } else if (totalTests > 0) {
        console.log(`✅ FULLY IMPLEMENTED - ${totalTests} tests covering spec features`);
        implementedSpecs++;
      } else {
        console.log(`❌ NOT IMPLEMENTED - No tests found`);
        unimplementedSpecs++;
      }
    }

    console.log();
    console.log();
  });

  console.log('='.repeat(80));
  console.log('IMPLEMENTATION STATUS SUMMARY');
  console.log('='.repeat(80));
  console.log();

  specs.forEach(spec => {
    const mapping = SPEC_TO_TEST_MAPPING[spec.specName];
    let status = '❓';
    let label = 'UNKNOWN';

    if (mapping) {
      if (mapping.implemented === true) {
        status = '✅';
        label = 'IMPLEMENTED';
      } else if (mapping.implemented === 'partial') {
        status = '⚠️ ';
        label = 'PARTIAL';
      } else {
        status = '❌';
        label = 'NOT IMPLEMENTED';
      }
    }

    console.log(`${status} ${spec.fileName.padEnd(45)} ${label}`);
  });

  console.log();
  console.log('='.repeat(80));
  console.log('SUMMARY STATISTICS');
  console.log('='.repeat(80));
  console.log(`Total spec documents:         ${totalSpecs}`);
  console.log(`Fully implemented:            ${implementedSpecs} (${((implementedSpecs/totalSpecs)*100).toFixed(0)}%)`);
  console.log(`Partially implemented:        ${partialSpecs} (${((partialSpecs/totalSpecs)*100).toFixed(0)}%)`);
  console.log(`Not yet implemented:          ${unimplementedSpecs} (${((unimplementedSpecs/totalSpecs)*100).toFixed(0)}%)`);

  let totalTests = 0;
  testFiles.forEach(test => totalTests += test.testCount);

  console.log();
  console.log(`Total test files:             ${testFiles.size}`);
  console.log(`Total unit tests:             ${totalTests}`);

  console.log();
  console.log('='.repeat(80));
  console.log('DOCUMENTATION DRIFT ANALYSIS');
  console.log('='.repeat(80));
  console.log();

  // Find test files not mapped to any spec
  const mappedTestFiles = new Set();
  Object.values(SPEC_TO_TEST_MAPPING).forEach(mapping => {
    mapping.testFiles.forEach(f => mappedTestFiles.add(f));
  });

  const unmappedTests = [];
  testFiles.forEach((test, fileName) => {
    if (!mappedTestFiles.has(fileName)) {
      unmappedTests.push(fileName);
    }
  });

  if (unmappedTests.length > 0) {
    console.log('⚠️  TEST FILES NOT MAPPED TO ANY SPEC:');
    console.log();
    unmappedTests.forEach(fileName => {
      const test = testFiles.get(fileName);
      console.log(`   ${fileName.padEnd(40)} ${test.testCount.toString().padStart(3)} tests`);
    });
    console.log();
    console.log('These test files exist but are not documented in any spec.');
    console.log('They may be:');
    console.log('  - Supporting infrastructure (save-game, integration, etc.)');
    console.log('  - Features that were implemented without spec documentation');
    console.log('  - Sub-systems that should be added to existing specs');
  } else {
    console.log('✅ All test files are mapped to spec documents.');
  }

  console.log();
  console.log('='.repeat(80));
}

// Run the audit
generateReport();
