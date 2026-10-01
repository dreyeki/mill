#!/usr/bin/env python3
"""把倉庫根目錄的 Obsidian 筆記轉成網站用的 JSON。

用法（在倉庫根目錄執行）：
    python3 tools/import_md.py

產出：
    data/rankings.json  ← 次元排名Top100.md
    data/reviews.json   ← 【網文列表簡評】.md、輕小說.md
    data/posts.json     ← posts/*.md（首頁頭條與文章）
    data/summary.json   ← 首頁入口用的統計數字

只用 Python 標準函式庫，不需要安裝任何套件。
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

RANKING_SRC = ROOT / "次元排名Top100.md"
REVIEW_SRCS = [
    ("webnovel", "網文", ROOT / "【網文列表簡評】.md"),
    ("lightnovel", "輕小說", ROOT / "輕小說.md"),
]


# ---------------------------------------------------------------- md 讀取
def md_lines(path):
    lines = []
    for line in path.read_text("utf-8").splitlines():
        line = line.replace("\u3000", " ").strip()
        if line:
            lines.append(line)
    return lines


# ---------------------------------------------------------------- 次元排名
CAT_ALIASES = {"vtuber": "VTuber", "動漫": "動畫", "輕小說": "小說", "劇集": "影劇"}


def norm_cat(c):
    c = c.strip()
    return CAT_ALIASES.get(c.lower(), CAT_ALIASES.get(c, c))


def parse_meta(text, entry):
    """解析「#作品 ==分類== `備註` *註記*」這類片段，寫進 entry。"""
    for m in re.finditer(r"==([^=]+?)(?:==|$)", text):
        cat = norm_cat(m.group(1))
        if cat and cat not in entry["cats"]:
            entry["cats"].append(cat)
    text = re.sub(r"==([^=]+?)(?:==|$)", " ", text)
    for m in re.finditer(r"`+([^`]*)`*", text):
        if m.group(1).strip():
            entry["notes"].append(m.group(1).strip())
    text = re.sub(r"`+[^`]*`*", " ", text)
    for m in re.finditer(r"\*([^*]+)\*", text):
        entry["notes"].append(m.group(1).strip())
    text = re.sub(r"\*[^*]+\*", " ", text)
    for tok in text.split("#")[1:]:
        tok = tok.replace("~~", "").strip()
        if not tok:
            continue
        if re.fullmatch(r"\d+(\(\d+\))?", tok):
            entry["notes"].append(f"第{tok}次上榜")
        elif tok not in entry["works"]:
            entry["works"].append(tok)
    return text.split("#")[0]


def parse_rankings(lines):
    years, cur, entry = [], None, None
    for line in lines:
        if re.fullmatch(r"20\d\d", line):
            cur = {"year": int(line), "entries": []}
            years.append(cur)
            continue
        m = re.match(r"^Top\s*(\d+)\s*[★.．\-—]+\s*(.*)$", line)
        if m and cur is not None:
            entry = {"rank": int(m.group(1)), "name": "", "works": [], "cats": [], "notes": []}
            rest = parse_meta(m.group(2), entry)
            entry["name"] = rest.strip() or "?"
            cur["entries"].append(entry)
        elif entry is not None and (line.startswith("#") or line.startswith("==") or "==" in line):
            parse_meta(line, entry)
        elif entry is not None:
            entry["notes"].append(line)
    return {"title": lines[0] if lines else "次元排名", "years": sorted(years, key=lambda y: -y["year"])}


# ---------------------------------------------------------------- 心得評分
TIER_RE = re.compile(r"^(AAA\*?|AA|A\+\*?|Aw|A|B\+|Bw|B)(?=$|[\s(（\-])")
STOP_MARKERS = ("以下還有", "一些有名沒有排上")
SCORE_RE = re.compile(r"(一部完評|段複評|完評|複評|評)\s*(?:\([^)]*\))?\s*[：:]?\s*(\d{2,3}(?:\.\d)?)")
RANGE_RE = re.compile(r"(\d{2})(?:\s*~\s*(\d{2,3}))+")
CHAR_RE = re.compile(r"([^\s\dLv][^\s]*?)\s*Lv\s*(\d)([+*]?)")


