#!/usr/bin/env python3
"""
PWA 아이콘 / OG 이미지 생성기 (의존성 없음).

브랜드 마크는 '영수증'이다 — 이 서비스의 시작점이 영수증 한 장이기 때문.
    python3 scripts/generate-icons.py
"""
import struct
import zlib
from pathlib import Path

BG = (69, 104, 5)        # --color-primary
PAPER = (252, 249, 242)  # --color-background
INK = (196, 201, 181)    # --color-outline-variant
ACCENT = (246, 135, 0)   # --color-tertiary-container

OUT = Path(__file__).resolve().parent.parent / "public"


def write_png(path: Path, width: int, height: int, pixels):
    """RGB8 PNG를 직접 인코딩한다."""
    raw = bytearray()
    for y in range(height):
        raw.append(0)  # filter type 0 (None)
        row = pixels[y]
        for r, g, b in row:
            raw += bytes((r, g, b))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def rounded_rect(x, y, w, h, radius, px, py):
    """(px, py)가 둥근 사각형 안에 있는가."""
    if not (x <= px < x + w and y <= py < y + h):
        return False
    for cx, cy in ((x + radius, y + radius), (x + w - radius, y + radius),
                   (x + radius, y + h - radius), (x + w - radius, y + h - radius)):
        inside_x = (px < x + radius) if cx == x + radius else (px > x + w - radius)
        inside_y = (py < y + radius) if cy == y + radius else (py > y + h - radius)
        if inside_x and inside_y:
            return (px - cx) ** 2 + (py - cy) ** 2 <= radius ** 2
    return True


def draw_receipt(size, scale, bg=BG, square=False, width=None):
    """녹색 바탕 위에 흰 영수증. scale은 아이콘 대비 영수증 크기 비율."""
    width = width or size
    height = size

    rw = int(size * scale * 0.62)
    rh = int(size * scale * 0.78)
    rx = (width - rw) // 2
    ry = (height - rh) // 2
    zig = max(2, rh // 14)        # 아래쪽 톱니 높이
    line_h = max(2, rh // 22)
    corner = 0 if square else int(size * 0.22)

    rows = []
    for y in range(height):
        row = []
        for x in range(width):
            # 배경 (아이콘은 둥근 사각형, OG는 꽉 찬 사각형)
            if corner and not rounded_rect(0, 0, width, height, corner, x, y):
                row.append(PAPER)
                continue

            color = bg

            in_x = rx <= x < rx + rw
            if in_x and ry <= y < ry + rh:
                # 아래쪽 톱니 모양으로 영수증 느낌을 낸다
                local_y = y - ry
                if local_y > rh - zig:
                    period = max(4, rw // 8)
                    phase = (x - rx) % period
                    tooth = abs(phase - period / 2) / (period / 2)
                    if local_y - (rh - zig) > tooth * zig:
                        row.append(color)
                        continue
                color = PAPER

                # 영수증 안의 글자줄
                pad = rw // 6
                if rx + pad <= x < rx + rw - pad:
                    band = rh // 7
                    for idx in range(1, 5):
                        top = ry + band * idx
                        if top <= y < top + line_h:
                            short = idx % 2 == 1
                            limit = rx + rw - pad - (rw // 4 if short else 0)
                            if x < limit:
                                color = ACCENT if idx == 1 else INK
            row.append(color)
        rows.append(row)
    return rows


def main():
    OUT.mkdir(exist_ok=True)

    targets = [
        ("icon-192.png", 192, 1.0),
        ("icon-512.png", 512, 1.0),
        # maskable은 바깥 20%가 잘릴 수 있어 안전영역 안으로 줄인다
        ("icon-maskable-512.png", 512, 0.72),
        ("apple-touch-icon.png", 180, 1.0),
    ]
    for name, size, scale in targets:
        write_png(OUT / name, size, size, draw_receipt(size, scale))
        print(f"generated public/{name} ({size}x{size})")

    # 공유 미리보기용 OG 이미지
    write_png(OUT / "og.png", 1200, 630, draw_receipt(630, 0.85, square=True, width=1200))
    print("generated public/og.png (1200x630)")


if __name__ == "__main__":
    main()
