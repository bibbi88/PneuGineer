const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'index.html');
const outputPath = path.join(__dirname, 'PneuGineer.html');

console.log('Starting build...');

// --- Dependency-aware bundler ---

const processedFiles = new Set(); // Tracks processed files to avoid duplicates/circular refs
const bundledScripts = [];      // Holds the final, ordered script content

// Recursively processes a file and its dependencies.
// It ensures that dependencies are added to the bundle *before* the file that needs them.
function bundleFile(filePath) {
    const absolutePath = path.resolve(filePath);
    if (processedFiles.has(absolutePath)) {
        return; // Already handled
    }

    console.log(`- Processing ${path.basename(absolutePath)}`);

    let content;
    try {
        content = fs.readFileSync(absolutePath, 'utf8');
    } catch (err) {
        console.error(`Error reading file: ${absolutePath}`, err);
        return;
    }

    // Find all 'import ... from "./dependency.js"' statements
    const importRegex = /import\s+.*\s+from\s+['"](\.\/.*?)['"]/g;
    const dependencies = [...content.matchAll(importRegex)].map(match => match[1]);

    // --- CRITICAL STEP ---
    // Recursively bundle all dependencies BEFORE processing this file's content.
    // This ensures the correct loading order.
    for (const depPath of dependencies) {
        const dependencyAbsolutePath = path.resolve(path.dirname(absolutePath), depPath);
        bundleFile(dependencyAbsolutePath);
    }

    // Now that all dependencies are in the bundle, process and add the current file's content.
    const processedContent = content
        .replace(/^import.*from.*$/gm, '') // Remove all import lines
        .replace(/^export default function/gm, 'function') // More robust replacement
        .replace(/^export function/gm, 'function');      // More robust replacement

    // Add a header to identify the original file in the bundle
    bundledScripts.push(`// --- Original file: ${path.basename(absolutePath)} ---\n${processedContent.trim()}`);
    
    // Mark this file as processed
    processedFiles.add(absolutePath);
}


// --- Main build process ---

fs.readFile(indexPath, 'utf8', (err, html) => {
    if (err) {
        return console.error(`Error reading ${indexPath}:`, err);
    }

    // Find the main entry script (main.js)
    const mainScriptRegex = /<script[^>]*src="(?:\.\/)?(js\/main\.js)"[^>]*><\/script>/;
    const mainScriptMatch = html.match(mainScriptRegex);

    if (!mainScriptMatch) {
        return console.error('Could not find main.js script tag in index.html');
    }

    const mainScriptPath = path.join(__dirname, mainScriptMatch[1]);

    // Start the recursive bundling from the main entry point
    bundleFile(mainScriptPath);

    // Create the final HTML
    // Remove all original script tags pointing to the js/ directory
    const finalHtml = html.replace(/<script[^>]*src="(?:\.\/)?js\/[^"]*"[^>]*><\/script>/g, '');
    const insertionPoint = finalHtml.lastIndexOf('</body>');

    if (insertionPoint === -1) {
        return console.error('Could not find closing </body> tag.');
    }

    // Inject the single, combined script block before the closing body tag
    const finalContent =
        finalHtml.slice(0, insertionPoint) +
        '<script>\n' +
        '// --- Bundled Scripts ---\n\n' +
        bundledScripts.join('\n\n// --- End of File ---\n\n') +
        '\n\n// --- End of Bundle ---\n' +
        '</script>\n' +
        finalHtml.slice(insertionPoint);

    // Write the final bundled file
    fs.writeFile(outputPath, finalContent, 'utf8', (err) => {
        if (err) {
            return console.error(`Error writing to ${outputPath}:`, err);
        }
        console.log(`\nBuild successful! Project bundled into ${outputPath}`);
    });
});