def tier_key(header):
    m = TIER_RE.match(header)
    return m.group(1) if m else header


def extract(entry):
    text = "\n".join([entry["head"]] + entry["lines"])
    score = None
    m = SCORE_RE.search(text)
    if m:
        score = {"label": m.group(1), "value": float(m.group(2))}
    if score is None:
        m = re.search(r"(?<![~\d.])(\d{2}(?:\.\d)?)\s*分", text)
        if m:
            score = {"label": "評分", "value": float(m.group(1))}
    rng = RANGE_RE.search(text)
    if rng:
        nums = [int(n) for n in re.findall(r"\d{2,3}", rng.group(0))]
        entry["range"] = [min(nums), max(nums)]
        if score is None:
            score = {"label": "區間", "value": None}
    entry["score"] = score

    tags = []
    for ln in [entry["head"]] + entry["lines"]:
        for tok in re.findall(r"\*([^*\n]+)", ln):
            tok = tok.strip()
            if (tok and len(tok) <= 14 and tok not in tags
                    and not re.search(r"[()（）：]|Lv\d", tok)):
                tags.append(tok)
    entry["tags"] = tags[:12]
    entry["marks"] = [ln.lstrip("#").strip() for ln in entry["lines"] if ln.startswith("#")]
    chars = []
    for ln in entry["lines"]:
        if "Lv" not in ln:
            continue
        for name, lv, plus in CHAR_RE.findall(ln):
            name = name.strip(" ,，、")
            if not name or "略" in name or name.startswith("("):
                continue
            chars.append({"name": name, "lv": int(lv), "plus": plus})
    entry["chars"] = chars
    entry["quotes"] = [re.sub(r'^["「]|["」]$', "", ln) for ln in entry["lines"]
                       if re.match(r'^["「].+["」]$', ln)]
    return entry


def parse_reviews(lines):
    out = {"title": lines[0], "intro": [], "tiers": [], "glossary": [], "entries": []}
    tier, entry, mode = None, None, "intro"
    for line in lines[1:]:
        if line.startswith("名詞釋義"):
            mode, entry = "glossary", None
            continue
        if mode == "glossary":
            if out["glossary"] and not re.search(r"[：:]", line):
                out["glossary"][-1] += line
            else:
                out["glossary"].append(line)
            continue
        if line.startswith(STOP_MARKERS) or line == "==":
            if line.startswith("一些有名沒有排上"):
                tier = {"key": "參考", "label": "參考：有名但未看完的作品"}
                out["tiers"].append(tier)
            elif line.startswith("以下還有"):
                out["intro"].append(line)
            entry = None
            mode = "body"
            continue
        if "《" not in line and TIER_RE.match(line) and len(line) < 70:
            if mode == "intro" and re.match(r"^\S+\s+\S", line) and "(" not in line:
                out["intro"].append(line)  # 「AAA 神作」這類圖例
                continue
            tier = {"key": tier_key(line), "label": line}
            out["tiers"].append(tier)
            entry, mode = None, "body"
            continue
        if mode == "intro":
            out["intro"].append(line)
            continue
        m = re.match(r"^《([^》]+)》?(.*)$", line)
        if m:
            entry = {"title": m.group(1).strip(), "tier": tier["label"] if tier else "",
                     "tierKey": tier["key"] if tier else "", "head": m.group(2).strip(), "lines": []}
            out["entries"].append(entry)
        elif entry is not None:
            entry["lines"].append(line)
    out["entries"] = [extract(e) for e in out["entries"]]
    return out


# ---------------------------------------------------------------- 文章
POSTS_DIR = ROOT / "posts"
ASSETS = ROOT / "assets"


def parse_value(v):
    v = v.strip()
    if v.lower() in ("true", "yes"):
        return True
    if v.lower() in ("false", "no"):
        return False
    if re.fullmatch(r"-?\d+", v):
        return int(v)
    if v.startswith("[") and v.endswith("]"):
        return [x.strip().strip("\"'") for x in v[1:-1].split(",") if x.strip()]
    return v.strip("\"'")


