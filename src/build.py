import pathlib, sys, shutil, json
d = pathlib.Path(__file__).parent
html = (d / "index.src.html").read_text(encoding="utf-8")
html = html.replace("/*__CONTENT__*/", (d / "content.js").read_text(encoding="utf-8"))
html = html.replace("/*__AVATAR__*/", (d / "avatar.js").read_text(encoding="utf-8"))
html = html.replace("/*__APP__*/", (d / "app.js").read_text(encoding="utf-8"))
# versione per l'artifact di Claude
(d / "index.html").write_text(html.replace("<!--__PWA_HEAD__-->", "").replace("<!--__PWA_BODY__-->", ""), encoding="utf-8")
print("ok", len(html))
# versione installabile (PWA) per GitHub Pages
if "--pwa" in sys.argv:
    out = d / "dist"; out.mkdir(exist_ok=True)
    head = """<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#6E56CF">
<meta name="description" content="Incanto Parolum: la scuola di magia delle parole. 10 minuti al giorno di grammatica italiana.">
<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Incanto Parolum">
<meta name="apple-mobile-web-app-status-bar-style" content="default">"""
    body = """<script>
// funziona anche senza internet e chiede al browser di non cancellare i progressi
if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
</script>"""
    (out / "index.html").write_text(html.replace("<!--__PWA_HEAD__-->", head).replace("<!--__PWA_BODY__-->", body), encoding="utf-8")
    for f in ["manifest.webmanifest", "sw.js"]:
        shutil.copy(d / "pwa" / f, out / f)
    shutil.copytree(d / "pwa" / "icons", out / "icons", dirs_exist_ok=True)
    (out / ".nojekyll").write_text("")
    print("pwa ok")
