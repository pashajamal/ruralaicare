import fs from "fs";
import path from "path";

const publicDir = path.resolve(".output/public");
const assetsDir = path.join(publicDir, "assets");

if (!fs.existsSync(publicDir)) {
  console.error(".output/public directory does not exist. Run npm run build first.");
  process.exit(1);
}

// 1. Create .nojekyll to prevent GitHub Pages from ignoring files starting with _
fs.writeFileSync(path.join(publicDir, ".nojekyll"), "");

// 2. Find the client entry JS and CSS files
const files = fs.readdirSync(assetsDir);
const mainJs = files.find((f) => f.startsWith("index-") && f.endsWith(".js")) || files.find((f) => f.endsWith(".js"));
const mainCss = files.find((f) => f.endsWith(".css"));

console.log("Client assets detected:", { mainJs, mainCss });

// 3. Create index.html SPA template
const htmlContent = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Virtual Clinic</title>
    <meta name="description" content="AI-assisted patient triage for rural health workers" />
    <link rel="icon" type="image/png" href="./favicon.png" />
    ${mainCss ? `<link rel="stylesheet" href="./assets/${mainCss}" />` : ""}
  </head>
  <body>
    <div id="root"></div>
    ${mainJs ? `<script type="module" src="./assets/${mainJs}"></script>` : ""}
  </body>
</html>
`;

fs.writeFileSync(path.join(publicDir, "index.html"), htmlContent);
fs.writeFileSync(path.join(publicDir, "404.html"), htmlContent);

console.log("✅ index.html, 404.html, and .nojekyll generated in .output/public");
