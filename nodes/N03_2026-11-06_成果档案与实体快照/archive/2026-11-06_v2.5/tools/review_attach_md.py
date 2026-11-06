# -*- coding: utf-8 -*-
"""施工方案 / 审查记录附件 -> .md 文本摘录（离线补充工具，v2.5）。

用途
----
工作台的「查看」在浏览器内即时完成：图片 / PDF 用浏览器原生预览，
doc / docx / pdf / xls / xlsx / txt / md 用工作台自带零依赖 Parse.parse 抽正文。
扫描件、图片型 PDF 没有文本层，Parse 抽不出文字，此时用本脚本调用 MarkItDown
转成 .md，再把 .md 作为**普通附件**上传到对应方案的「施工方案」或「审查记录」
类别，即可在页内「查看」中直接阅读正文（列表会标记「文本摘录」）。

用法（在工作台根目录执行）
----
    python tools/review_attach_md.py 方案.pdf 审查记录.docx
    python tools/review_attach_md.py --dir "D:/方案扫描件"
    python tools/review_attach_md.py --dir "D:/方案扫描件" --out _tmp/review_md --overwrite

参数
----
    files            一个或多个待转换文件（可混用多种格式）
    --dir DIR        转换该目录下所有受支持格式的文件（不递归子目录）
    --out DIR        输出目录，默认 _tmp/review_md
    --overwrite      已存在同名 .md 时覆盖（默认跳过）

说明
----
* 依赖 markitdown（当前环境已装 0.1.9）；未安装会明确提示，不会静默失败。
* 扫描件 OCR 取决于本机额外组件；抽出空文本的文件会跳过并列出，不产生空 .md。
* 单个文件失败会列出原因并继续处理其余文件，不中断整批。
* 本脚本只做离线转换，不读写工作台数据、不修改任何内审记录、不改动单文件 HTML。
"""
from __future__ import print_function

import argparse
import io
import os
import sys

SUPPORTED = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tif", ".tiff",
    ".txt", ".md", ".html", ".htm", ".csv", ".json", ".xml",
    ".zip", ".epub",
}


def collect(files, dirpath):
    out = []
    for f in files:
        p = os.path.abspath(f)
        if not os.path.isfile(p):
            print("[跳过] 文件不存在: %s" % f)
            continue
        out.append(p)
    if dirpath:
        if not os.path.isdir(dirpath):
            print("[错误] 目录不存在: %s" % dirpath)
            return None
        for name in sorted(os.listdir(dirpath)):
            p = os.path.join(dirpath, name)
            if os.path.isfile(p) and os.path.splitext(name)[1].lower() in SUPPORTED:
                if p not in out:
                    out.append(p)
    return out


def main():
    ap = argparse.ArgumentParser(
        description="把方案附件批量转成 .md 文本摘录（供工作台「查看」使用）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("files", nargs="*", help="一个或多个待转换文件")
    ap.add_argument("--dir", dest="dirpath", default="", help="转换该目录下所有受支持格式的文件（不递归）")
    ap.add_argument("--out", dest="outdir", default=os.path.join("_tmp", "review_md"), help="输出目录")
    ap.add_argument("--overwrite", action="store_true", help="已存在同名 .md 时覆盖")
    args = ap.parse_args()

    if not args.files and not args.dirpath:
        ap.print_help()
        print("\n[提示] 请至少给出一个文件，或使用 --dir 指定目录。")
        return 1

    try:
        from markitdown import MarkItDown
    except Exception as e:
        print("[错误] 未找到 markitdown（%s: %s）。" % (type(e).__name__, e))
        print("       请先安装：pip install 'markitdown[all]'")
        return 1

    inputs = collect(args.files, args.dirpath)
    if inputs is None:
        return 1
    if not inputs:
        print("[提示] 没有找到可转换的文件。受支持扩展名：%s" % ", ".join(sorted(SUPPORTED)))
        return 1

    outdir = os.path.abspath(args.outdir)
    try:
        os.makedirs(outdir, exist_ok=True)
    except Exception as e:
        print("[错误] 无法创建输出目录 %s：%s" % (outdir, e))
        return 1

    print("输出目录：%s" % outdir)
    print("待转换：%d 个文件\n" % len(inputs))
    md = MarkItDown()
    ok, skipped, failed = 0, 0, 0
    for p in inputs:
        base = os.path.splitext(os.path.basename(p))[0]
        dst = os.path.join(outdir, base + ".md")
        if os.path.exists(dst) and not args.overwrite:
            print("[跳过] 已存在同名 .md（加 --overwrite 覆盖）：%s" % os.path.basename(dst))
            skipped += 1
            continue
        try:
            res = md.convert(p)
            text = getattr(res, "text_content", "") or ""
            if not text.strip():
                print("[空文本] %s —— 未抽出文字，常见于扫描件且本机缺少 OCR 组件，已跳过" % os.path.basename(p))
                skipped += 1
                continue
            with io.open(dst, "w", encoding="utf-8") as f:
                f.write(text)
            print("[完成] %s -> %s（%d 字）" % (os.path.basename(p), os.path.basename(dst), len(text)))
            ok += 1
        except Exception as e:
            print("[失败] %s：%s: %s" % (os.path.basename(p), type(e).__name__, e))
            failed += 1

    print("\n汇总：成功 %d 个，跳过 %d 个，失败 %d 个。" % (ok, skipped, failed))
    print("把生成的 .md 作为普通附件上传到对应方案的「施工方案」或「审查记录」类别，")
    print("工作台「查看」即可直接阅读正文（列表标记「文本摘录」）。")
    return 0 if failed == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
