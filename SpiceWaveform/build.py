"""Bundle the local viewer into one offline HTML file, including its license."""

from pathlib import Path
import re


root = Path(__file__).resolve().parent
html = (root / "index.html").read_text(encoding="utf-8")
css = (root / "styles.css").read_text(encoding="utf-8")
license_text = (root / "Plotly-LICENSE.txt").read_text(encoding="utf-8")

html = html.replace(
    "<!doctype html>",
    "<!doctype html>\n<!-- Plotly.js 4.1.1 license and copyright notice\n"
    + license_text
    + "-->\n",
    1,
)
html = html.replace('<link rel="stylesheet" href="styles.css">', "<style>\n" + css + "\n</style>")
html = re.sub(r'\s*<script defer src="[^"]+"></script>', "", html)

scripts = []
for filename in ("plotly.min.js", "raw.js", "demo-data.js", "app.js"):
    source = (root / filename).read_text(encoding="utf-8")
    source = re.sub(r"</script", r"<\\/script", source, flags=re.IGNORECASE)
    scripts.append("<script>\n" + source + "\n</script>")
html = html.replace("</body>", "\n".join(scripts) + "\n</body>", 1)

output = root / "SpiceWaveform.html"
output.write_text(html, encoding="utf-8")
print(output)
