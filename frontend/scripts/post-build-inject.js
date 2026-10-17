// Next emite CSS antes del head de layout. Sólo reubicar su nodo, sin generarlo.
const fs = require('fs');
const path = require('path');

const nodePattern = /<script\b[^>]*\bid=["']of-theme-init["'][^>]*>[\s\S]*?<\/script\s*>/gi;

function relocate(content) {
  const nodes = [...content.matchAll(nodePattern)];
  if (nodes.length !== 1) throw new Error(`Expected one initializer, found ${nodes.length}`);
  const node = nodes[0];
  const head = /<head\b[^>]*>([\s\S]*?)<\/head\s*>/i.exec(content);
  if (!head || node.index < head.index || node.index + node[0].length > head.index + head[0].length) {
    throw new Error('Initializer must be inside head');
  }
  const styles = [...head[0].matchAll(/<style\b[^>]*>|<link\b[^>]*>/gi)]
    .filter((match) => /^<style\b/i.test(match[0]) || /\brel\s*=\s*["']stylesheet["']/i.test(match[0]));
  if (!styles.length) throw new Error('No stylesheet inside head');
  const cssIndex = head.index + styles[0].index;
  if (node.index < cssIndex) return content;
  const result = content.slice(0, cssIndex) + node[0] + content.slice(cssIndex, node.index)
    + content.slice(node.index + node[0].length);
  const moved = [...result.matchAll(nodePattern)];
  if (moved.length !== 1 || !Buffer.from(moved[0][0]).equals(Buffer.from(node[0]))) {
    throw new Error('Initializer bytes changed during relocation');
  }
  return result;
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const file = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(file) : entry.isFile() && entry.name.endsWith('.html') ? [file] : [];
    });
}

function processExport(outDir) {
  if (!fs.existsSync(outDir)) throw new Error('out/ directory not found');
  const files = walk(outDir);
  if (!files.length) throw new Error('No HTML files in export');
  // Validar todos antes de escribir: un HTML inválido no deja un export parcial.
  const changes = files.map((file) => {
    const before = fs.readFileSync(file, 'utf8');
    try {
      return { file, before, after: relocate(before) };
    } catch (error) {
      throw new Error(`${file}: ${error.message}`);
    }
  });
  for (const { file, before, after } of changes) {
    if (before !== after) fs.writeFileSync(file, after, 'utf8');
  }
  console.log(`Verified initializer order in ${files.length} HTML files`);
}

if (require.main === module) {
  try {
    processExport(process.argv[2] || path.join(__dirname, '..', 'out'));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { relocate, processExport };
