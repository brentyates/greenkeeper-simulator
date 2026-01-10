#!/usr/bin/env node
/**
 * Spec Documentation vs Tests Audit
 *
 * Audits planning specification documents in docs/ against actual test coverage.
 * Reports which planned features have tests, and which tests don't map to specs.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Parse a spec document for features
function parseSpecDocument(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);

  const features = [];

  // Extract all ## and ### headings as features
  const headingMatches = content.matchAll(/^(#{2,3})\s+(.+)$/gm);

  for (const match of headingMatches) {
    const level = match[1].length;
    const heading = match[2].trim();

    // Skip common structural headings
    if (['Overview', 'Core Philosophy', 'Summary', 'References'].includes(heading)) {
      continue;
    }

    features.push({
      level,
      heading,
      normalized: heading.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    });
  }

  return {
    fileName,
    specName: fileName.replace('.md', ''),
    features
  };
}

// Parse all spec documents
function parseAllSpecs() {
  const docsDir = path.join(rootDir, 'docs');
  const specs = new Map();

  const files = fs.readdirSync(docsDir)
    .filter(f => f.endsWith('.md') && f.endsWith('_SPEC.md'));

  files.forEach(file => {
    const filePath = path.join(docsDir, file);
    const spec = parseSpecDocument(filePath);
    specs.set(spec.specName, spec);
  });

  return specs;
}

// Parse test files for features
function parseTestFiles() {
  const testFiles = new Map();
  const testDir = path.join(rootDir, 'src/core');

  const files = fs.readdirSync(testDir).filter(f => f.endsWith('.test.ts'));

  files.forEach(file => {
    const filePath = path.join(testDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Count tests
    const testMatches = content.match(/^\s*(test|it)\(/gm);
    const testCount = testMatches ? testMatches.length : 0;

    // Extract describe blocks
    const describeMatches = content.matchAll(/describe\(['"]([^'"]+)['"]/g);
    const features = Array.from(describeMatches, m => ({
      name: m[1],
      normalized: m[1].toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }));

    // Extract test names
    const testNameMatches = content.matchAll(/(?:test|it)\(['"]([^'"]+)['"]/g);
    const testNames = Array.from(testNameMatches, m => ({
      name: m[1],
      normalized: m[1].toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }));

    testFiles.set(file, {
      file,
      testCount,
      features,
      testNames,
      sourceFile: file.replace('.test.ts', '.ts')
    });
  });

  return testFiles;
}

// Check if a spec feature has test coverage
function findTestCoverage(specFeature, testFiles) {
  const coverage = [];
  const normalized = specFeature.normalized;
  const keywords = normalized.split(' ').filter(w => w.length > 3);

  testFiles.forEach((testFile, fileName) => {
    // Check describe blocks
    for (const feature of testFile.features) {
      const matchScore = calculateMatchScore(normalized, feature.normalized, keywords);
      if (matchScore > 0) {
        coverage.push({
          file: fileName,
          matchType: 'describe',
          matchedFeature: feature.name,
          score: matchScore
        });
      }
    }

    // Check test names
    for (const test of testFile.testNames) {
      const matchScore = calculateMatchScore(normalized, test.normalized, keywords);
      if (matchScore > 0.3) { // Lower threshold for test names
        coverage.push({
          file: fileName,
          matchType: 'test',
          matchedFeature: test.name,
          score: matchScore
        });
      }
    }
  });

  return coverage.sort((a, b) => b.score - a.score);
}

// Calculate match score between two normalized strings
function calculateMatchScore(spec, test, keywords) {
  // Exact match
  if (spec === test) return 1.0;

  // Substring match
  if (test.includes(spec) || spec.includes(test)) return 0.8;

  // Keyword matching
  let matchedKeywords = 0;
  for (const keyword of keywords) {
    if (test.includes(keyword)) {
      matchedKeywords++;
    }
  }

  if (matchedKeywords === 0) return 0;

  return (matchedKeywords / keywords.length) * 0.6;
}

// Map spec to test file by naming convention
function guessTestFile(specName) {
  const mapping = {
    'EQUIPMENT_SYSTEM_SPEC': ['equipment-logic.test.ts', 'equipment-selection.test.ts'],
    'ECONOMY_SYSTEM_SPEC': ['economy.test.ts'],
    'EMPLOYEE_SYSTEM_SPEC': ['employees.test.ts', 'employee-work.test.ts'],
    'PRESTIGE_SYSTEM_SPEC': ['prestige.test.ts', 'reputation.test.ts'],
    'RESEARCH_TREE_SPEC': ['research.test.ts'],
    'TEE_TIME_SYSTEM_SPEC': ['tee-times.test.ts', 'advanced-tee-time.test.ts'],
    'COURSE_MAINTENANCE_SPEC': ['grass-simulation.test.ts', 'terrain.test.ts', 'irrigation.test.ts'],
    'TOURNAMENT_SYSTEM_SPEC': [], // Not implemented yet
    'FUTURE_SYSTEMS_SPEC': [], // Future features
    'PLACEABLE_ASSETS_SPEC': ['terrain-editor-logic.test.ts']
  };

  return mapping[specName] || [];
}

// Generate report
function generateReport() {
  console.log('='.repeat(80));
  console.log('SPEC DOCUMENTATION vs TESTS AUDIT');
  console.log('='.repeat(80));
  console.log();

  const specs = parseAllSpecs();
  const testFiles = parseTestFiles();

  console.log('SPECIFICATION DOCUMENTS:');
  console.log('-'.repeat(80));
  Array.from(specs.keys()).forEach(specName => {
    const spec = specs.get(specName);
    console.log(`   ${spec.fileName.padEnd(40)} ${spec.features.length} features`);
  });

  console.log();
  console.log('='.repeat(80));
  console.log();

  // Analyze each spec
  specs.forEach((spec, specName) => {
    console.log(`📄 ${spec.fileName}`);
    console.log('-'.repeat(80));

    const expectedTestFiles = guessTestFile(specName);
    if (expectedTestFiles.length > 0) {
      console.log(`Expected test files: ${expectedTestFiles.join(', ')}`);

      // Count total tests in expected files
      let totalTests = 0;
      expectedTestFiles.forEach(testFile => {
        const test = testFiles.get(testFile);
        if (test) {
          totalTests += test.testCount;
        }
      });
      console.log(`Total tests in related files: ${totalTests}`);
      console.log();
    }

    // Analyze each feature
    let coveredFeatures = 0;
    let uncoveredFeatures = 0;

    spec.features.forEach(feature => {
      const coverage = findTestCoverage(feature, testFiles);

      if (coverage.length > 0) {
        const topMatch = coverage[0];
        if (topMatch.score > 0.4) {
          console.log(`   ✅ ${feature.heading}`);
          if (topMatch.score < 0.8) {
            console.log(`      └─ Partial match in ${topMatch.file}: "${topMatch.matchedFeature}"`);
          }
          coveredFeatures++;
        } else {
          console.log(`   ⚠️  ${feature.heading} (weak match)`);
          uncoveredFeatures++;
        }
      } else {
        console.log(`   ❌ ${feature.heading} (no test coverage found)`);
        uncoveredFeatures++;
      }
    });

    console.log();
    const coveragePercent = spec.features.length > 0
      ? ((coveredFeatures / spec.features.length) * 100).toFixed(0)
      : 0;
    console.log(`   Coverage: ${coveredFeatures}/${spec.features.length} (${coveragePercent}%)`);
    console.log();
    console.log();
  });

  // Overall summary
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));

  let totalSpecFeatures = 0;
  let totalCoveredFeatures = 0;

  specs.forEach(spec => {
    totalSpecFeatures += spec.features.length;
    spec.features.forEach(feature => {
      const coverage = findTestCoverage(feature, testFiles);
      if (coverage.length > 0 && coverage[0].score > 0.4) {
        totalCoveredFeatures++;
      }
    });
  });

  const overallCoverage = ((totalCoveredFeatures / totalSpecFeatures) * 100).toFixed(1);

  console.log(`Total spec documents:         ${specs.size}`);
  console.log(`Total spec features:          ${totalSpecFeatures}`);
  console.log(`Features with test coverage:  ${totalCoveredFeatures}`);
  console.log(`Overall coverage:             ${overallCoverage}%`);
  console.log();

  let totalTests = 0;
  testFiles.forEach(test => totalTests += test.testCount);
  console.log(`Total unit tests:             ${totalTests}`);
  console.log(`Total test files:             ${testFiles.size}`);

  console.log();
  console.log('='.repeat(80));
}

// Run the audit
generateReport();
