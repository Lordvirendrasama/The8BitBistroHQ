const { execSync } = require('child_process');

function runCmd(cmd) {
  try {
    return execSync(cmd, { stdio: 'inherit' });
  } catch (error) {
    console.error(`Command failed: ${cmd}`);
    throw error;
  }
}

try {
  console.log('=== STARTING BISTRO SYNC ===');

  // 1. Check for uncommitted changes
  console.log('Checking for local changes...');
  const statusOutput = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
  const hasLocalChanges = statusOutput.length > 0;

  let stashed = false;
  if (hasLocalChanges) {
    console.log('Local changes detected. Stashing local changes...');
    runCmd('git stash');
    stashed = true;
  } else {
    console.log('No local changes detected.');
  }

  // 2. Fetch origin main
  console.log('Fetching latest commits from GitHub...');
  runCmd('git fetch origin main');

  // 3. Pull latest commits
  console.log('Pulling latest updates...');
  runCmd('git pull origin main');

  // 4. Pop stash if we stashed
  if (stashed) {
    console.log('Re-applying local changes (popping stash)...');
    try {
      execSync('git stash pop', { stdio: 'inherit' });
      console.log('Local changes re-applied successfully.');
    } catch (popError) {
      console.warn('\n[WARNING] Conflicts occurred when re-applying local changes.');
      console.warn('Please resolve any conflict markers in your files.\n');
    }
  }

  // 5. Run npm install to ensure package dependencies are up to date
  console.log('Checking and updating npm packages...');
  runCmd('npm install');

  console.log('=== SYNC COMPLETED SUCCESSFULLY ===');
} catch (error) {
  console.error('\n[ERROR] Sync failed:', error.message);
  process.exit(1);
}