def parse_post(path):
    text = path.read_text("utf-8").replace("\r", "")
    meta, body = {}, text
    m = re.match(r"^---\n(.*?)\n---\n?(.*)$", text, re.S)
    if m:
        body, key = m.group(2), None
        for line in m.group(1).split("\n"):
            if re.match(r"^\s+-\s", line) and key:  # YAML 清單
                meta.setdefault(key, [])
                if not isinstance(meta[key], list):
                    meta[key] = [meta[key]] if meta[key] else []
                meta[key].append(parse_value(line.split("-", 1)[1]))
            elif ":" in line:
                key, v = line.split(":", 1)
                key = key.strip()
                meta[key] = parse_value(v) if v.strip() else []
    meta.setdefault("id", path.stem)
    meta.setdefault("title", path.stem)

    def embed(mm):  # Obsidian 的 ![[圖片.png|說明]]
        name, _, cap = mm.group(1).partition("|")
        hits = sorted(ASSETS.rglob(Path(name).name)) if ASSETS.exists() else []
        src = hits[0].relative_to(ROOT).as_posix() if hits else f"assets/img/{name}"
        return f"![{cap}]({src})"

    body = re.sub(r"!\[\[([^\]]+)\]\]", embed, body)
    body = re.sub(r"(?<!!)\[\[(?:[^\]|]+\|)?([^\]]+)\]\]", r"\1", body)  # [[連結|文字]] → 文字
    if isinstance(meta.get("cover"), str) and meta["cover"].startswith("[["):
        meta["cover"] = re.sub(r"!\[[^\]]*\]\(([^)]+)\)", r"\1", embed(re.match(r"\[\[(.+)\]\]", meta["cover"])))
    meta["body"] = body.strip()
    meta["minutes"] = max(1, round(len(re.sub(r"\s|!\[[^\]]*\]\([^)]*\)", "", body)) / 450))
    meta["date"] = str(meta.get("date", ""))
    return meta


def build_posts():
    if not POSTS_DIR.exists():
        return []
    posts = [parse_post(p) for p in POSTS_DIR.glob("*.md")]
    posts = [p for p in posts if not p.get("draft")]
    pinned = [p for p in posts if p.get("pinned")]
    rest = sorted([p for p in posts if not p.get("pinned")], key=lambda p: p["date"], reverse=True)
    return sorted(pinned, key=lambda p: p["date"], reverse=True) + rest


# ---------------------------------------------------------------- main
def main():
    DATA.mkdir(exist_ok=True)
    missing = [p for p in [RANKING_SRC] + [s[2] for s in REVIEW_SRCS] if not p.exists()]
    if missing:
        sys.exit("找不到原稿：" + ", ".join(str(p) for p in missing))

    rankings = parse_rankings(md_lines(RANKING_SRC))
    (DATA / "rankings.json").write_text(json.dumps(rankings, ensure_ascii=False, separators=(",", ":")), "utf-8")
    print("rankings.json:", ", ".join(f"{y['year']}={len(y['entries'])}" for y in rankings["years"]))

    reviews = {"collections": []}
    for cid, name, path in REVIEW_SRCS:
        col = parse_reviews(md_lines(path))
        col.update({"id": cid, "name": name})
        reviews["collections"].append(col)
        print(f"reviews.json: {name} {len(col['entries'])} 篇、{len(col['tiers'])} 個分級")
    (DATA / "reviews.json").write_text(json.dumps(reviews, ensure_ascii=False, separators=(",", ":")), "utf-8")

    posts = build_posts()
    (DATA / "posts.json").write_text(json.dumps({"posts": posts}, ensure_ascii=False, indent=1), "utf-8")
    print(f"posts.json: {len(posts)} 篇")

    summary = {
        "rankings": sum(len(y["entries"]) for y in rankings["years"]),
        "years": [y["year"] for y in rankings["years"]],
        "reviews": sum(len(c["entries"]) for c in reviews["collections"]),
    }
    (DATA / "summary.json").write_text(json.dumps(summary, ensure_ascii=False), "utf-8")


if __name__ == "__main__":
    main()
