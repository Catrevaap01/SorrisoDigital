const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '..', 'node_modules', '@expo', 'metro-config', 'build', 'serializer', 'exportHermes.js');

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, 'utf8');
  const faultyLine = "const hermesCompilerRoot = path_1.default.dirname((0, resolve_from_1.default)(reactNativeRoot, 'hermes-compiler/package.json'));";
  
  if (content.includes(faultyLine)) {
    const safeReplacement = `let hermesCompilerRoot = '';
    try {
        const resolved = resolve_from_1.default.silent(reactNativeRoot, 'hermes-compiler/package.json');
        if (resolved) hermesCompilerRoot = path_1.default.dirname(resolved);
    } catch { }`;
    
    content = content.replace(faultyLine, safeReplacement);
    
    // Also ensure hermescPath check checks existence safely
    content = content.replace(
      "if (fs_1.default.existsSync(hermescPath))",
      "if (hermescPath && fs_1.default.existsSync(hermescPath))"
    );
    
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('✅ [patch-hermes] Patched @expo/metro-config for safe Hermes compiler resolution.');
  } else {
    console.log('ℹ️ [patch-hermes] @expo/metro-config is already patched or does not require patching.');
  }
} else {
  console.log('ℹ️ [patch-hermes] @expo/metro-config not found in node_modules.');
}
