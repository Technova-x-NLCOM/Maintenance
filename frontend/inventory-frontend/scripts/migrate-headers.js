#!/usr/bin/env node

/**
 * Header Migration Script
 * Automatically updates existing page headers to use optimized spacing
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Configuration
const COMPONENTS_DIR = 'src/app/components';
const BACKUP_DIR = 'header-migration-backup';

// Header patterns to find and replace
const HEADER_PATTERNS = [
  {
    // Standard page header
    find: /<header class="page-header">/g,
    replace: '<header class="page-header header-condensed">'
  },
  {
    // Page header with existing classes
    find: /<header class="page-header ([^"]*)">/g,
    replace: '<header class="page-header header-condensed $1">'
  },
  {
    // Div-based page headers
    find: /<div class="page-header">/g,
    replace: '<div class="page-header header-condensed">'
  }
];

// CSS patterns for SCSS files
const CSS_PATTERNS = [
  {
    // Reduce title font sizes
    find: /font-size:\s*1\.5rem/g,
    replace: 'font-size: 1.25rem'
  },
  {
    // Reduce subtitle font sizes
    find: /font-size:\s*0\.9375rem/g,
    replace: 'font-size: 0.875rem'
  },
  {
    // Reduce header padding
    find: /padding:\s*24px/g,
    replace: 'padding: 16px'
  },
  {
    // Reduce margin bottom
    find: /margin-bottom:\s*24px/g,
    replace: 'margin-bottom: 20px'
  }
];

function createBackup() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  console.log(`✅ Created backup directory: ${BACKUP_DIR}`);
}

function backupFile(filePath) {
  const backupPath = path.join(BACKUP_DIR, filePath);
  const backupDir = path.dirname(backupPath);
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  fs.copyFileSync(filePath, backupPath);
}

function processHTMLFile(filePath) {
  console.log(`Processing HTML: ${filePath}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Apply HTML patterns
  HEADER_PATTERNS.forEach(pattern => {
    if (pattern.find.test(content)) {
      content = content.replace(pattern.find, pattern.replace);
      modified = true;
    }
  });
  
  if (modified) {
    backupFile(filePath);
    fs.writeFileSync(filePath, content);
    console.log(`  ✅ Updated ${filePath}`);
  } else {
    console.log(`  ⏭️  No changes needed for ${filePath}`);
  }
  
  return modified;
}

function processSCSSFile(filePath) {
  console.log(`Processing SCSS: ${filePath}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Apply CSS patterns
  CSS_PATTERNS.forEach(pattern => {
    if (pattern.find.test(content)) {
      content = content.replace(pattern.find, pattern.replace);
      modified = true;
    }
  });
  
  if (modified) {
    backupFile(filePath);
    fs.writeFileSync(filePath, content);
    console.log(`  ✅ Updated ${filePath}`);
  } else {
    console.log(`  ⏭️  No changes needed for ${filePath}`);
  }
  
  return modified;
}

function generateReport(htmlFiles, scssFiles, modifiedHTML, modifiedSCSS) {
  const report = `
# Header Migration Report

## Summary
- HTML files processed: ${htmlFiles.length}
- SCSS files processed: ${scssFiles.length}
- HTML files modified: ${modifiedHTML}
- SCSS files modified: ${modifiedSCSS}

## Space Savings
- Estimated vertical space saved per page: 30-40px
- Total pages optimized: ${modifiedHTML}
- Cumulative space savings: ${modifiedHTML * 35}px average

## Next Steps
1. Test all modified components
2. Verify responsive behavior
3. Check accessibility compliance
4. Consider migrating to PageHeaderComponent for full benefits

## Rollback
If needed, restore files from: ${BACKUP_DIR}/
`;

  fs.writeFileSync('header-migration-report.md', report);
  console.log('\n📊 Migration report saved to: header-migration-report.md');
}

function main() {
  console.log('🚀 Starting header migration...\n');
  
  createBackup();
  
  // Find all HTML and SCSS files
  const htmlFiles = glob.sync(`${COMPONENTS_DIR}/**/*.html`);
  const scssFiles = glob.sync(`${COMPONENTS_DIR}/**/*.scss`);
  
  console.log(`Found ${htmlFiles.length} HTML files and ${scssFiles.length} SCSS files\n`);
  
  let modifiedHTML = 0;
  let modifiedSCSS = 0;
  
  // Process HTML files
  console.log('📄 Processing HTML files...');
  htmlFiles.forEach(file => {
    if (processHTMLFile(file)) {
      modifiedHTML++;
    }
  });
  
  console.log('\n🎨 Processing SCSS files...');
  scssFiles.forEach(file => {
    if (processSCSSFile(file)) {
      modifiedSCSS++;
    }
  });
  
  console.log('\n✨ Migration completed!');
  console.log(`Modified ${modifiedHTML} HTML files and ${modifiedSCSS} SCSS files`);
  
  generateReport(htmlFiles, scssFiles, modifiedHTML, modifiedSCSS);
  
  console.log('\n🔧 Recommended next steps:');
  console.log('1. Run: ng serve (to test changes)');
  console.log('2. Import PageHeaderComponent in modules for full optimization');
  console.log('3. Replace headers with <app-page-header> for tooltip/collapsible features');
}

// Run the migration
if (require.main === module) {
  main();
}

module.exports = { processHTMLFile, processSCSSFile };