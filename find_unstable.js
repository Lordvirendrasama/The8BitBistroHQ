const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('src', function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (line.includes('useDoc(') || line.includes('useDoc<')) {
        if (line.includes('useDoc(doc') || line.match(/useDoc<[^>]+>\(doc/)) {
            console.log(`Inline unstable doc in ${filePath}:${index + 1}`);
        }
      }
    });
  }
});
