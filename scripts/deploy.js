const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  const pkgPath = path.join(__dirname, '../package.json');
  const verPath = path.join(__dirname, '../src/lib/version.ts');

  // 1. Read package.json
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const currentVersion = pkg.version;

  // 2. Increment patch version
  const parts = currentVersion.split('.').map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    parts[2] += 1;
  } else {
    throw new Error(`Invalid version format in package.json: ${currentVersion}`);
  }
  const newVersion = parts.join('.');

  console.log(`Bumping version: ${currentVersion} -> ${newVersion}`);

  // 3. Write package.json
  pkg.version = newVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  // 4. Write src/lib/version.ts
  const versionFileContent = `export const APP_VERSION = '${newVersion}';\n`;
  fs.writeFileSync(verPath, versionFileContent);

  console.log('Successfully updated version files.');

  // 5. Git actions
  console.log('Staging changes with git...');
  execSync('git add .', { stdio: 'inherit' });

  const commitMessage = `Build v${newVersion}`;
  console.log(`Committing: "${commitMessage}"...`);
  execSync(`git commit -m "${commitMessage}" --allow-empty`, { stdio: 'inherit' });

  console.log('Pushing to GitHub origin main...');
  execSync('git push origin main', { stdio: 'inherit' });

  console.log('Deploy script successfully finished push to GitHub.');
} catch (error) {
  console.error('Deployment failed:', error.message);
  process.exit(1);
}
