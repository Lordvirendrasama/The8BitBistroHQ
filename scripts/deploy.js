const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Ensure Git is in PATH if installed in user directory
if (process.platform === 'win32') {
  const userGitPath = 'C:\\Users\\Viren\\AppData\\Local\\Programs\\Git\\cmd';
  if (!process.env.PATH.includes(userGitPath) && fs.existsSync(userGitPath)) {
    process.env.PATH = `${userGitPath};${process.env.PATH}`;
  }
}

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
  const versionFileContent = `export const BASE_VERSION = '${newVersion}';
export const ALPHA_CHANGES_COUNT = 0;

export const IS_ALPHA =
  typeof window !== 'undefined'
    ? window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      process.env.NODE_ENV === 'development'
    : process.env.NODE_ENV === 'development';

export const APP_VERSION = IS_ALPHA
  ? \`\${BASE_VERSION} (a\${ALPHA_CHANGES_COUNT})\`
  : BASE_VERSION;
`;
  fs.writeFileSync(verPath, versionFileContent);

  console.log('Successfully updated version files.');

  // 5. Git actions
  const hasGit = () => {
    try {
      execSync('git --version', { stdio: 'ignore' });
      return true;
    } catch (e) {
      return false;
    }
  };

  if (hasGit()) {
    console.log('Staging changes with git...');
    execSync('git add .', { stdio: 'inherit' });

    const commitMessage = `Build v${newVersion}`;
    console.log(`Committing: "${commitMessage}"...`);
    execSync(`git commit -m "${commitMessage}" --allow-empty`, { stdio: 'inherit' });

    console.log('Pushing to GitHub origin main...');
    execSync('git push origin main', { stdio: 'inherit' });

    console.log('Deploy script successfully finished push to GitHub.');
  } else {
    console.warn("WARNING: 'git' command not found in PATH. Skipping git staging, commit, and push.");
  }
} catch (error) {
  console.error('Deployment failed:', error.message);
  process.exit(1);
}
