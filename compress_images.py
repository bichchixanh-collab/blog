#!/usr/bin/env python3
"""Nen anh hang loat trong assets/ (giữ nguyên kích thước, chỉ giảm dung lượng).

  python compress_images.py --dry-run   xem trước mức giảm, không ghi file
  python compress_images.py             nén thật (tự backup vào assets/.orig-backup/)
  python compress_images.py --no-backup nén thật, không backup
  python compress_images.py --quality 65  chất lượng JPG (mặc định 70)

- JPG/JPEG: nén lossy quality 70, progressive.
- PNG không alpha: quantize 256 màu + optimize (giảm 60-80%, mắt thường khó thấy).
- PNG có alpha + GIF: chỉ optimize lossless (an toàn tuyệt đối).
"""
import os
import shutil
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(ROOT, "assets")
BACKUP = os.path.join(ASSETS, ".orig-backup")
QUALITY = 70


def parse_args():
    q = QUALITY
    for i, a in enumerate(sys.argv):
        if a == "--quality" and i + 1 < len(sys.argv):
            q = max(30, min(90, int(sys.argv[i + 1])))
    return {
        "dry": "--dry-run" in sys.argv,
        "backup": "--no-backup" not in sys.argv,
        "quality": q,
    }


def has_alpha(im):
    if im.mode in ("RGBA", "LA"):
        a = im.getchannel("A")
        mn, mx = a.getextrema()
        return mn < 255
    return False


def compress_one(path, quality):
    """Tra ve (bytes_moi, ghi_chu). Chi ghi file .tmp-out, caller tu quyet dinh."""
    im = Image.open(path)
    ext = os.path.splitext(path)[1].lower()
    tmp = path + ".tmp-out"
    if ext in (".jpg", ".jpeg"):
        im.convert("RGB").save(tmp, "JPEG", quality=quality, optimize=True, progressive=True)
        return os.path.getsize(tmp), "jpg q%d" % quality
    if ext == ".png":
        if has_alpha(im.convert("RGBA")):
            im.save(tmp, "PNG", optimize=True)
            return os.path.getsize(tmp), "png lossless (alpha)"
        im.convert("RGB").quantize(colors=256, method=Image.MEDIANCUT).save(tmp, "PNG", optimize=True)
        return os.path.getsize(tmp), "png 256 mau"
    return None, "skip"


def main():
    opt = parse_args()
    targets = []
    for dp, _, fns in os.walk(ASSETS):
        if os.path.abspath(dp).startswith(os.path.abspath(BACKUP)):
            continue
        for fn in sorted(fns):
            if fn.lower().endswith((".jpg", ".jpeg", ".png")):
                targets.append(os.path.join(dp, fn))
    print("Tim thay %d anh (JPG quality=%d)%s" % (
        len(targets), opt["quality"], " [DRY-RUN]" if opt["dry"] else ""))
    if opt["backup"] and not opt["dry"]:
        os.makedirs(BACKUP, exist_ok=True)
    total_old = total_new = 0
    done = 0
    for path in targets:
        rel = os.path.relpath(path, ROOT)
        old = os.path.getsize(path)
        try:
            new_size, note = compress_one(path, opt["quality"])
        except Exception as e:
            print("  SKIP %s (%s)" % (rel, e))
            continue
        if new_size is None:
            continue
        total_old += old
        total_new += min(old, new_size)
        pct = 100 * (old - new_size) / old if old else 0
        if new_size >= old:
            print("  GIU  %s (%d KB, %s - khong loi)" % (rel, old // 1024, note))
            try:
                os.remove(path + ".tmp-out")
            except OSError:
                pass
            continue
        if opt["dry"]:
            print("  NEN  %s: %d -> %d KB (-%d%%, %s)" % (
                rel, old // 1024, new_size // 1024, int(pct), note))
            try:
                os.remove(path + ".tmp-out")
            except OSError:
                pass
        else:
            if opt["backup"]:
                dst = os.path.join(BACKUP, rel)
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                if not os.path.exists(dst):
                    shutil.copy2(path, dst)
            os.replace(path + ".tmp-out", path)
            print("  NEN  %s: %d -> %d KB (-%d%%)" % (rel, old // 1024, new_size // 1024, int(pct)))
        done += 1
    print("Xong %d file: %d KB -> %d KB (giam %d%%)" % (
        done, total_old // 1024, total_new // 1024,
        int(100 * (total_old - total_new) / total_old) if total_old else 0))
    if opt["backup"] and not opt["dry"]:
        print("Backup goc tai: assets/.orig-backup/ (da gitignore)")


if __name__ == "__main__":
    main()
