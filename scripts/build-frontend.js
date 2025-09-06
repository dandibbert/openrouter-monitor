const fs = require('fs');
const path = require('path');

// Simple build script to copy frontend files to public directory
const frontendDir = path.join(__dirname, '../src/frontend');
const publicDir = path.join(__dirname, '../public');

// Ensure public directory exists
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Copy HTML, CSS, and JS files
const files = ['index.html', 'style.css', 'script.js'];

files.forEach(file => {
  const srcPath = path.join(frontendDir, file);
  const destPath = path.join(publicDir, file);
  
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied ${file} to public directory`);
  } else {
    console.warn(`Warning: ${file} not found in frontend directory`);
  }
});

console.log('Frontend build complete!');
