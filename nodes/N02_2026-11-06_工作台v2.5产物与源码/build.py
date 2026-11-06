# -*- coding: utf-8 -*-
"""把 src 下的分片拼成单文件 HTML"""
import io, os, sys, datetime

BASE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BASE, "src")
OUT = os.path.join(BASE, "质量管理台账工作台.html")

PARTS = {
    "@@STYLE@@":   "style.css",
    "@@SEED@@":    "seed.js",
    "@@INSPDATA@@":"inspectdata.js",
    "@@CORE@@":    "core.js",
    "@@PARSE@@":   "parse.js",
    "@@PLAN@@":    "plan.js",
    "@@INBOX@@":   "inbox.js",
    "@@MODULES@@": "modules.js",
    "@@FILES@@":   "files.js",
    "@@INSPATTACH@@":"inspattach.js",
    "@@REVIEWATTACH@@":"reviewattach.js",
    "@@SPACE@@":   "workspace.js",
    "@@QDIR@@":    "qdirs.js",
    "@@IMGVIEW@@": "imgview.js",
    "@@FOLDER@@":  "folder.js",
    "@@DOCGEN@@":  "docgen.js",
    "@@XLSXOUT@@": "xlsxout.js",
    "@@IMPORT@@":  "importer.js",
}

def read(name):
    p = os.path.join(SRC, name)
    with io.open(p, "r", encoding="utf-8") as f:
        return f.read()

html = read("template.html")
for token, fname in PARTS.items():
    body = read(fname)
    # 防止 JS 字符串里的 </script> 提前闭合外层标签
    if fname.endswith(".js"):
        body = body.replace("</script>", "<\\/script>")
    html = html.replace(token, body)

with io.open(OUT, "w", encoding="utf-8") as f:
    f.write(html)

size = os.path.getsize(OUT) / 1024.0
lines = html.count("\n") + 1
print("输出: %s" % OUT)
print("大小: %.1f KB   行数: %d" % (size, lines))
print("时间: %s" % datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
