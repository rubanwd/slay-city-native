import sys
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGBA")
a = np.array(im).astype(np.float32)
H, W = a.shape[:2]
pink = np.array([255, 45, 142], np.float32); purple = np.array([106, 0, 255], np.float32)
yy, xx = np.mgrid[0:H, 0:W]
t = ((xx + yy) / (W - 1 + H - 1))[..., None]
grad = pink * (1 - t) + purple * t
dist = np.sqrt(((a[..., :3] - grad) ** 2).sum(-1))
near = dist < 60

# flood fill background from the borders over gradient-like pixels
bg = np.zeros((H, W), bool)
q = deque()
for x in range(W):
    for y in (0, H - 1):
        if near[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
for y in range(H):
    for x in (0, W - 1):
        if near[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
while q:
    y, x = q.popleft()
    for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < H and 0 <= nx < W and near[ny, nx] and not bg[ny, nx]:
            bg[ny, nx] = True; q.append((ny, nx))

alpha = Image.fromarray(((~bg) * 255).astype(np.uint8))
alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
fg = im.copy(); fg.putalpha(alpha)
bbox = alpha.getbbox()
print("mascot bbox in 512:", bbox)
fg = fg.crop(bbox)

S = 1024
def up(img, scale): return img.resize((round(img.width*scale), round(img.height*scale)), Image.LANCZOS)

# 1. iOS / store icon: full-bleed 1024 upscale of the web 512 icon
icon = im.resize((S, S), Image.LANCZOS).convert("RGB")
icon.save(f"{out}/icon.png")

# gradient background 1024 (same pink->purple diagonal)
yy, xx = np.mgrid[0:S, 0:S]
t = ((xx + yy) / (2 * (S - 1)))[..., None]
g = (pink * (1 - t) + purple * t).clip(0, 255).astype(np.uint8)
Image.fromarray(g, "RGB").save(f"{out}/android-icon-background.png")

# 2. Android adaptive foreground: mascot fits inside the 66% safe circle (~676px of 1024)
safe = 0.54 * S
scale = safe / max(fg.width, fg.height)
m = up(fg, scale)
canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
canvas.alpha_composite(m, ((S - m.width) // 2, (S - m.height) // 2))
canvas.save(f"{out}/android-icon-foreground.png")

# 3. monochrome: white silhouette of the same layout
mono = Image.new("RGBA", (S, S), (255, 255, 255, 0))
mono.putalpha(canvas.getchannel("A"))
mono.save(f"{out}/android-icon-monochrome.png")

# 4. splash mascot: transparent cutout, larger, shown on #111111
scale = 0.86 * S / max(fg.width, fg.height)
m = up(fg, scale)
sp = Image.new("RGBA", (S, S), (0, 0, 0, 0))
sp.alpha_composite(m, ((S - m.width) // 2, (S - m.height) // 2))
sp.save(f"{out}/splash-icon.png")

# previews: adaptive masks (circle, squircle) and splash on #111111
def mask_preview(shape):
    base = Image.open(f"{out}/android-icon-background.png").convert("RGBA")
    base.alpha_composite(canvas)
    # Android shows the centre 72/108 of the layer
    c = int(S * (1 - 72/108) / 2); base = base.crop((c, c, S - c, S - c)).resize((432, 432), Image.LANCZOS)
    mk = Image.new("L", base.size, 0)
    from PIL import ImageDraw
    d = ImageDraw.Draw(mk)
    if shape == "circle": d.ellipse((0, 0, 431, 431), fill=255)
    else: d.rounded_rectangle((0, 0, 431, 431), radius=110, fill=255)
    bgc = Image.new("RGBA", base.size, (17, 17, 17, 255)); bgc.paste(base, (0, 0), mk); return bgc
mask_preview("circle").save(f"{out}/preview-adaptive-circle.png")
mask_preview("squircle").save(f"{out}/preview-adaptive-squircle.png")
s = Image.new("RGBA", (390, 844), (17, 17, 17, 255))
small = sp.resize((200, 200), Image.LANCZOS)  # expo-splash-screen imageWidth 200
s.alpha_composite(small, ((390 - 200) // 2, (844 - 200) // 2))
s.convert("RGB").save(f"{out}/preview-splash-390.png")
