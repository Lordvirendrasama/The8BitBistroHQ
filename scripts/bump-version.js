const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '../package.json');
const verPath = path.join(__dirname, '../src/lib/version.ts');

// 1. Read package.json
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const currentVersion = pkg.version;

// 2. Increment patch version
const parts = currentVersion.split('.').map(Number);
parts[2] += 1;
const newVersion = parts.join('.');

console.log(`Bumping version: ${currentVersion} -> ${newVersion}`);

// 3. Write package.json
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// 4. Write src/lib/version.ts
const versionFileContent = `export const APP_VERSION = '${newVersion}';\n`;
fs.writeFileSync(verPath, versionFileContent);

console.log('Successfully updated version files.');
