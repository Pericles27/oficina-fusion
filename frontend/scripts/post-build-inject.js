/**
 * Post-build script: injects the anti-flash theme script into exported HTML files.
 * Next.js with output: 'export' drops inline scripts from metadata.scripts,
 * so we inject them manually into the generated HTML.
 */
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'out');
const themeScript = '(function(){var a=localStorage.getItem("of-theme"),b=a==="dark"||a==="light"?a:"system";if(b==="system"){var c=window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.dataset.theme=c?"dark":"light"}else document.documentElement.dataset.theme=b})()';

function processHtml(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const headTag = '<head>';
  const scriptTag = '<script>' + themeScript + '</script>';
  if (!content.includes('of-theme') && content.includes(headTag)) {
    content = content.replace(headTag, headTag + scriptTag);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Injected anti-flash script into ' + filePath);
  }
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walk(filePath);
    } else if (file === 'index.html' || file.endsWith('.html')) {
      processHtml(filePath);
    }
  }
}

if (fs.existsSync(outDir)) {
  walk(outDir);
} else {
  console.error('out/ directory not found. Run `next build` first.');
  process.exit(1);
}
