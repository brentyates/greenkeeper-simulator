#!/usr/bin/env node
/**
 * Documentation vs Tests Audit Script
 *
 * Compares documented modules in CLAUDE.md against actual test coverage.
 * Reports drift between documentation and test implementation.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Parse CLAUDE.md for documented modules
function parseDocumentedModules() {
  const claudeMd = fs.readFileSync(path.join(rootDir, 'CLAUDE.md'), 'utf-8');
  const modules = new Map();

  // Extract Core Logic modules (lines 47-54)
  const coreLogicSection = claudeMd.match(/### Core Logic \(in `src\/core\/`\)([\s\S]*?)###/);
  if (coreLogicSection) {
    const tableLines = coreLogicSection[1].match(/\| `([^`]+)` \| ([^|]+) \|/g);
    if (tableLines) {
      tableLines.forEach(line => {
        const match = line.match(/\| `([^`]+)` \| ([^|]+) \|/);
        if (match) {
          modules.set(match[1], {
            name: match[1],
            purpose: match[2].trim(),
            category: 'Core Logic',
            documented: true
          });
        }
      });
    }
  }

  // Extract Economy & Management modules (lines 57-65)
  const economySection = claudeMd.match(/### Economy & Management Systems \(in `src\/core\/`\)([\s\S]*?)###/);
  if (economySection) {
    const tableLines = economySection[1].match(/\| `([^`]+)` \| ([^|]+) \|/g);
    if (tableLines) {
      tableLines.forEach(line => {
        const match = line.match(/\| `([^`]+)` \| ([^|]+) \|/);
        if (match) {
          modules.set(match[1], {
            name: match[1],
            purpose: match[2].trim(),
            category: 'Economy & Management',
            documented: true
          });
        }
      });
    }
  }

  // Extract documented unit tests (lines 99-104)
  const unitTestSection = claudeMd.match(/### Unit Tests \(Vitest\)([\s\S]*?)###/);
  const documentedTests = new Set();
  if (unitTestSection) {
    const testLines = unitTestSection[1].match(/- `([^`]+)` - ([^\n]+)/g);
    if (testLines) {
      testLines.forEach(line => {
        const match = line.match(/- `([^`]+)` - ([^\n]+)/);
        if (match) {
          documentedTests.add(match[1]);
        }
      });
    }
  }

  return { modules, documentedTests };
}

// Extract test files and their test counts
function analyzeTestFiles() {
  const testFiles = new Map();
  const testDir = path.join(rootDir, 'src/core');

  const files = fs.readdirSync(testDir).filter(f => f.endsWith('.test.ts'));

  files.forEach(file => {
    const filePath = path.join(testDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Count test cases
    const testMatches = content.match(/^\s*(test|it)\(/gm);
    const testCount = testMatches ? testMatches.length : 0;

    // Extract describe blocks for feature coverage
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

// Extract E2E test files
function analyzeE2ETests() {
  const e2eFiles = new Map();
  const testDir = path.join(rootDir, 'tests/integration');

  const files = fs.readdirSync(testDir).filter(f => f.endsWith('.spec.ts'));

  files.forEach(file => {
    const filePath = path.join(testDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Count test cases
    const testMatches = content.match(/^\s*test\(/gm);
    const testCount = testMatches ? testMatches.length : 0;

    // Extract describe blocks
    const describeMatches = content.matchAll(/test\.describe\(['"]([^'"]+)['"]/g);
    const features = Array.from(describeMatches, m => m[1]);

    // Extract header documentation
    const headerMatch = content.match(/\/\*\*([\s\S]*?)\*\//);
    let header = '';
    if (headerMatch) {
      header = headerMatch[1]
        .split('\n')
        .map(line => line.replace(/^\s*\*\s?/, '').trim())
        .filter(Boolean)
        .join(' ');
    }

    e2eFiles.set(file, {
      file,
      testCount,
      features,
      header
    });
  });

  return e2eFiles;
}

// Generate audit report
function generateReport() {
  console.log('='.repeat(80));
  console.log('DOCUMENTATION vs TESTS AUDIT REPORT');
  console.log('='.repeat(80));
  console.log();

  const { modules, documentedTests } = parseDocumentedModules();
  const testFiles = analyzeTestFiles();
  const e2eFiles = analyzeE2ETests();

  // Section 1: Documented modules vs test files
  console.log('1. CORE MODULES - Documentation Coverage');
  console.log('-'.repeat(80));

  modules.forEach((module, moduleName) => {
    const testFile = `${moduleName.replace('.ts', '')}.test.ts`;
    const tests = testFiles.get(testFile);

    if (tests) {
      console.log(`✅ ${moduleName.padEnd(30)} ${tests.testCount.toString().padStart(3)} tests`);
      if (tests.features.length > 0) {
        tests.features.forEach(feature => {
          console.log(`   └─ ${feature}`);
        });
      }
    } else {
      console.log(`❌ ${moduleName.padEnd(30)} NO TEST FILE FOUND`);
    }
  });

  console.log();
  console.log('2. DOCUMENTED UNIT TESTS vs ACTUAL');
  console.log('-'.repeat(80));

  // Check documented tests
  documentedTests.forEach(docTest => {
    const exists = testFiles.has(docTest);
    if (exists) {
      console.log(`✅ ${docTest.padEnd(35)} EXISTS (${testFiles.get(docTest).testCount} tests)`);
    } else {
      console.log(`❌ ${docTest.padEnd(35)} DOCUMENTED BUT NOT FOUND`);
    }
  });

  console.log();
  console.log('3. UNDOCUMENTED TEST FILES');
  console.log('-'.repeat(80));

  testFiles.forEach((test, fileName) => {
    if (!documentedTests.has(fileName)) {
      console.log(`⚠️  ${fileName.padEnd(35)} ${test.testCount.toString().padStart(3)} tests (not in docs)`);
    }
  });

  console.log();
  console.log('4. E2E TEST COVERAGE');
  console.log('-'.repeat(80));
  console.log(`Total E2E test files: ${e2eFiles.size}`);

  let totalE2ETests = 0;
  e2eFiles.forEach((test, fileName) => {
    totalE2ETests += test.testCount;
    console.log(`   ${fileName.padEnd(50)} ${test.testCount.toString().padStart(3)} tests`);
  });

  console.log();
  console.log(`   TOTAL E2E TESTS: ${totalE2ETests}`);

  console.log();
  console.log('5. SUMMARY STATISTICS');
  console.log('-'.repeat(80));

  let totalUnitTests = 0;
  testFiles.forEach(test => totalUnitTests += test.testCount);

  console.log(`Documented core modules:     ${modules.size}`);
  console.log(`Modules with test files:     ${Array.from(modules.keys()).filter(m => testFiles.has(m.replace('.ts', '') + '.test.ts')).length}`);
  console.log(`Total unit test files:       ${testFiles.size}`);
  console.log(`Total unit tests:            ${totalUnitTests}`);
  console.log(`Total E2E test files:        ${e2eFiles.size}`);
  console.log(`Total E2E tests:             ${totalE2ETests}`);
  console.log(`GRAND TOTAL TESTS:           ${totalUnitTests + totalE2ETests}`);

  console.log();
  console.log('='.repeat(80));
  console.log('DRIFT ANALYSIS');
  console.log('='.repeat(80));

  // Find modules documented but without tests
  const modulesWithoutTests = [];
  modules.forEach((module, moduleName) => {
    const testFile = `${moduleName.replace('.ts', '')}.test.ts`;
    if (!testFiles.has(testFile)) {
      modulesWithoutTests.push(moduleName);
    }
  });

  // Find test files not documented
  const undocumentedTests = [];
  testFiles.forEach((test, fileName) => {
    if (!documentedTests.has(fileName)) {
      undocumentedTests.push(fileName);
    }
  });

  if (modulesWithoutTests.length > 0) {
    console.log();
    console.log('❌ DOCUMENTED MODULES WITHOUT TEST FILES:');
    modulesWithoutTests.forEach(m => console.log(`   - ${m}`));
  }

  if (undocumentedTests.length > 0) {
    console.log();
    console.log('⚠️  TEST FILES NOT MENTIONED IN CLAUDE.md:');
    undocumentedTests.forEach(t => console.log(`   - ${t}`));
  }

  if (modulesWithoutTests.length === 0 && undocumentedTests.length === 0) {
    console.log();
    console.log('✅ NO DRIFT DETECTED! Documentation and tests are in sync.');
  }

  console.log();
  console.log('='.repeat(80));
}

// Run the audit
generateReport();
