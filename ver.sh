echo "=== CAMPOS DEL PLUGIN ==="
grep -rn "albumId\|artwork\|thumbnail\|albumArt" node_modules/@odion-cloud/capacitor-mediastore/dist/esm/definitions.d.ts 2>/dev/null | head -20
echo "=== TU ESCANEAR ==="
grep -n "async function escanear" app.js
grep -n "native:true" app.js
grep -n "bgArt" app.js
