const { execSync } = require('child_process');
const fs = require('fs');

// Ensure Git is in PATH if installed in user directory
if (process.platform === 'win32') {
  const userGitPath = 'C:\\Users\\Viren\\AppData\\Local\\Programs\\Git\\cmd';
  if (!process.env.PATH.includes(userGitPath) && fs.existsSync(userGitPath)) {
    process.env.PATH = `${userGitPath};${process.env.PATH}`;
  }
}

function runCmd(cmd, options = {}) {
  try {
    return execSync(cmd, { stdio: 'inherit', ...options });
  } catch (error) {
    console.error(`Command failed: ${cmd}`);
    throw error;
  }
}

function hasGit() {
  try {
    execSync('git --version', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

try {
  console.log('=== STARTING BISTRO PUSH ===');

  if (!hasGit()) {
    console.error('[ERROR] Git is not installed or not found in PATH.');
    console.error('Please install Git for Windows (https://git-scm.com/downloads) to use git push.');
    process.exit(1);
  }

  // Check if there are changes to commit
  const statusOutput = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
  if (!statusOutput) {
    console.log('No local changes to commit. Pushing any unpushed commits...');
    runCmd('git push origin main');
    console.log('=== PUSH COMPLETED SUCCESSFULLY ===');
    process.exit(0);
  }

  // Get commit message from args or generate default
  const args = process.argv.slice(2);
  const customMessage = args.join(' ').trim();
  const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const commitMessage = customMessage || `Update: ${dateStr}`;

  console.log('Staging changes...');
  runCmd('git add .');

  console.log(`Committing: "${commitMessage}"...`);
  runCmd(`git commit -m "${commitMessage}"`);

  console.log('Pushing to GitHub origin main...');
  runCmd('git push origin main');

  console.log('=== PUSH COMPLETED SUCCESSFULLY ===');
  console.log('If Vercel GitHub integration is connected, your site is now deploying automatically!');
} catch (error) {
  console.error('\n[ERROR] Push failed:', error.message);
  process.exit(1);
}
