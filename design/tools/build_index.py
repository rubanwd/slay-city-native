#!/usr/bin/env python3
"""
Builds design/index.html — the single SLAY CITY Native design reference.

Every value in the output was read from rubanwd/slay-city (the web app) at the
commit in SOURCE_COMMIT. When the web design changes, edit the data below and
re-run:  python3 design/tools/build_index.py

Design-time tool only. Not part of the app, not run in CI.
"""

from html import escape
from pathlib import Path

SOURCE_COMMIT = "beba39d"
OUT = Path(__file__).resolve().parent.parent / "index.html"
MASCOT = "SCN-58/assets/splash-icon.png"


def e(s):
    return escape(str(s), quote=True)


def table(head, rows, cls=""):
    h = "".join(f"<th>{c}</th>" for c in head)
    b = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows)
    return f'<div class="tw"><table class="{cls}"><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table></div>'


def code(s):
    return f"<code>{e(s)}</code>"


def sec(id_, title, body, lead=""):
    lead_html = f'<p class="lead">{lead}</p>' if lead else ""
    return f'<section id="{id_}"><h2><a href="#{id_}">§</a> {title}</h2>{lead_html}{body}</section>'


def sub(id_, title, body):
    return f'<div class="sub" id="{id_}"><h3><a href="#{id_}">#</a> {title}</h3>{body}</div>'


def phone(inner, label, extra=""):
    return (
        f'<figure class="phone-fig"><div class="phone {extra}"><div class="status"><span>9:41</span>'
        f'<span>●●● ▮</span></div>{inner}</div><figcaption>{label}</figcaption></figure>'
    )


# ── Icons (exact web paths) ────────────────────────────────────────────────

def svg(paths, size=22, sw=2, fill="none", vb="0 0 24 24"):
    return (
        f'<svg width="{size}" height="{size}" viewBox="{vb}" fill="{fill}" stroke="currentColor" '
        f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">{paths}</svg>'
    )


ICONS = {
    "map": ('<path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z"/><path d="M9 4v13"/><path d="M15 6.5v13"/>', "Tab bar — Map", "BottomNav.tsx"),
    "wardrobe": ('<path d="M12 3a2 2 0 0 0-2 2c0 1 .8 1.7 2 2.2"/><path d="M12 7.2 3.5 13.5a1 1 0 0 0 .6 1.8h15.8a1 1 0 0 0 .6-1.8L12 7.2z"/>', "Tab bar — Wardrobe", "BottomNav.tsx"),
    "homework": ('<path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/>', "Tab bar — Homework", "BottomNav.tsx"),
    "profile": ('<circle cx="12" cy="8" r="4"/><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6"/>', "Tab bar — Profile; parent pending-link state", "BottomNav.tsx"),
    "dashboard": ('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/>', "Tab bar — Dashboard (parent, teacher)", "BottomNav.tsx"),
    "close": ('<path d="M2 2l12 12M14 2L2 14"/>', "Close / exit (mission, flows, reward modal) — viewBox 0 0 16 16, 16pt", "MissionScreen.tsx, RewardModal.tsx"),
    "info": ('<circle cx="8" cy="8" r="7" stroke-width="1.5"/><circle cx="8" cy="4.6" r="0.95" fill="currentColor" stroke="none"/><path d="M8 7v4.5" stroke-width="1.6"/>', "How to play — viewBox 0 0 16 16", "HowToPlayButton.tsx"),
    "logout": ('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>', "Log out", "ProfileScreen, TeacherHeader, ParentDashboard"),
    "back": ('<path d="M15 18l-6-6 6-6"/>', "Back (teacher header) — stroke 2.5", "TeacherHeader.tsx"),
    "chevron-right": ('<path d="M9 5l7 7-7 7"/>', "Welcome CTA chevron — stroke 2.5, 18pt", "WelcomeScreen.tsx"),
    "chevron-down": ('<polyline points="6 9 12 15 18 9"/>', "Expand / collapse (rotates 180°)", "StudentCard, CollapsibleSection"),
    "restart": ('<path d="M3 12a9 9 0 1 1 2.6 6.4"/><polyline points="3 17 3 12 8 12"/>', "Restart location", "CityMap.tsx"),
    "check": ('<path d="M20 6L9 17l-5-5"/>', "Done mark (stroke 3) — recent activity, level radio", "ParentDashboard, LevelPicker"),
    "feedback": ('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 7v5"/><path d="M12 15h.01"/>', "Feedback &amp; Bugs", "FeedbackButton.tsx"),
    "group": ('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', "Teacher empty state (no groups)", "TeacherDashboard.tsx"),
    "lightning": ('<path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" fill="currentColor" stroke="none"/>', "Welcome decoration (filled)", "WelcomeScreen.tsx"),
    "star": ('<path d="M12 2l2.4 7.2H22l-6 4.6 2.3 7.2-6.3-4.5-6.3 4.5 2.3-7.2-6-4.6h7.6z" stroke-width="1.5"/>', "Welcome decoration", "WelcomeScreen.tsx"),
    "heart": ('<path d="M12 20s-7.5-4.7-10-9.3C.4 7.4 2.2 4 5.6 4c2 0 3.5 1.1 4.4 2.6C10.9 5.1 12.4 4 14.4 4c3.4 0 5.2 3.4 3.6 6.7C20 15.3 12 20 12 20z" stroke-width="1.5"/>', "Welcome decoration", "WelcomeScreen.tsx"),
    "sparkle": ('<path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" fill="currentColor" stroke="none"/>', "Welcome decoration (filled)", "WelcomeScreen.tsx"),
    "xp": ('<path d="M13.2 2L4 13.4h5.4L8.4 22 20 9.6h-5.9z" fill="currentColor" stroke="none"/>', "XpIcon (filled, currentColor)", "XpIcon.tsx"),
}


def icon(name, size=22):
    paths = ICONS[name][0]
    vb = "0 0 16 16" if name in ("close", "info") else "0 0 24 24"
    sw = 2.5 if name in ("back", "chevron-right") else (3 if name == "check" else 2)
    return svg(paths, size=size, sw=sw, vb=vb)


COIN = (
    '<svg width="{s}" height="{s}" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#E0A11B"/>'
    '<circle cx="12" cy="12" r="9.2" fill="#FFCE45"/><circle cx="12" cy="12" r="8.2" fill="none" stroke="#E0A11B" stroke-width=".9" opacity=".7"/>'
    '<path d="M12 6.7l1.35 3.44 3.69.22-2.85 2.35.94 3.58L12 14.3l-3.12 1.99.94-3.58-2.85-2.35 3.69-.22z" fill="#7BB800" opacity=".35" transform="translate(0 .5)"/>'
    '<path d="M12 6.7l1.35 3.44 3.69.22-2.85 2.35.94 3.58L12 14.3l-3.12 1.99.94-3.58-2.85-2.35 3.69-.22z" fill="#9DFF00"/>'
    '<path d="M6.4 8.2a7.2 7.2 0 0 1 4.1-3.4" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.3" stroke-linecap="round"/></svg>'
)


def coin(s=16):
    return COIN.format(s=s)


def xp(s=16):
    return f'<span class="t-cyan">{icon("xp", s)}</span>'


# ── CSS ────────────────────────────────────────────────────────────────────

CSS = r"""
:root{--pink:#FF2D8E;--lime:#9DFF00;--cyan:#00F0FF;--purple:#6A00FF;--orange:#FF8A00;--black:#111111;--white:#FFFFFF;--surface:#1A1A1A;--coin:#FDE047;
--w5:rgba(255,255,255,.05);--w10:rgba(255,255,255,.10);--w15:rgba(255,255,255,.15);--w20:rgba(255,255,255,.20);--w25:rgba(255,255,255,.25);--w40:rgba(255,255,255,.40);--w50:rgba(255,255,255,.50);--w60:rgba(255,255,255,.60);--w70:rgba(255,255,255,.70);--w80:rgba(255,255,255,.80)}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:16px}
body{margin:0;background:#0b0b0b;color:#eee;font:15px/1.55 Nunito,system-ui,sans-serif}
a{color:var(--cyan)}code{font:12.5px ui-monospace,SFMono-Regular,Menlo,monospace;background:#1d1d1d;border:1px solid #2a2a2a;border-radius:6px;padding:1px 5px;color:#e8e8e8;word-break:break-word}
.layout{display:grid;grid-template-columns:260px minmax(0,1fr);max-width:1320px;margin:0 auto}
nav.toc{position:sticky;top:0;height:100vh;overflow:auto;padding:24px 16px;border-right:1px solid #222;font-size:13px}
nav.toc a{display:block;color:#bbb;text-decoration:none;padding:3px 8px;border-radius:8px}nav.toc a:hover{background:#1a1a1a;color:#fff}
nav.toc .g{margin:14px 0 4px 8px;color:#777;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
main{padding:32px 40px 120px;min-width:0}
header.top h1{font-size:40px;font-weight:900;line-height:1.05;margin:0 0 8px;letter-spacing:-.02em}
header.top h1 span{color:var(--pink)}
.meta{color:#999;font-size:13px}
section{margin-top:56px;padding-top:8px;border-top:1px solid #222}
h2{font-size:26px;font-weight:900;margin:8px 0 6px}h2 a,h3 a{color:#555;text-decoration:none;font-weight:700}
h3{font-size:18px;font-weight:800;margin:28px 0 8px}
h4{font-size:14px;font-weight:800;margin:18px 0 6px;color:#ddd;text-transform:uppercase;letter-spacing:.06em}
.lead{color:#bbb;max-width:880px}
p,li{max-width:900px}
.tw{overflow-x:auto;margin:10px 0 16px}
table{border-collapse:collapse;width:100%;font-size:13.5px}
th{text-align:left;color:#999;font-weight:800;font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;border-bottom:1px solid #2c2c2c;padding:8px 10px;white-space:nowrap}
td{border-bottom:1px solid #1f1f1f;padding:8px 10px;vertical-align:top}
td code{white-space:nowrap}
.note{border-left:3px solid var(--cyan);background:#0f1a1b;padding:10px 14px;border-radius:0 10px 10px 0;margin:12px 0;max-width:900px}
.warn{border-left-color:var(--orange);background:#1b140b}
.rule{border-left-color:var(--pink);background:#1b0f15}
.grid{display:grid;gap:14px}.g2{grid-template-columns:repeat(2,minmax(0,1fr))}.g3{grid-template-columns:repeat(3,minmax(0,1fr))}.g4{grid-template-columns:repeat(4,minmax(0,1fr))}
.swatch{border:1px solid #2a2a2a;border-radius:16px;overflow:hidden;background:#151515}
.swatch .chip{height:72px}.swatch div.t{padding:8px 10px;font-size:12.5px}.swatch b{display:block;font-size:13.5px}
.demo{background:var(--black);border:1px solid #262626;border-radius:20px;padding:20px;margin:12px 0;display:flex;flex-wrap:wrap;gap:14px;align-items:center}
.demo.col{flex-direction:column;align-items:stretch}
.lbl{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--w50)}
/* component previews */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;border-radius:16px;height:52px;padding:0 24px;font-size:16px;border:0;font-family:inherit;cursor:pointer}
.btn.sm{height:40px;padding:0 16px;font-size:14px;border-radius:12px;gap:6px}.btn.lg{height:64px;padding:0 32px;font-size:18px}
.btn.pink{background:var(--pink);color:#fff}.btn.green{background:var(--lime);color:var(--black)}.btn.ghost{background:transparent;color:#fff;border:1px solid var(--w25)}
.btn.pressed.pink{background:#E62880}.btn.pressed.green{background:#8DE600}.btn.pressed.ghost{background:var(--w5)}.btn.dis{opacity:.4}
.btn.full{width:100%}
.card{background:var(--surface);border:1px solid;border-radius:16px;padding:16px;color:#fff}
.card.pink{border-color:rgba(255,45,142,.6);box-shadow:0 0 12px rgba(255,45,142,.25)}.card.green{border-color:rgba(157,255,0,.6);box-shadow:0 0 12px rgba(157,255,0,.2)}
.card.cyan{border-color:rgba(0,240,255,.6);box-shadow:0 0 12px rgba(0,240,255,.2)}.card.purple{border-color:rgba(106,0,255,.6);box-shadow:0 0 12px rgba(106,0,255,.25)}.card.ghost{border-color:var(--w15)}
.inp{width:100%;padding:12px 16px;border-radius:12px;background:var(--w10);border:1px solid var(--w20);color:#fff;font:14px Nunito;outline:0}
.inp.focus{background:var(--w15);border-color:var(--pink);box-shadow:0 0 0 2px rgba(255,45,142,.6)}
.inp::placeholder{color:var(--w40)}
.track{height:10px;border-radius:99px;background:var(--w10);overflow:hidden}.fill{height:100%;border-radius:99px}
.pill{display:inline-flex;align-items:center;gap:4px;border-radius:99px;padding:4px 10px;font-size:12px;font-weight:700;white-space:nowrap}
.tile{border-radius:16px;border:1px solid var(--w15);background:var(--w5);color:#fff;padding:16px 20px;font-weight:500;text-align:left}
.tile.sel{border-color:var(--cyan);background:rgba(0,240,255,.15)}.tile.ok{border-color:var(--lime);background:rgba(157,255,0,.15);color:var(--lime)}
.tile.bad{border-color:var(--pink);background:rgba(255,45,142,.15);color:var(--pink)}.tile.dim{border-color:var(--w10);background:rgba(255,255,255,.03);color:var(--w40)}
.streak{display:inline-flex;align-items:center;gap:6px;height:40px;padding:0 16px;border-radius:16px;color:#fff;font-weight:900;background:linear-gradient(90deg,#6A00FF,#00F0FF);box-shadow:inset 0 1px 0 rgba(255,255,255,.15),0 0 12px 2px rgba(106,0,255,.35)}
.t-pink{color:var(--pink)}.t-lime{color:var(--lime)}.t-cyan{color:var(--cyan)}.t-purple{color:#8f4dff}.t-orange{color:var(--orange)}.t-coin{color:var(--coin)}.t-w50{color:var(--w50)}.t-w60{color:var(--w60)}.t-w40{color:var(--w40)}
.row{display:flex;align-items:center;gap:8px}.between{justify-content:space-between}.wrap{flex-wrap:wrap}
/* phone mockups */
.phones{display:flex;flex-wrap:wrap;gap:22px;margin:16px 0}
.phone-fig{margin:0}.phone-fig figcaption{font-size:12px;color:#999;margin-top:6px;max-width:300px}
.phone{zoom:.72;width:390px;height:844px;background:var(--black);border-radius:44px;border:10px solid #000;outline:1px solid #333;overflow:hidden;position:relative;display:flex;flex-direction:column;color:#fff}
.phone .status{height:47px;display:flex;justify-content:space-between;align-items:flex-end;padding:0 28px 6px;font-size:15px;font-weight:700;flex-shrink:0}
.ph-body{flex:1;min-height:0;display:flex;flex-direction:column;position:relative}
.ph-pad{padding:0 20px}
.tabbar{border-top:1px solid var(--w10);background:rgba(17,17,17,.95);flex-shrink:0}
.tabbar ul{display:flex;justify-content:space-around;list-style:none;margin:0;padding:8px}
.tabbar li{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;color:var(--w50);font-size:11px;font-weight:600}
.tabbar .ic{width:40px;height:40px;border-radius:99px;display:flex;align-items:center;justify-content:center}
.tabbar li.on{color:var(--lime)}.tabbar li.on .ic{background:var(--lime);color:var(--black)}
.watermark{height:38px;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:26px;letter-spacing:6px;color:rgba(255,255,255,.2);padding-bottom:18px;height:56px}
.hdr{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;border-bottom:1px solid var(--w10);flex-shrink:0}
.circle{width:36px;height:36px;border-radius:99px;border:1px solid var(--w15);display:flex;align-items:center;justify-content:center;color:var(--w70);flex-shrink:0}
.mapframe{position:relative;width:100%;aspect-ratio:5/7;background:linear-gradient(#241246,#0a0616 55%,#000);overflow:hidden}
.mapnode{position:absolute;transform:translate(-50%,-50%);border-radius:99px;padding:6px 14px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;border:2px solid var(--w25);background:rgba(17,17,17,.55);box-shadow:0 0 14px rgba(157,255,0,.35);white-space:nowrap}
.mapnode.sel{border-color:var(--pink);background:rgba(17,17,17,.7);box-shadow:0 0 30px 4px rgba(255,45,142,.5)}
.mapnode.done{border-color:rgba(157,255,0,.5);color:var(--lime);box-shadow:none}
.mascot{position:absolute;transform:translate(-50%,calc(-100% - 20px));width:74px;filter:drop-shadow(0 0 20px rgba(157,255,0,.45))}
.ph-mascot{display:block;object-fit:contain}
@media (max-width:900px){.layout{grid-template-columns:1fr}nav.toc{display:none}main{padding:20px 16px 80px}.g3,.g4{grid-template-columns:repeat(2,minmax(0,1fr))}}
"""


# ── Data ───────────────────────────────────────────────────────────────────

BRAND = [
    ("neon-pink", "#FF2D8E", "Accent. Pink buttons, focus ring, errors (there is no red), selected map stop, teacher badges.", "locked"),
    ("lime-green", "#9DFF00", "Everyday CTA (green button), success, correct answers, active tab, completed states.", "locked"),
    ("cyan", "#00F0FF", "Info and selection: picked answer tile, XP, links, how-to-play, homework modules.", "locked"),
    ("purple", "#6A00FF", "Depth: card glow, streak gradient start, practice bars, teacher collapsibles, view-as banner.", "locked"),
    ("neon-orange", "#FF8A00", "Rare accent: placement “Finish now”, “Fantastic!” reward theme. Not locked.", "unlocked"),
    ("black", "#111111", "Every background. Text on lime buttons.", "locked"),
    ("white", "#FFFFFF", "Text; every grey is white at an opacity.", "locked"),
]

ARTWORK = [
    ("surface", "#1A1A1A", "Card / sheet / modal background (web writes raw bg-[#1a1a1a]). Already in packages/tokens."),
    ("artwork.coin.rim", "#E0A11B", "CoinIcon rim (SCN-56 D3)."),
    ("artwork.coin.face", "#FFCE45", "CoinIcon face."),
    ("artwork.coin.starShadow", "#7BB800", "CoinIcon star shadow."),
    ("artwork.coin.text", "#FDE047", "NEW. Coin numbers — web passes text-yellow-300 at every call site (HUD, reward, wardrobe, map panel). Also the “Iconic!” reward theme and parent “in progress” pill."),
    ("artwork.coin.rain", "#FACC15", "NEW. Gold dots in the reward rain (yellow-400)."),
    ("artwork.map.skyTop", "#241246", "NEW. Fallback map sky gradient 0% (MapBackground — shown only when a district has no art)."),
    ("artwork.map.skyMid", "#0A0616", "NEW. Sky gradient 55%."),
    ("artwork.map.skyline", "#160A2B", "NEW. Skyline building fill (stroke purple @60%, lit windows lime @55%)."),
]

ALPHA = [("white/5", ".05", "#1D1D1D", "Tile & chip fills, pressed ghost"), ("white/10", ".10", "#292929", "Dividers, input fill, track, neutral pill"),
         ("white/15", ".15", "#353535", "Default tile border, focused input fill"), ("white/20", ".20", "#414141", "Input border, outline chip border"),
         ("white/25", ".25", "#4C4C4C", "Ghost button border, map label border"), ("white/40", ".40", "#707070", "Placeholder, hints, timestamps"),
         ("white/50", ".50", "#888888", "Labels, secondary text, inactive tab"), ("white/60", ".60", "#A0A0A0", "Body secondary"),
         ("white/70", ".70", "#B8B8B8", "Body on cards, close icons"), ("white/80", ".80", "#CFCFCF", "Tooltip text, strong secondary")]

TYPE = [
    ("display", 40, 10, 64, 900, 1.1, "-0.02em", "", "AMAZING!", "Reward headline, RewardModal title"),
    ("h1", 28, 7, 40, 800, 1.1, "-0.02em", "", "Log In", "Auth & onboarding titles"),
    ("h2", 20, 5, 28, 700, 1.25, "0", "", "Homework", "Screen titles in consoles, question text, word cards"),
    ("h3", 16, 4, 20, 700, 1.25, "0", "", "Coffee Corner", "Card titles, prompts, modal titles"),
    ("body", 14, 3.5, 16, 400, 1.5, "0", "", "Practice what your teacher assigned.", "Body copy"),
    ("bodyStrong", 14, 3.5, 16, 600, 1.5, "0", "", "Learn the Words", "List-row titles"),
    ("small", 12, 3, 14, 500, 1.25, "0", "", "3/5 missions done", "Hints, captions, errors"),
    ("label", 10, 2.5, 12, 700, 1.25, "0.12em", "uppercase", "Vocabulary learned", "Field labels, section titles, stat labels"),
]

RAW_SIZES = [("text-[9px]", 9, "Teacher badge in chat"), ("text-[10px]", 10, "Stat-chip labels, timestamps, ON badge"), ("text-[11px]", 11, "Tab labels, eyebrows (“BY TEACHER”), chips"),
             ("text-xs", "12 / lh 16", "Pills, link-ish actions"), ("text-sm", "14 / lh 20", "Secondary buttons, errors, banners"), ("text-base", "16 / lh 24", "Map panel title, md button"),
             ("text-lg", "18 / lh 28", "HUD title, lg button, translations"), ("text-xl", "20 / lh 28", "Centered header titles (Wardrobe, Profile)"), ("text-2xl", "24 / lh 32", "Reward amounts, placement prompt"),
             ("text-3xl", "30 / lh 36", "Stat card value, placement intro"), ("text-4xl", "36 / lh 40", "Placement result level, emoji tiles"), ("text-5xl", "48 / lh 1", "Parent vocabulary count, emoji rebus")]

SPACING = [("0.5", 2), ("1", 4), ("1.5", 6), ("2", 8), ("2.5", 10), ("3", 12), ("3.5", 14), ("4", 16), ("5", 20), ("6", 24), ("8", 32), ("10", 40), ("12", 48), ("14", 56), ("16", 64)]

RADII = [("rounded-md", 6, "Tiny pills in teacher tools, study-time bars"), ("rounded-lg", 8, "Wardrobe card buttons, letter tiles, hangman keys"), ("rounded-xl", 12, "Inputs, sm button, chips, toasts, image inside card"),
         ("rounded-2xl", 16, "Cards, tiles, md/lg buttons, list rows — the card floor"), ("rounded-3xl", 24, "RewardModal, feedback sheet top, flashcard, hero frame"), ("rounded-full", 999, "Pills, avatars, circle buttons, tab icon bubble")]

SHADOWS = [
    ("glow-pink-pulse", "0 0 24px 2px rgba(255,45,142,.35) ⇄ 0 0 48px 8px rgba(255,45,142,.6), 3s ease-in-out ∞", "Selected map stop, Welcome hero frame (.animate-glow)"),
    ("card glow (per variant)", "0 0 12px 0 rgba(color,.20–.25); pressed 0 0 24px 4px rgba(color,.40–.45)", "SlayCard"),
    ("reward modal", "0 0 40px 8px rgba(255,45,142,.3)", "RewardModal panel"),
    ("progress fill", "0 0 8px 2px rgba(color,.5) when value &gt; 0", "ProgressBar"),
    ("streak", "inset 0 1px 0 rgba(255,255,255,.15), 0 0 12px 2px rgba(106,0,255,.35)", "StreakBadge"),
    ("map label idle", "0 0 14px rgba(157,255,0,.35)", "MapLocationNode (unlocked, not selected)"),
    ("milestone banner", "0 0 16px rgba(157,255,0,.45)", "Map milestone banner"),
    ("mascot drop-shadow", "0 0 20px rgba(157,255,0,.45)", "Map mascot, loader mascot"),
    ("location icon ring", "ring 2 lime/60 + 0 0 12px rgba(157,255,0,.35)", "Mission header location icon"),
    ("flashcard", "0 0 40px -10px rgba(0,240,255,…) / lime on the back face", "FlashcardsTask"),
    ("toast / tooltip", "shadow-lg / shadow-xl black/50", "Toast, HowToPlay tooltip"),
]

MOTION = [
    ("glow-pulse", "3s ease-in-out ∞", "box-shadow pink 24→48px", "Selected map stop, Welcome hero", "useGlowPulse — animate shadow opacity/radius on an outer view"),
    ("logo-shimmer", "6s ease-in-out ∞", "white highlight sweeps across the logo glyphs (mask)", "Welcome logo", "MaskedView + moving LinearGradient; or skip (decorative)"),
    ("loader-bob", "1.1s ease-in-out ∞", "translateY 0→-14, rotate -3°→3°", "Loader mascot, map mascot", "useBob"),
    ("loader-shadow", "1.1s ease-in-out ∞", "scaleX 1→.7, opacity .45→.2", "Ground shadow under bobbing mascot", "paired with useBob"),
    ("loader-dot", "1.4s ease-in-out ∞, delays 0/180/360ms", "scale .6→1, opacity .35→1", "Three loader dots (pink, lime, cyan)", "useDotPulse(delay)"),
    ("label-float", "3.2s ease-in-out ∞, delay ((x+y)%5)·0.4s", "translateY 0→-4", "Map location labels", "useFloat(delay)"),
    ("watermark-breathe", "7s ease-out ∞, per-letter delay 55ms", "fill-opacity .2→.4 at 3%", "“Slay School” wordmark under tabs", "per-letter opacity; optional"),
    ("banner-drop", "0.35s ease-out", "translateY -12→0, opacity 0→1", "Map milestone banner (auto-hides 4.5s)", "entering={FadeInDown}"),
    ("answer-pick", "0.42s cubic-bezier(.34,1.56,.64,1)", "scale .96→1.04→1 + lime ring 0→10px, settles to 22px glow", "Placement answer tap", "withSequence springs"),
    ("question-in", "0.28s ease-out", "translateX 24→0, opacity 0→1", "Next placement question", "entering={SlideInRight}"),
    ("wiggle", "1.6s ease-in-out ∞", "rotate ±4°, translateY 0/-5/0/-2", "SlayCharacter wiggle (reward)", "useWiggle"),
    ("lookFloat", "3s ease-in-out ∞", "translateY 0→-8, scale 1→1.04", "Wardrobe mascot preview", "useFloat"),
    ("reward-pop", "0.5s ease-out (mascot 0.6s, delay .1s)", "scale .6→1.08→1, opacity 0→1", "Reward headline + mascot", "entering ZoomIn spring"),
    ("reward-rise", "0.5s ease-out, delays .25/.35/.45/.5/.55s", "translateY 16→0, opacity 0→1", "Reward cards, recap, banner, CTA", "entering FadeInUp.delay(n)"),
    ("reward-headline-pulse", "1.6s ease-in-out ∞ after .5s", "scale 1→1.06 + text-shadow 12/28→20/44px", "Reward headline", "textShadowRadius + scale"),
    ("reward-rain", "2.4–5s linear ∞, random delays 0–2.5s", "48 dots fall -12vh→112vh with ±20px drift", "Reward background", "48 Animated views; hide under reduced motion"),
    ("transitions", "150ms (buttons, inputs) · 200ms (cards) · 300ms (panels, modal) · 500ms (map bg fade) · 600ms (progress, count-up) · 700ms (mascot glide)", "", "", "withTiming with these durations"),
]

SOUNDS = [
    ("playMissionStartSfx", "Tap ▶ Start on the map", "Drum roll (16 taps, accent gap 0.1s) then a gong (165 Hz, partials 1, 1.79, 2.45, 3.76, 4.07, 5.43; 1.8s)"),
    ("playMapTravelSfx", "Tap a different map stop", "0.32s swoosh as the mascot walks"),
    ("playRewardApplauseSfx", "Reward screen lands (and demo finish)", "Applause 1.7s, 70 claps + 9 firework pops from 0.3s"),
    ("playSnakeHiss", "Tap the mascot (map, loader)", "0.85s filtered noise hiss, peak gain 0.32"),
    ("speechSynthesis", "🔊 Listen (homework word), Spelling Bee", "en-US, rate 0.9 — native: expo-speech"),
]

HAPTICS = [("Light impact", "Every SlayButton press, tab change, map stop tap, answer tile tap"),
           ("Success notification", "Correct answer revealed, pair matched, task complete, reward screen lands"),
           ("Error notification", "Wrong answer, wrong match flash, snake game over"),
           ("Selection", "LevelPicker / role / locale chip change, D-pad press")]


def build():
    parts = []
    T = parts.append

    # ── Header & how to use ───────────────────────────────────────────────
    T(f'''<header class="top"><p class="lbl">SLAY CITY Native · single design reference</p>
<h1>The <span>Slay City</span> design system</h1>
<p class="meta">Source of truth for every design-related SCN ticket · values read from <code>rubanwd/slay-city@{SOURCE_COMMIT}</code> ·
units are <b>points at the 390pt design width</b> (web px map 1:1) · dark only · generated by <code>design/tools/build_index.py</code></p></header>''')

    T(sec("use", "How to use this document", f'''
<div class="note rule"><b>For an agent implementing a ticket:</b> read <a href="#rules">§1 Global rules</a> first — they override
anything a ticket prompt says about colours, dark mode, variant names, hover or ripple. Then open the section the
<a href="#index">ticket index</a> points to. Implement what is written here; where the web and this file disagree,
this file wins (each disagreement is listed in <a href="#deviations">§12</a> with the reason).</div>
<ul>
<li>Exact values only. Every colour is a token from <code>@slay/tokens</code> — never a raw hex in a component.</li>
<li>Web class names are quoted next to values (<code>rounded-2xl</code>, <code>bg-white/5</code>) so ports stay greppable against the upstream checkout (<code>node scripts/fetch-upstream.mjs</code>).</li>
<li>Copy (button labels, empty states) is UI chrome and is quoted verbatim. Learning content (words, missions, questions) is never hard-coded.</li>
<li>Older per-ticket references still exist and agree with this file: <code>design/SCN-5/index.html</code> (tokens + 6 primitives, with a JSON spec),
<code>design/SCN-56/index.html</code> (6 more primitives + icon paths), <code>design/SCN-58/</code> (icon and splash assets). This file merges them.</li>
</ul>'''))

    # ── Ticket index ─────────────────────────────────────────────────────
    idx = [
        ("WP-1.1 · 1.2 · 0.4", "Tokens, NativeWind preset, Nunito, SlayText", "#tokens-color, #tokens-type, #tokens-space"),
        ("WP-1.3", "Design-system primitives", "#primitives"),
        ("WP-1.4", "Icons to react-native-svg", "#icons"),
        ("WP-1.5 · 2.6", "Router skeleton, tab bars per role, route guard look", "#layout, #tabbar"),
        ("WP-1.6", "Portrait lock, splash, icon", "#assets, design/SCN-58/README.md"),
        ("WP-2.2 · 2.5", "Auth screens, Google button", "#screen-auth"),
        ("WP-3.1", "City map", "#screen-map"),
        ("WP-3.2–3.6", "TaskRunner and all 32 task types", "#screen-mission, #tasks, #pattern-answers"),
        ("WP-3.7", "Reward screen and modal", "#screen-reward, #overlays"),
        ("WP-4.1", "Homework (student)", "#screen-homework"),
        ("WP-4.2", "Wardrobe", "#screen-wardrobe"),
        ("WP-4.3 · 4.7", "Profile, levels, language", "#screen-profile, #screen-placement"),
        ("WP-4.4", "Onboarding", "#screen-onboarding"),
        ("WP-4.6", "Feedback sheet", "#overlays"),
        ("WP-5.1–5.7", "Teacher console", "#teacher"),
        ("WP-5.8 · 5.9", "Parent console", "#parent"),
        ("WP-6.1", "Reanimated animations", "#motion"),
        ("WP-6.2 · 6.3", "Audio, haptics", "#sound"),
        ("WP-6.6", "Accessibility", "#rules, #native"),
        ("WP-7.6", "Store screenshots", "#screens-gallery"),
    ]
    T(sec("index", "Ticket index — which section to read", table(["Work package", "Topic", "Read"], [(a, b, " ".join(f'<a href="{x.strip()}">{e(x.strip())}</a>' if x.strip().startswith("#") else code(x.strip()) for x in c.split(","))) for a, b, c in idx]) +
          '<p class="t-w60">Atlas ticket numbers (SCN-n) are not stable across re-plans, so map by the work package or the topic in the ticket title.</p>'))

    # ── Global rules ─────────────────────────────────────────────────────
    rules = [
        ("G1", "Dark only", "No light palette, no <code>dark:</code> variants, no colour-scheme detection. Background <code>#111111</code> everywhere. (SCN-5 D1)"),
        ("G2", "Tokens only", "Seven brand colours + <code>surface</code> + the <code>artwork.*</code> namespace (§2.1). Every grey is white at an opacity. No raw hex in components; no red (errors are neon-pink)."),
        ("G3", "Web names", "Keep the web's component and prop names: <code>SlayButton variant=\"pink|green|ghost\"</code>, <code>SlayCard variant=\"pink|green|cyan|purple|ghost\"</code>, sizes <code>sm|md|lg</code>. Do not rename to primary/secondary. (SCN-5 D2)"),
        ("G4", "One primary action", "Each screen has exactly one filled call to action, full width, at the bottom of the content: <b>lime-green lg</b> for “go / continue” (Start, Next, Claim Reward, Let’s Go!), <b>pink lg</b> for auth submit, placement and retry. Secondary actions are ghost buttons, outline pills or underlined text."),
        ("G5", "Pressed, not hover", "Every web <code>hover:</code> style becomes the pressed style on native. Filled buttons darken (10% black overlay); outline/ghost surfaces get <code>white/5</code>–<code>white/10</code>. No Android ripple by default. (SCN-5 D6)"),
        ("G6", "Touch targets ≥ 44pt", "Visual sizes stay as on the web (36pt circle buttons, 40pt sm button, compact wardrobe card buttons); add <code>hitSlop</code> so the touch target reaches 44×44."),
        ("G7", "Type scale at 390", "Use <code>fluidFontSize(variant, width)</code>; at 390pt every variant is at its minimum. Raw Tailwind sizes (<code>text-sm</code> …) map to fixed points (§2.2)."),
        ("G8", "Safe areas", "Screens pad the top inset; the tab bar owns the bottom inset. Full-screen flows (mission, reward, auth) pad both. Never a fixed 150px clearance — use the tab bar height. (SCN-56 D8)"),
        ("G9", "Portrait, phone only", "<code>orientation: portrait</code>, <code>supportsTablet: false</code>. Layouts are a single 390-wide column; nothing above <code>max-w-md</code> (448) is designed."),
        ("G10", "Motion respects settings", "Every looping animation stops when Reduce Motion is on (<code>useReducedMotion</code>); entrances become instant. Animate transforms and opacity on the UI thread (Reanimated), not layout. (SCN-56 D10)"),
        ("G11", "Haptics", "Light impact on every button press; success/error notifications on answer feedback (§2.8). Native-only addition."),
        ("G12", "English stays English", "Mission content, authored titles and level names are English. Only the parent console, the student profile + tab bar and the demo chrome are translated (en/uk/ru)."),
        ("G13", "Accessibility", "Every icon-only button has an <code>accessibilityLabel</code> (web <code>aria-label</code> text is quoted in each section). Errors use <code>accessibilityRole=\"alert\"</code>; progress uses <code>progressbar</code> with value. Focus rings are web-only and are not drawn."),
        ("G14", "Mascot is alive", "Slay appears on map, mission loader, reward, wardrobe, profile and auth backdrop, and is always tappable where it bobs (hiss sound). Never static where the web animates it."),
    ]
    T(sec("rules", "1 · Global rules", table(["#", "Rule", "Detail"], [(f"<b>{a}</b>", f"<b>{b}</b>", c) for a, b, c in rules])))

    # ── Foundations ──────────────────────────────────────────────────────
    sw = "".join(f'<div class="swatch"><div class="chip" style="background:{h}"></div><div class="t"><b>{n}</b>{code(h)} · {lock}<br><span class="t-w60">{d}</span></div></div>' for n, h, d, lock in BRAND)
    aw = table(["Token", "Value", "Use"], [(code(n), f'<span class="row"><span style="width:16px;height:16px;border-radius:4px;background:{h};display:inline-block"></span>{code(h)}</span>', d) for n, h, d in ARTWORK])
    al = table(["Token", "Alpha", "≈ on #111111", "Use"], [(code(n), a, f'<span class="row"><span style="width:16px;height:16px;border-radius:4px;background:{h};border:1px solid #333;display:inline-block"></span>{code(h)}</span>', u) for n, a, h, u in ALPHA])
    tint = table(["Tint", "Where"], [
        (code("bg-<colour>/5"), "Module cards (cyan/5), dialogue reply, true/false idle, teacher collapsible (purple/5)"),
        (code("bg-<colour>/10"), "Error banner (pink/10), success notice (lime/10), selected level row, demo gate"),
        (code("bg-<colour>/15"), "Correct / wrong / selected tiles, status pills, resolved chips, XP chip"),
        (code("bg-<colour>/20–/30"), "Simon idle tiles, memory card back (purple/30), placement level badge (purple/30)"),
        (code("border-<colour>/30–/60"), "Module cards (cyan/30), card outlines (/60), completed map label (lime/50), logout pill (pink/40)"),
    ])
    grads = table(["Gradient", "Stops", "Where"], [
        ("Streak fill", "90° #6A00FF → #00F0FF", "StreakBadge"),
        ("Reward image slot", "135° purple/30 → neon-pink/20, ring neon-pink/30", "RewardModal image, reward mascot card (theme-dependent, see §8.6)"),
        ("Hero frame", "180° purple/20 → black → black", "Welcome mascot frame"),
        ("Parent vocabulary hero", "135° neon-pink/15 → transparent, border pink/40", "ParentDashboard"),
        ("Flashcard front / back", "135° cyan/25 → black → purple/25 · lime/25 → black → pink/25", "FlashcardsTask"),
        ("Accent hairline", "90° transparent → neon-pink → transparent, 96×1", "Top edge of RewardModal"),
        ("App icon", "135° #FF2D8E → #6A00FF", "SCN-58 icon background"),
    ])
    T(sec("tokens-color", "2.1 · Colour", f'<div class="grid g4">{sw}</div><h4>Neutral &amp; artwork tokens</h4>{aw}<h4>White opacity scale (the only greys)</h4>{al}<h4>Brand tints</h4>{tint}<h4>Gradients (expo-linear-gradient)</h4>{grads}',
          "Seven brand colours (six locked by the web AGENTS.md) plus neutral surface. NEW tokens below are additions this file asks for — add them to <code>packages/tokens/src/colors.ts</code> under <code>artwork</code>."))

    ts = "".join(
        f'<tr><td>{code(n)}</td><td>{mn} → {mx} ({vw}vw)</td><td>{w}</td><td>{lh}</td><td>{ls}{" · UPPER" if up else ""}</td>'
        f'<td><span style="font-size:{mn}px;font-weight:{w};line-height:{lh};letter-spacing:{ls};{"text-transform:uppercase;" if up else ""}">{e(s)}</span></td><td class="t-w60">{u}</td></tr>'
        for n, mn, vw, mx, w, lh, ls, up, s, u in TYPE)
    T(sec("tokens-type", "2.2 · Typography", f'''
<p>Nunito 400–900 (<code>@expo-google-fonts/nunito</code>; the family name carries the weight — <code>fontFamilyByWeight</code>). Use <code>&lt;SlayText variant&gt;</code>.</p>
<div class="tw"><table><thead><tr><th>Variant</th><th>Size min → max</th><th>Weight</th><th>Line</th><th>Tracking</th><th>At 390pt</th><th>Use</th></tr></thead><tbody>{ts}</tbody></table></div>
<h4>Raw sizes used outside the scale</h4><p>The web also uses Tailwind’s fixed sizes. Render them at these exact points (no fluid scaling):</p>
{table(["Web class", "pt", "Seen on"], [(code(a), b, c) for a, b, c in RAW_SIZES])}
<h4>Text treatments</h4>{table(["Treatment", "Recipe", "Where"], [
        ("Eyebrow", "11pt · 700 · uppercase · tracking .15em · white/50", "Location name in mission header, “Word 2 of 5”"),
        ("Section label", "label variant · white/50", "Section titles, field labels, stat labels"),
        ("Button label", "800 · uppercase · tracking .05em", "All SlayButtons and CTA links"),
        ("Accent word", "same style, one word in neon-pink", "“Log <b class=t-pink>In</b>”, “Sign <b class=t-pink>Up</b>”, “Create Your <b class=t-pink>Profile</b>”"),
        ("Typewriter", "small · 600 · uppercase · tracking .05em · 45ms/char after 350ms", "Welcome subtitle “Learn English. <b class=t-lime>Slay</b> your goals.”"),
        ("Numbers", "tabular-nums · 700–900", "Coins, XP, counters, streak count-up"),
    ])}'''))

    T(sec("tokens-space", "2.3 · Spacing, radii, borders", f'''
<h4>Spacing scale (Tailwind unit = 4pt)</h4>{table(["Class unit"] + [a for a, _ in SPACING], [["pt"] + [str(b) for _, b in SPACING]])}
<h4>Recurring layout numbers</h4>{table(["Thing", "Value"], [
        ("Screen side padding", "20 (<code>px-5</code>); header bars on wardrobe/profile 24 (<code>px-6</code>)"),
        ("Section vertical rhythm", "Section py: xs 8 · sm 16 · md 24 (default) · lg 32 · xl 48; gap inside 12"),
        ("Card padding", "16 (<code>p-4</code>); list rows 16×12 (<code>px-4 py-3</code>); hero sections 20"),
        ("Gap between list rows", "8 (<code>gap-2</code>); between answer tiles 12 (<code>gap-3</code>); between page sections 16–24"),
        ("Header bar", "12–16 vertical padding + 1pt bottom divider white/10"),
        ("Primary CTA", "full width, lg 64 tall (Welcome, task Next, Reward) or 56 (<code>h-14</code> map Start, demo log-in)"),
    ])}
<h4>Radii</h4>{table(["Web", "pt", "Use"], [(code(a), b, c) for a, b, c in RADII])}
<p class="t-w60">The card floor is 16 (<code>rounded-2xl</code>). Packages/tokens <code>radii</code>: sm 8 · md 12 · lg 16 · card 24 · pill 999 — note <code>radii.card</code> is 24 but most web cards are 16 (<code>radii.lg</code>); use the value in the component section, not the token name.</p>
<h4>Borders</h4><p>1pt default; 2pt for emphasis (map labels, selected tiles in placement/simon/memory, milestone banners, level-cleared card, role chips use 1). Dividers are 1pt white/10.</p>'''))

    T(sec("tokens-elevation", "2.4 · Glow &amp; elevation", table(["Name", "Value", "Where"], SHADOWS) +
          '<div class="note">RN <code>boxShadow</code> (new architecture, enabled) accepts these strings. Put the shadow on an outer view and <code>overflow:hidden</code> + radius on an inner view — iOS clips a shadow drawn on the clipping view. There is no elevation/drop-shadow other than glows: the product is flat dark surfaces lit by neon.</div>'))

    T(sec("motion", "2.5 · Motion", table(["Name", "Timing", "What moves", "Where", "Native (src/animations)"], MOTION) +
          '<div class="note">One hook per web keyframe in <code>src/animations/</code>. All of them check <code>useReducedMotion()</code> — loops stop, entrances become instant, the reward rain is not rendered (G10).</div>'))

    ic = "".join(f'<div class="swatch" style="padding:14px"><div class="row" style="gap:14px"><span style="color:#fff">{icon(k, 28)}</span><div><b>{k}</b><span class="t-w60" style="font-size:12px">{d}<br>{code(src)}</span></div></div></div>' for k, (p, d, src) in ICONS.items())
    T(sec("icons", "2.6 · Icons", f'''<p>Outline icons, 24 viewBox, stroke 2, round caps and joins, <code>currentColor</code> — drawn with <code>react-native-svg</code> from the exact paths below (also in SCN-56 <code>spec.icons</code>). Default rendered size 22 (tabs), 16–18 (inline), 24 (empty-state badges). No icon library.</p>
<div class="grid g3">{ic}<div class="swatch" style="padding:14px"><div class="row" style="gap:14px">{coin(28)}<div><b>coin</b><span class="t-w60" style="font-size:12px">CoinIcon — multi-colour illustration, artwork.coin tokens<br>{code("CoinIcon.tsx")}</span></div></div></div></div>
<h4>Emoji</h4><p>The UI uses emoji as icons in a few places: 🔥 streak · 🏆 level cleared · 🏙️ district cleared · ✓ done · 🔒 locked item · 🔊 listen · 🎉 passed · 🧢 🕶️ 👜 ✨ wardrobe category placeholders · 📝 👆 🤷 🏁 placement intro · 😀…💀 hangman stages · ▶ ↻ ← ‹ › as text glyphs. Use system emoji for these. Task <i>content</i> that is made of emoji (emoji_decode, counting_game, spot_the_difference) renders through an <code>EmojiText</code> port (Twemoji images) so Android shows the same glyph as iOS.</p>
<h4>Third-party</h4><p>Google “G” logo keeps Google’s own four colours (#4285F4, #34A853, #FBBC05, #EA4335) — exempt from G2, brand guidelines require it.</p>'''))

    T(sec("assets", "2.7 · Brand assets &amp; imagery", f'''
<div class="demo"><img class="ph-mascot" src="{MASCOT}" width="120" alt=""><div><b>Slay</b> — lime snake, pink headphones, black “slay” cap and hoodie. Web files: <code>public/wardrobe/slay-base.webp</code> (default mascot, everywhere),
<code>slay-hero.webp</code> (Welcome hero, Reward), equipped-look composites from Wardrobe. Copy into <code>assets/images/</code>.</div></div>
{table(["Asset", "Source", "Native use"], [
        ("App icon, adaptive icon, monochrome, splash", "design/SCN-58/assets/*", "app.json — see design/SCN-58/README.md"),
        ("Logo wordmark", "web public/logo.svg (324×87)", "Welcome header, 56pt tall, left-aligned −8pt; react-native-svg"),
        ("Mascot base / hero", "public/wardrobe/slay-base.webp, slay-hero.webp", "SlayCharacter default src; Welcome; Reward; loader"),
        ("Wardrobe item art", "public/wardrobe/*.webp|png + Supabase Storage", "Remote via expo-image, contain, 4pt inset"),
        ("District background art", "Supabase Storage (AI-generated, 5:7)", "Map frame, plus the same image blurred at 40% behind it"),
        ("Location icon", "Supabase Storage", "Mission header, 44pt circle, ring lime/60"),
        ("Fallback map", "MapBackground.tsx (SVG)", "Only when a district has no art — sky gradient, pink + cyan glows, 15 stars, purple skyline"),
    ])}
<p>Images: rounded 16 (<code>rounded-2xl</code>) with <code>white/5</code> placeholder fill; cover for photos/flashcards, contain for mascot and wardrobe art. Long-press must not open a save sheet (web MediaGuard) — RN Image does not, keep it that way.</p>'''))

    T(sec("sound", "2.8 · Sound &amp; haptics", f'''<h4>Sound effects</h4>{table(["Web function", "When", "Sound"], [(code(a), b, c) for a, b, c in SOUNDS])}
<div class="note warn">The web synthesises these with WebAudio at runtime. Native plays pre-rendered files from <code>assets/sounds/</code> through expo-audio (WP-6.2): render each once from the web (record the WebAudio output) and keep the timing above. Respect the silent switch.</div>
<h4>Haptics (expo-haptics, native-only)</h4>{table(["Haptic", "When"], HAPTICS)}'''))

    # ── Layout & navigation ──────────────────────────────────────────────
    tab = lambda items, on: '<div class="tabbar"><ul>' + "".join(f'<li class="{"on" if i == on else ""}"><span class="ic">{icon(k)}</span>{l}</li>' for i, (k, l) in enumerate(items)) + '</ul><div class="watermark">SLAY SCHOOL</div></div>'
    student_tabs = [("map", "Map"), ("wardrobe", "Wardrobe"), ("homework", "Homework"), ("profile", "Profile")]
    console_tabs = [("dashboard", "Dashboard"), ("map", "Map"), ("profile", "Profile")]
    T(sec("layout", "3 · Layout &amp; navigation", f'''
{sub("layout-containers", "3.1 Screen containers", table(["Component", "Spec"], [
        ("<b>AppContainer</b>", "bg black, text white, side padding 20 (<code>flush</code> removes it), max width 448 centred. <code>fixedHeight</code> → exactly the screen, no page scroll (mission, flows). Safe-area <code>edges</code> prop: default top+bottom; tab screens pass <code>['top']</code>."),
        ("<b>ScrollScreen</b>", "ScrollView filling the screen, bounce contained; <code>footer</code> pinned below; bottom content padding = tab bar height + inset; <code>topOffset</code> for the view-as banner (49)."),
        ("<b>Section</b>", "column, gap 12; <code>py</code> none 0 · xs 8 · sm 16 · md 24 (default) · lg 32 · xl 48; <code>pt/pb</code> override; optional <code>title</code> in label style white/50."),
        ("<b>Grid</b>", "cols 1–4 (default 2), gap none 0 · xs 4 · sm 8 · md 12 (default) · lg 16; cell width = (W − gap·(cols−1)) / cols."),
    ]))}
{sub("tabbar", "3.2 Bottom tab bar (BottomNav)", f"""<div class="grid g2"><div class="demo" style="padding:0;overflow:hidden;display:block">{tab(student_tabs, 0)}</div><div class="demo" style="padding:0;overflow:hidden;display:block">{tab(console_tabs, 0)}</div></div>
{table(["Part", "Spec"], [
        ("Tabs per role", "Student: Map · Wardrobe · <i>Homework (only when in a teacher group)</i> · Profile. Parent: Dashboard · Map · Profile (translated). Teacher: Dashboard · Map · Profile."),
        ("Bar", "bg <code>rgba(17,17,17,.95)</code> (web adds backdrop blur — optional on native), top border 1 white/10, row padding 8, items stretch evenly."),
        ("Item", "column, gap 4, radius 12: 40pt circle with the 22pt icon + 11pt/600 label, line-height 1."),
        ("Active", "circle filled lime-green, icon black, label lime-green. Inactive: icon + label white/50. Colour transition 150ms."),
        ("Active rule", "Most specific prefix wins (<code>activeNavIndex</code> in packages/core) — <code>/parent/map</code> is Map, not Dashboard. Inside a mission no tab is active and the bar is hidden."),
        ("Watermark strip", "Under the tabs: 38pt strip bg white/6 with “Slay School” at 70% width, 900 weight, white @20%, per-letter breathe (7s, 55ms stagger). It sits above the home-indicator inset; the inset is added below it."),
        ("Native", "Expo Router <code>Tabs</code> with a custom <code>tabBar</code> render — not the default bar. Hide on the mission, reward, homework-flow and auth stacks."),
    ])}""")}
{sub("headers", "3.3 Header bars", table(["Variant", "Spec", "Used on"], [
        ("Centered title", "16 vertical / 24 side padding, title 20/700 white centred, bottom divider white/10. Optional right slot (coins).", "Wardrobe (coins right), Profile, Parent profile"),
        ("Map HUD", "12/20 padding, “SLAY CITY” 18/900 lime uppercase left; right: pill “Lvl n · xp XP” (white/10, 14/700) + coin pill (white/10, coin colour). Below: district bar — name 14/900 uppercase centred, “✓ cleared” in lime.", "Student map"),
        ("Console title", "py 20: h2/900 title + small white/50 subtitle (truncate); right: logout pill (pink/40 border, pink text, 12/600, icon 16).", "Teacher & parent dashboards"),
        ("TeacherHeader", "py 20: optional 36pt back circle (border white/15, chevron) · h2 title truncate · 36pt logout circle (pink/40 border) at the end.", "Teacher group, topic"),
        ("Flow header", "36pt close circle · eyebrow (11/700 uppercase .15em white/50) · right: info button + “n/total” 14/700 white/50. Below: ProgressBar (pink, “Progress”, “n/total”).", "Mission, homework word cards & test"),
        ("Back link", "“← Back” 14/600 white/50 text button, radius 12, padding 12×8; goes back, or to a fallback route when there is no history.", "Auth, homework topic (“← Homework”), flow intros (“← Topic”)"),
    ]))}
{sub("states", "3.4 Loading, empty, error", table(["State", "Spec"], [
        ("Full-screen loader", "bg black, centred column gap 24: bobbing mascot 96pt (drop-shadow lime) + ground shadow pill 64×8 lime/40 blur 3; three 10pt dots pink · lime · cyan (dot pulse, 180ms stagger); caption 14/700 uppercase tracking .2em white/70 (“Slay City” default, “Loading map…”). Mascot tappable (hiss)."),
        ("Inline loader", "Same, filling its parent (z above content) — map area while the district art decodes, then the art fades in 500ms."),
        ("Pending text", "white/60 + pulse: “Saving your rewards…”, “Checking your answers…”, “Saving your progress…”."),
        ("Empty card", "rounded 16, border white/10, bg surface, padding 16×24–40, text small white/50–60 centred. Optional 48pt tinted circle icon (pink/10 or cyan/10) + h3 title above."),
        ("Inline error", "text neon-pink (small/600 or sm/600 centred) with role alert, directly under the thing that failed."),
        ("Error banner", "rounded 12, border pink/40, bg pink/10, 16×8 padding, sm pink."),
        ("Success notice", "rounded 16, border lime/30, bg lime/10, “✓” + small/700 lime."),
        ("Locked", "opacity 60 on the card + outline pill “🔒 Lvl n” (white/15 border, white/50)."),
        ("Disabled", "opacity 40 (buttons) / 50 (inputs, chips) and no touch."),
    ]))}'''))

    # ── Overlays ─────────────────────────────────────────────────────────
    T(sec("overlays", "4 · Overlays", table(["Overlay", "Spec", "Native"], [
        ("<b>RewardModal</b>", "Backdrop black/75 (+blur). Panel max 384 wide, surface, radius 24, border pink/50, glow 0 0 40 8 pink/30, padding 48 top / 24 sides / 32 bottom, gap 16, centred text. Close X 32pt top-right (white/40). Pink hairline at the top edge. Optional 144pt image slot (gradient purple/30→pink/20, ring 2 pink/30, radius 16). Title display/900. Description body white/60. Reward chips row gap 12. Divider white/10. Action: full-width md pink “CONTINUE”. Open: fade 300ms + panel scale .9→1 & translateY 24→0; image scale .75→1 over 500ms.", "RN Modal transparent + Reanimated; backdrop tap closes; Android back closes."),
        ("<b>Dialog</b> (teacher “Add Topic”)", "Backdrop black/75. Panel max 448, surface, radius 16, border white/10, padding 20, scrolls. Title h3/700 + 32pt close. Footer: green md submit (flex 1) + ghost md Cancel.", "RN Modal, KeyboardAvoidingView."),
        ("<b>Bottom sheet</b> (Feedback &amp; Bugs)", "Backdrop black/80. Sheet surface, top radius 24, border white/10, padding 20 / bottom 32. Title “Feedback &amp; Bugs” 18/900. Segmented: two flex-1 buttons radius 12 — active pink fill white text, idle border white/20 text white/60. Textarea radius 16, bg black/40, border white/15, focus border cyan, counter 11 white/30 right. Optional image picker. Submit green lg. Sent state: emoji, “Thanks — we got it!”, green md Done.", "Modal presentation pageSheet / custom sheet; expo-image-picker."),
        ("<b>Toast</b>", "Top, 16 from the safe area, max 448, radius 12, border 1, surface@95%, 16×12 padding, small/600. Success: border lime/50 text lime. Error: border pink/50 text pink. Auto-dismiss 4s, stack gap 8.", "In-app component (no native toast); role status/alert."),
        ("<b>Progress toast</b>", "Bottom-fixed: radius 12, border purple/50, surface@95%, spinner (white/20 ring, purple head) + small/600 title + 11pt pink error line.", "Teacher AI image generation progress."),
        ("<b>Tooltip</b>", "How to play: 256 wide, below-right of the 36pt info button (12 gap), surface, border white/15, radius 16, padding 16, shadow; title label cyan “HOW TO PLAY”, text small white/80 relaxed. Info button turns cyan (border cyan, bg cyan/15) while open. Dismiss on outside tap.", "Absolute view + outside-press catcher."),
        ("<b>Confirm</b>", "Web uses window.confirm with exact copy: “Leave this mission? Your progress on this task will be lost.” · “Skip this task? You'll move on, but you won't earn anything for it.” · “Restart {location}? You'll replay every mission here from the start.” · “Replay {level}? Every mission in this level starts over — your XP and coins stay.” · “Remove all vocabulary words and the test from this topic?”", "Alert.alert(title, message, [Cancel, destructive action])."),
    ])))

    # ── Primitives ───────────────────────────────────────────────────────
    btns = "".join(f'<button class="btn {v} {s}">{l}</button>' for v, s, l in [("pink", "", "Log In"), ("green", "", "Start"), ("ghost", "", "Cancel"), ("green", "sm", "Send"), ("pink", "lg", "Try again")])
    btn_states = '<button class="btn green pressed">Pressed</button><button class="btn pink pressed">Pressed</button><button class="btn ghost pressed">Pressed</button><button class="btn green dis">Disabled</button><button class="btn pink dis"><span style="width:16px;height:16px;border:2px solid #fff;border-top-color:transparent;border-radius:99px;display:inline-block"></span>Loading</button>'
    cards = "".join(f'<div class="card {v}" style="width:150px"><div class="lbl">{v}</div><b>Card</b></div>' for v in ["pink", "green", "cyan", "purple", "ghost"])
    T(sec("primitives", "5 · Primitives", f'''
<p class="lead">Components in <code>src/components/ui</code> and <code>src/components/layout</code>. SlayText, SlayButton, SlayCard, SlayInput, SlayPressable and AppContainer exist (SCN-5). Section, Grid, ScrollScreen, ProgressBar, CurrencyAmount and StreakBadge are specified in SCN-56. Everything else below is new.</p>
{sub("p-button", "SlayButton", f"""<div class="demo">{btns}</div><div class="demo">{btn_states}</div>
{table(["Prop / part", "Spec"], [
        ("variant", "<b>green</b> (everyday CTA, 70 of 128 web buttons) · <b>pink</b> (accent: auth submit, placement, retry) · <b>ghost</b> (secondary: transparent, border white/25)"),
        ("size", "sm 40 tall · px 16 · 14pt · radius 12 · gap 6 — md 52 · px 24 · 16pt · radius 16 · gap 8 — lg 64 · px 32 · 18pt · radius 16 · gap 10"),
        ("label", "800, uppercase, tracking .05em; text white on pink/ghost, black on green"),
        ("pressed", "pink #E62880 · green #8DE600 (10% black overlay) · ghost bg white/5; 150ms; light haptic"),
        ("disabled / loading", "opacity 40, no touch; loading shows ActivityIndicator in label colour in place of iconLeft and disables"),
        ("icons", "iconLeft / iconRight nodes (Google logo on ghost lg)"),
    ])}""")}
{sub("p-card", "SlayCard", f"""<div class="demo">{cards}</div>
{table(["Part", "Spec"], [
        ("Base", "surface #1A1A1A, radius 16, border 1, padding 16 (<code>flush</code> = 0), clip"),
        ("Variants", "border colour/60 + glow 0 0 12 (pink/purple .25, green/cyan .20); ghost: border white/15, no glow"),
        ("Pressable", "scale 1.02, border full colour, glow 0 0 24 4 at .40–.45; ghost: border white/40, bg white/5; 200ms"),
        ("Header / Footer", "row space-between gap 8; 12 margin; <code>divided</code> adds a white/10 hairline with 12 padding"),
        ("Note", "Most web list rows are not SlayCard — they are the plain “surface row” (rounded 16, border white/10, bg surface, 16×12). Use SlayCard where the web does: vocabulary/word/grammar cards (cyan)."),
    ])}""")}
{sub("p-input", "SlayInput, textarea, select", f"""<div class="demo col" style="max-width:420px"><label class="lbl">Email</label><input class="inp" placeholder="you@example.com"><label class="lbl">Password</label><input class="inp focus" value="••••••••"><span style="font-size:12px;font-weight:600" class="t-pink">Wrong email or password.</span></div>
{table(["Part", "Spec"], [
        ("Field", "bg white/10, border 1 white/20, radius 12, padding 16×12 (≈47 tall), body text white, placeholder white/40, caret/selection neon-pink"),
        ("Focused", "bg white/15, border neon-pink, ring 2 pink/60 outside the border; 150ms"),
        ("Label", "label variant white/50, 6 above the field; optional suffix “(optional)” in normal case white/30"),
        ("Hint / success / error", "small white/40 · small/600 lime · small/600 pink (role alert). The field itself does not turn red/pink on error (SCN-5 D7)."),
        ("Textarea", "same skin; chat composer: min 44, max 128, small text, grows with content"),
        ("Compact (teacher tools)", "same skin with 8 vertical padding and small text"),
        ("Select", "web &lt;select&gt; in teacher importer → native: a pressable field opening an action sheet / picker list"),
        ("Checkbox", "row card radius 12, border white/15, bg white/5, 12×10; box 20pt accent lime"),
    ])}""")}
{sub("p-progress", "ProgressBar", f"""<div class="demo col" style="max-width:420px"><div class="row between"><span class="lbl">Progress</span><span style="font-size:12px;font-weight:600;color:var(--w70)">3/5</span></div><div class="track"><div class="fill" style="width:60%;background:var(--pink);box-shadow:0 0 8px 2px rgba(255,45,142,.5)"></div></div>
<div class="track" style="height:8px"><div class="fill" style="width:85%;background:var(--lime);box-shadow:0 0 8px 2px rgba(157,255,0,.5)"></div></div><div class="track" style="height:10px"><div class="fill" style="width:30%;background:var(--cyan);box-shadow:0 0 8px 2px rgba(0,240,255,.5)"></div></div></div>
<p>Track white/10, full radius, height 10 (8 in score lists). Fill green | pink | cyan with glow when value &gt; 0. Animates 600ms <code>bezier(.4,0,.2,1)</code> from 0 on mount (scaleX, origin left). Labels: left label-style white/50, right small/600 white/70. The mission header wraps it as pink “Progress” + “n/total”. Plain bars without glow: parent map progress (12 tall, lime), practice share (6 tall, purple), study-time week chart (64-tall columns, cyan/70 on white/5, radius 6).</p>""")}
{sub("p-currency", "CoinAmount, XpAmount, StreakBadge", f"""<div class="demo"><span class="row t-coin" style="font-weight:700">{coin(16)}120</span><span class="row t-cyan" style="font-weight:700">{icon("xp", 16)}340</span>
<span class="pill" style="background:var(--w10);color:#fff;font-size:14px;padding:6px 12px">Lvl 3 · 340 XP</span><span class="pill t-coin" style="background:var(--w10);font-size:14px;padding:6px 12px">{coin(14)}120</span><span class="streak">🔥 7</span></div>
<p>Row, gap 4, 700, tabular numbers, icon size = font size. Coin numbers use <code>artwork.coin.text</code> (#FDE047) wherever the web passes <code>text-yellow-300</code> (HUD pill, reward card, wardrobe header, map panel, parent card); XP numbers are cyan. StreakBadge: sm 28 / md 40 / lg 56 tall, purple→cyan gradient, 🔥 + count (900), count-up 600ms; tap toggles the tooltip (224 wide, auto-hide 3s). StreakBadge is not on any web screen yet.</p>""")}
{sub("p-mascot", "SlayCharacter, HissableMascot", f"""<div class="demo"><img class="ph-mascot" src="{MASCOT}" width="64"><img class="ph-mascot" src="{MASCOT}" width="96"><img class="ph-mascot" src="{MASCOT}" width="144"></div>
<p><b>SlayCharacter</b>: square image, contain; sizes xs 64 · sm 96 · md 144 · lg 200 · xl 280 · full (fills parent, 1:1); <code>wiggle</code> loops the wiggle animation; <code>src</code> defaults to the base snake. <b>HissableMascot</b>: the mascot as a button (label “Make Slay hiss”) — image + ground shadow pill; press scales to .9 (150ms) and plays the hiss. Used on the map marker and the loader.</p>""")}
{sub("p-pills", "Pills, chips, badges", f"""<div class="demo">
<span class="pill" style="background:rgba(157,255,0,.15);color:var(--lime)">Completed</span><span class="pill" style="background:rgba(0,240,255,.15);color:var(--cyan)">START</span><span class="pill" style="background:var(--w10);color:#fff">Continue</span>
<span class="pill" style="background:rgba(253,224,71,.15);color:var(--coin)">In progress</span><span class="pill" style="border:1px solid var(--w20);color:var(--w60);text-transform:uppercase;letter-spacing:.05em">Change</span>
<span class="pill" style="border:1px solid rgba(157,255,0,.5);color:var(--lime);font-size:10px;font-weight:900;text-transform:uppercase">Homework</span><span class="pill" style="background:var(--lime);color:#111;font-size:10px;padding:2px 6px">ON</span>
<span class="pill" style="background:var(--pink);color:#fff;font-size:11px;min-width:20px;height:20px;justify-content:center;padding:0 6px">3</span><span class="pill" style="background:rgba(255,45,142,.2);color:var(--pink);font-size:9px;text-transform:uppercase">Teacher</span>
<span class="pill" style="background:rgba(106,0,255,.3);color:var(--cyan);font-size:11px;text-transform:uppercase;letter-spacing:.12em">Elementary</span></div>
{table(["Kind", "Spec"], [
        ("Status pill", "full radius, 10×4, 11–12/700; tinted /15 bg + colour text: lime = done, cyan = start/info, yellow (coin text) = in progress, white/10 + white/50–70 = neutral"),
        ("Outline action pill", "border white/20, 12×6, 12/700 uppercase white/60 — “Change”, “Cancel”, “Move”; active state border+text pink, bg pink/15"),
        ("Unread badge", "20 min size, pink fill, 11/700 white, “9+” above 9"),
        ("Role badge", "border white/15, 12×4, 11/700 uppercase tracking .12em white/60 — profile under the email"),
        ("Stat chip", "radius 12, bg white/5, 10×6: value bodyStrong/900 white over 10pt uppercase white/40 label"),
        ("Filter / choice chip", "full radius, 16×8, 14/600; selected border lime, bg lime/15, text lime; idle border white/15, text white/70 — locale picker"),
    ])}""")}
{sub("p-choice", "Choice controls", table(["Control", "Spec", "Where"], [
        ("Level radio row", "full-width row, radius 16, border 1, 16×14: name bodyStrong/700 + description small white/50; 24pt radio circle (border 2 white/25 → lime fill with black check). Selected row: border lime, bg lime/10, name lime.", "Onboarding, profile level card"),
        ("Role segmented (2-up grid)", "radius 12, border white/20, 16×12, 14/600 white/60; checked border pink, bg pink/10, text white", "Register “I am a” Student / Parent"),
        ("Two-option segmented", "flex-1, radius 12, 16×10, 14/700; active pink fill white; idle border white/20 white/60", "Feedback type Bug / Feedback"),
        ("Collapsible section", "radius 16, border purple/30, bg purple/5; header 16 padding: bodyStrong title (+badge) + small white/50 subtitle, chevron 20 white/60 rotates 180° (200ms); body padding 16, gap 16", "Teacher topic editor"),
        ("Expandable row", "surface row; header 16×12 with name + stat chips + chevron 18 white/40; expanded body under a white/10 divider", "Teacher student card"),
    ]))}'''))

    # ── Patterns ─────────────────────────────────────────────────────────
    tiles = '<div class="demo col" style="max-width:420px">' + "".join(f'<div class="tile {c}">{t}</div>' for c, t in [("", "Can I have a latte, please? — idle"), ("sel", "selected (before checking)"), ("ok", "correct"), ("bad", "wrong pick"), ("dim", "not picked / used up")]) + '<p style="text-align:center;font-weight:700;margin:4px 0" class="t-lime">You got this! 🎉</p></div>'
    T(sec("patterns", "6 · Patterns", f'''
{sub("pattern-answers", "6.1 Answer tiles &amp; feedback (all task types)", f"""{tiles}
{table(["State", "Border", "Fill", "Text"], [
        ("Idle", "white/15 (1)", "white/5", "white, 500–700"), ("Pressed", "white/40", "white/5", "white"),
        ("Selected (pending check)", "cyan", "cyan/15", "white"), ("Correct", "lime-green (or lime/60 when locked)", "lime/15", "lime-green"),
        ("Wrong", "neon-pink", "pink/15 (flash 500ms on matching/sorting; stays on quiz)", "neon-pink"),
        ("Used / dimmed", "white/10", "white 3%", "white/20–40"),
    ])}
<p>Tiles: radius 16 (12 for chips/letters, 8 for small keys), padding 20×16, gap 12. Answer reveal shows the correct tile <i>and</i> the wrong pick together. Feedback line under the tiles, 700 centred: lime “You got this! 🎉” / pink “Not quite — the answer is highlighted.” The primary action (green lg, full width, “Next” / “Finish Mission”) stays disabled until the task is answered or complete. Haptic: success on correct, error on wrong.</p>""")}
{sub("pattern-forms", "6.2 Forms", "<p>Column, gap 20 (auth) / 24 (onboarding) / 16 (teacher dialogs). Field = label + input (gap 6). Form-level error and status messages sit above the submit, centred 14/600 (pink error, lime status). Submit is the screen’s primary button (pink lg on auth, green lg on onboarding, green md in dialogs). Divider “or”: two white/15 hairlines with a label-style “OR” white/40 between, gap 12.</p>")}
{sub("pattern-lists", "6.3 Lists &amp; rows", "<p>Rows are “surface rows”: radius 16, border white/10, bg surface, padding 16×12, gap 8 between rows. Title bodyStrong white (truncate), meta small white/40–50, trailing status pill or chevron. Pressed: border white/20 (or the accent at /40 for teacher mission rows). Section heading above a list: label white/50, optional hint small white/35, 12 below.</p>")}
{sub("pattern-cta", "6.4 Primary action placement", "<p>Game screens put the CTA at the bottom of the content (not floating): Map — in the bottom panel above the tab bar; tasks — after the tiles; Reward — last item; Welcome — bottom section with a ghost secondary under it. Console screens (teacher/parent) are information-first; their single action is a pill in the header (Homework) or a full-width green md button at the end of a list (Add Topic).</p>")}'''))

    # ── Screens ──────────────────────────────────────────────────────────
    m = MASCOT

    welcome = f'''<div class="ph-body ph-pad"><div style="padding-top:32px"><svg width="210" height="56" viewBox="0 0 324 87"><text x="0" y="70" font-family="Nunito" font-weight="900" font-size="80" fill="#fff">slay</text></svg>
<p style="font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;line-height:1.65;margin:4px 0"><span class="t-w60">Learn English.</span><br><span class="t-lime">Slay</span><span class="t-w60"> your goals.</span></p></div>
<div style="flex:1;display:flex;align-items:center;justify-content:center"><div style="width:280px;border-radius:24px;padding:12px;background:linear-gradient(rgba(106,0,255,.2),#111 50%);box-shadow:0 0 36px 6px rgba(255,45,142,.45);position:relative">
<img src="{m}" style="width:100%" class="ph-mascot"><span class="t-lime" style="position:absolute;top:-32px;left:8px">{icon("lightning", 24)}</span><span class="t-pink" style="position:absolute;top:-12px;right:-12px">{icon("star", 20)}</span><span class="t-pink" style="position:absolute;bottom:-12px;left:-12px">{icon("heart", 20)}</span><span class="t-cyan" style="position:absolute;bottom:12px;right:12px">{icon("sparkle", 16)}</span></div></div>
<div style="display:flex;flex-direction:column;gap:12px;padding:32px 0"><button class="btn green lg full">Let's Go! {icon("chevron-right", 18)}</button><button class="btn ghost full" style="height:56px;border-width:2px">Log In</button></div></div>'''

    def mapscreen(demo=False):
        hud = "" if demo else f'<div class="row"><span class="pill" style="background:var(--w10);color:#fff;font-size:14px;padding:6px 12px">Lvl 3 · 340 XP</span><span class="pill t-coin" style="background:var(--w10);font-size:14px;padding:6px 12px">{coin(14)}120</span></div>'
        bottom = ('<div style="border-top:1px solid var(--w10);background:rgba(17,17,17,.95);padding:12px 20px 34px"><button class="btn pink full" style="height:56px;font-size:18px">Log in to keep playing</button></div>' if demo else tab(student_tabs, 0))
        return f'''<div class="ph-body"><div class="hdr"><b style="color:var(--lime);font-weight:900;font-size:18px;text-transform:uppercase">Slay City</b>{hud}</div>
<div style="border-bottom:1px solid var(--w10);padding:8px 20px;text-align:center;font-weight:900;text-transform:uppercase;letter-spacing:.05em;font-size:14px">Downtown</div>
<div style="flex:1;min-height:0;overflow:hidden;position:relative"><div class="mapframe">
<svg style="position:absolute;inset:0;width:100%;height:100%" viewBox="0 0 100 100" preserveAspectRatio="none"><ellipse cx="22" cy="24" rx="42" ry="34" fill="#FF2D8E" opacity=".18"/><ellipse cx="82" cy="58" rx="40" ry="34" fill="#00F0FF" opacity=".14"/>
<g fill="#160a2b" stroke="#6A00FF" stroke-width=".4" stroke-opacity=".6"><rect x="-1" y="84" width="12" height="18"/><rect x="11" y="76" width="9" height="26"/><rect x="20" y="88" width="10" height="14"/><rect x="30" y="80" width="8" height="22"/><rect x="38" y="86" width="11" height="16"/><rect x="49" y="74" width="9" height="28"/><rect x="58" y="83" width="10" height="19"/><rect x="68" y="78" width="8" height="24"/><rect x="76" y="87" width="11" height="15"/><rect x="87" y="79" width="9" height="23"/></g></svg>
<span class="mapnode done" style="left:28%;top:30%">✓ Coffee Corner</span><span class="mapnode sel" style="left:62%;top:52%">City Park</span><span class="mapnode" style="left:34%;top:72%">Pet Shop</span>
<img src="{m}" class="mascot" style="left:62%;top:52%"></div></div>
<div style="border-top:1px solid var(--w10);padding:16px 20px 12px"><div class="row between" style="padding-bottom:8px"><b style="font-size:16px;font-weight:900">City Park</b><span class="pill" style="background:var(--w10);color:var(--w70)">1/3 missions</span></div>
<button class="btn green full" style="height:56px;font-size:18px">▶ Start</button></div>{bottom}</div>'''

    mission = f'''<div class="ph-body ph-pad"><div style="padding-top:24px;display:flex;flex-direction:column;gap:16px"><div class="row between"><div class="row" style="gap:12px"><span class="circle">{icon("close", 16)}</span>
<span style="width:44px;height:44px;border-radius:99px;background:#2a2340;box-shadow:0 0 0 2px rgba(157,255,0,.6),0 0 12px rgba(157,255,0,.35)"></span><span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.15em" class="t-w50">Coffee Corner</span></div>
<div class="row"><span class="circle">{icon("info", 16)}</span><b class="t-w50" style="font-size:14px">2/5</b></div></div>
<div><div class="row between" style="margin-bottom:6px"><span class="lbl">Progress</span><span style="font-size:12px;font-weight:600;color:var(--w70)">1/5</span></div><div class="track"><div class="fill" style="width:20%;background:var(--pink);box-shadow:0 0 8px 2px rgba(255,45,142,.5)"></div></div></div></div>
<div style="flex:1;display:flex;flex-direction:column;gap:24px;padding-top:16px"><h3 style="font-size:20px;font-weight:900;text-align:center;margin:0">How do you order a drink?</h3>
<div style="display:flex;flex-direction:column;gap:12px"><div class="tile ok">Can I have a latte, please?</div><div class="tile bad">Give coffee!</div><div class="tile">I want the brown drink.</div><div class="tile">Hello, one coffee.</div></div>
<p style="text-align:center;font-weight:700;margin:0" class="t-pink">Not quite — the answer is highlighted.</p><button class="btn green lg full">Next</button></div>
<p style="text-align:center;font-size:12px;text-decoration:underline;padding:8px 0 30px" class="t-w40">Skip this task</p></div>'''

    rain = "".join(f'<span style="position:absolute;left:{(i * 37) % 100}%;top:{(i * 53) % 90}%;width:{6 + i % 8}px;height:{6 + i % 8}px;border-radius:99px;background:{["#FF2D8E", "#9DFF00", "#00F0FF", "#6A00FF", "#FACC15"][i % 5]};box-shadow:0 0 8px {["#FF2D8E", "#9DFF00", "#00F0FF", "#6A00FF", "#FACC15"][i % 5]};opacity:.8"></span>' for i in range(30))
    reward = f'''<div class="ph-body ph-pad" style="justify-content:center;gap:24px;text-align:center;position:relative;overflow:hidden">{rain}
<h1 style="position:relative;font-size:40px;font-weight:900;text-transform:uppercase;line-height:1;margin:0;color:var(--lime);text-shadow:0 0 12px rgba(157,255,0,.9),0 0 28px rgba(157,255,0,.55)">Awesome!</h1>
<div style="position:relative;align-self:center;border-radius:24px;padding:12px;background:linear-gradient(135deg,rgba(0,240,255,.25),rgba(157,255,0,.25));box-shadow:0 0 0 2px rgba(157,255,0,.35)"><img src="{m}" width="200" class="ph-mascot"></div>
<div style="position:relative;display:grid;grid-template-columns:1fr 1fr;gap:12px"><div style="border-radius:16px;background:var(--w5);padding:20px 0;display:flex;flex-direction:column;align-items:center;gap:6px">{coin(40)}<b class="t-coin" style="font-size:24px;font-weight:900">+30</b><span class="lbl" style="font-size:12px">Coins</span></div>
<div style="border-radius:16px;background:var(--w5);padding:20px 0;display:flex;flex-direction:column;align-items:center;gap:6px">{xp(40)}<b class="t-cyan" style="font-size:24px;font-weight:900">+50</b><span class="lbl" style="font-size:12px">XP</span></div></div>
<div style="position:relative"><span class="lbl" style="font-size:12px">Mission Complete</span><p style="font-size:16px;font-weight:900;margin:2px 0">Order at the café</p></div>
<div style="position:relative;border-radius:16px;border:2px solid var(--lime);background:rgba(157,255,0,.1);padding:12px 16px;text-align:left"><b class="t-lime" style="text-transform:uppercase;font-weight:900">✓ Coffee Corner complete!</b><p style="font-size:12px;margin:2px 0" class="t-w70">You've finished every mission here. Head back to the map to pick your next stop.</p></div>
<button class="btn green lg full" style="position:relative">Claim Reward</button></div>'''

    def wcard(name, state):
        top = f'<div style="aspect-ratio:1;border-radius:12px;background:var(--w5);display:flex;align-items:center;justify-content:center;font-size:36px">{"🧢" if "Cap" in name or "Crown" in name else "🕶️"}</div>'
        btn = {"on": '<span style="border:1px solid var(--w20);border-radius:8px;font-size:11px;font-weight:600;color:var(--w70);padding:4px;text-align:center">Unequip</span>',
               "own": '<span style="background:var(--lime);border-radius:8px;font-size:11px;font-weight:700;color:#111;padding:4px;text-align:center">Equip</span>',
               "buy": f'<span style="background:var(--pink);border-radius:8px;font-size:11px;font-weight:700;color:#111;padding:4px;text-align:center" class="row" >{coin(12)}150</span>',
               "lock": '<span style="border:1px solid var(--w15);border-radius:8px;font-size:11px;font-weight:600;color:var(--w50);padding:4px;text-align:center">🔒 Lvl 5</span>'}[state]
        badge = '<span style="position:absolute;right:8px;top:8px;background:var(--lime);color:#111;border-radius:99px;font-size:10px;font-weight:700;padding:2px 6px">ON</span>' if state == "on" else ""
        return f'<div style="position:relative;display:flex;flex-direction:column;gap:8px;border-radius:16px;border:1px solid {"var(--lime)" if state == "on" else "var(--w15)"};background:var(--w5);padding:8px;{"opacity:.6;" if state == "lock" else ""}">{top}<span style="font-size:12px;font-weight:500;text-align:center;color:var(--w80)">{name}</span>{btn}{badge}</div>'

    wardrobe = f'''<div class="ph-body"><div class="hdr" style="padding:16px 24px"><b style="font-size:20px">Wardrobe</b><span class="row t-coin" style="font-weight:700">{coin(16)}120</span></div>
<div style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:24px 24px 8px"><div style="width:160px;height:160px;border-radius:99px;background:var(--w5);box-shadow:0 0 0 1px var(--w10);padding:12px"><img src="{m}" style="width:100%;height:100%" class="ph-mascot"></div><span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em" class="t-w40">Your look</span></div>
<div style="flex:1;min-height:0;overflow:hidden;padding:24px"><h4 style="margin:0 0 12px;font-size:14px;color:var(--w50)">Hats</h4><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">{wcard("Red Cap", "on")}{wcard("Crown", "buy")}{wcard("White Cap", "own")}</div>
<h4 style="margin:24px 0 12px;font-size:14px;color:var(--w50)">Glasses</h4><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">{wcard("Star Glasses", "lock")}{wcard("Aviators", "buy")}{wcard("Round", "own")}</div></div>{tab(student_tabs, 1)}</div>'''

    profile = f'''<div class="ph-body"><div class="hdr" style="justify-content:center;padding:16px 24px"><b style="font-size:20px">Profile</b></div>
<div style="flex:1;display:flex;flex-direction:column;gap:20px;padding:24px"><div style="display:flex;flex-direction:column;align-items:center;gap:8px"><div style="width:96px;height:96px;border-radius:99px;background:var(--w5);box-shadow:0 0 0 2px var(--lime);padding:8px"><img src="{m}" style="width:100%" class="ph-mascot"></div>
<b style="font-size:20px;font-weight:900">mia_slays</b><span class="t-w50" style="font-size:14px">mia@example.com</span><span class="pill" style="border:1px solid var(--w15);color:var(--w60);font-size:11px;text-transform:uppercase;letter-spacing:.12em">Student</span></div>
<div style="border-radius:16px;border:1px solid var(--w10);background:var(--w5);padding:16px" class="row between"><span><span class="lbl">English level</span><br><b class="t-lime">Elementary</b></span><span class="pill" style="border:1px solid var(--w20);color:var(--w60);text-transform:uppercase">Change</span></div>
<div style="border-radius:16px;border:1px solid var(--w10);background:var(--surface);padding:16px"><span class="lbl">Language</span><div class="row wrap" style="margin-top:10px"><span class="pill" style="border:1px solid var(--lime);background:rgba(157,255,0,.15);color:var(--lime);font-size:14px;padding:8px 16px">English</span><span class="pill" style="border:1px solid var(--w15);color:var(--w70);font-size:14px;padding:8px 16px">Українська</span><span class="pill" style="border:1px solid var(--w15);color:var(--w70);font-size:14px;padding:8px 16px">Русский</span></div></div>
<div style="margin-top:auto;display:flex;flex-direction:column;gap:12px"><div class="row" style="justify-content:center;border:1px solid rgba(0,240,255,.4);border-radius:16px;padding:14px;color:var(--cyan);font-weight:600;font-size:14px">{icon("feedback", 18)} Feedback &amp; Bugs</div><div class="row" style="justify-content:center;border:1px solid rgba(255,45,142,.4);border-radius:16px;padding:14px;color:var(--pink);font-weight:600;font-size:14px">{icon("logout", 18)} Log out</div></div></div>{tab(student_tabs, 3)}</div>'''

    homework = f'''<div class="ph-body ph-pad"><div style="padding:32px 0 16px"><h2 style="font-size:20px;font-weight:900;margin:0">Homework</h2><p class="t-cyan" style="font-size:12px;font-weight:700;text-transform:uppercase;margin:4px 0 0">Group 5B</p><p class="t-w50" style="font-size:12px;margin:2px 0">Practice what your teacher assigned.</p></div>
<div style="flex:1;display:flex;flex-direction:column;gap:8px">''' + "".join(f'''<div style="border-radius:16px;border:1px solid var(--w10);background:var(--surface);padding:16px"><p class="t-w40" style="font-size:11px;font-weight:700;text-transform:uppercase;margin:0">By Ms. Olena</p><div class="row" style="margin-top:4px"><b style="font-size:14px">{t}</b>{'<span class="pill" style="background:var(--pink);color:#fff;font-size:11px;padding:2px 6px">2</span>' if u else ''}</div><p class="t-w50" style="font-size:12px;margin:2px 0 0">Words and phrases for the unit.</p><div class="row between" style="margin-top:12px"><span style="font-size:12px;font-weight:700;text-transform:uppercase" class="{c}">{s}</span><span class="pill" style="background:var(--w10);color:#fff">{a}</span></div></div>''' for t, u, c, s, a in [("Food & Drinks", True, "t-cyan", "1/2 passed", "Continue"), ("Animals", False, "t-lime", "Completed", "Review"), ("My Family", False, "t-cyan", "0/2 passed", "Start")]) + f'</div>{tab(student_tabs, 2)}</div>'

    teacher = f'''<div class="ph-body ph-pad"><div class="row between" style="padding:20px 0"><div><h2 style="font-size:20px;font-weight:900;margin:0">Teacher Dashboard</h2><p style="font-size:12px;margin:0">Ms. Olena</p><p class="t-w50" style="font-size:12px;margin:0">2 groups</p></div><span class="pill" style="border:1px solid rgba(255,45,142,.4);color:var(--pink);padding:8px 14px">{icon("logout", 16)} Log Out</span></div>
<div class="row between" style="margin-bottom:8px"><span class="lbl">Group 5B</span><span class="row"><b class="t-w40" style="font-size:12px">3 students</b><span class="pill" style="border:1px solid rgba(157,255,0,.5);color:var(--lime);font-size:10px;font-weight:900;text-transform:uppercase">Homework</span></span></div>
<div style="display:flex;flex-direction:column;gap:8px;flex:1">''' + "".join(f'<div class="row between" style="border-radius:16px;border:1px solid var(--w10);background:var(--surface);padding:12px 16px"><b style="font-size:14px">{n}</b><span class="row"><span style="border-radius:12px;background:var(--w5);padding:6px 10px;text-align:center;line-height:1"><b>{tp}</b><br><span style="font-size:10px;text-transform:uppercase;color:var(--w40)">Topics</span></span><span style="border-radius:12px;background:var(--w5);padding:6px 10px;text-align:center;line-height:1"><b>{ms}</b><br><span style="font-size:10px;text-transform:uppercase;color:var(--w40)">Missions</span></span><span class="t-w40">{icon("chevron-down", 18)}</span></span></div>' for n, tp, ms in [("mia_slays", "2/3", 14), ("tymur", "1/3", 9), ("sofiia.k", "3/3", 21)]) + f'</div>{tab(console_tabs, 0)}</div>'

    parent = f'''<div class="ph-body ph-pad" style="overflow:hidden"><div class="row between" style="padding:20px 0"><div><h2 style="font-size:20px;font-weight:900;margin:0">Dashboard</h2><p class="t-w50" style="font-size:12px;margin:0">Progress of mia_slays</p></div><span class="pill" style="border:1px solid rgba(255,45,142,.4);color:var(--pink);padding:8px 14px">{icon("logout", 16)} Log out</span></div>
<div class="row" style="gap:16px;border-radius:16px;border:1px solid var(--w10);background:var(--surface);padding:16px"><div style="width:80px;height:80px;border-radius:99px;background:var(--w5);box-shadow:0 0 0 2px var(--lime);padding:6px;flex-shrink:0"><img src="{m}" style="width:100%" class="ph-mascot"></div><div><b style="font-size:18px;font-weight:900">mia_slays</b><p class="t-w50" style="font-size:12px;margin:2px 0">English level: <b style="color:var(--w80)">Elementary</b></p><p class="row" style="font-size:14px;font-weight:700;margin:2px 0"><span class="row t-cyan">{icon("xp", 14)}340</span><span class="row t-coin">{coin(14)}120</span></p><p class="t-w40" style="font-size:12px;margin:0">Last active: today</p></div></div>
<div style="margin-top:16px;border-radius:16px;border:1px solid rgba(255,45,142,.4);background:linear-gradient(135deg,rgba(255,45,142,.15),transparent);padding:20px"><span class="lbl" style="color:var(--w60)">Vocabulary learned</span><p style="margin:4px 0 0" class="row"><b class="t-pink" style="font-size:48px;line-height:1;font-weight:900">86</b><b style="font-size:16px;color:var(--w80)">words</b></p></div>
<div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:12px">''' + "".join(f'<div style="border-radius:16px;border:1px solid var(--w10);background:var(--surface);padding:16px"><span class="lbl">{l}</span><br><b class="{c}" style="font-size:30px;font-weight:900;line-height:1">{v}</b></div>' for l, v, c in [("Missions completed", 14, "t-lime"), ("Tasks completed", 61, "t-purple"), ("Current streak", "4 days", "t-pink"), ("Longest streak", "9 days", "t-cyan")]) + f'</div><div style="flex:1"></div>{tab(console_tabs, 0)}</div>'

    login = f'''<div class="ph-body ph-pad" style="justify-content:center;position:relative;overflow:hidden"><span style="position:absolute;top:-80px;left:-64px;width:256px;height:256px;border-radius:99px;background:rgba(106,0,255,.4);filter:blur(60px)"></span><span style="position:absolute;top:33%;right:-96px;width:288px;height:288px;border-radius:99px;background:rgba(255,45,142,.25);filter:blur(60px)"></span><img src="{m}" style="position:absolute;bottom:-48px;right:-56px;width:288px;opacity:.15;filter:blur(2px);transform:rotate(6deg)">
<div style="position:relative;display:flex;flex-direction:column;gap:20px"><h1 style="text-align:center;font-size:28px;font-weight:900;margin:0">Log <span class="t-pink">In</span></h1><div style="display:flex;flex-direction:column;gap:12px"><span class="lbl">Email</span><input class="inp" placeholder="you@example.com"><span class="row between"><span class="lbl">Password</span><span class="t-cyan" style="font-size:12px;font-weight:600">Forgot password?</span></span><input class="inp" placeholder="••••••••"></div>
<button class="btn pink lg full">Log In</button><div class="row"><span style="flex:1;height:1px;background:var(--w15)"></span><span class="lbl t-w40">or</span><span style="flex:1;height:1px;background:var(--w15)"></span></div><button class="btn ghost lg full" style="font-size:16px">G&nbsp; Continue with Google</button>
<p class="t-w50" style="text-align:center;font-size:14px;margin:0">New to Slay City? <b class="t-cyan">Create an account</b></p><p class="t-w50" style="text-align:center;font-size:14px;font-weight:600;margin:12px 0 0">← Back</p></div></div>'''

    T(sec("screens-gallery", "7 · Screens at a glance", '<p class="lead">390×844 mockups built from the tokens above (zoomed to 72%). They show composition, hierarchy and the one primary action; the per-screen sections give the exact values. Sample content is illustrative.</p><div class="phones">' +
          phone(welcome, "Welcome — signed out (one CTA: Let’s Go!)") + phone(login, "Log in") + phone(mapscreen(), "Student map") + phone(mission, "Mission — quiz task after a wrong pick") +
          phone(reward, "Reward — “Awesome!” theme, location milestone") + phone(wardrobe, "Wardrobe") + phone(profile, "Profile") + phone(homework, "Homework list") +
          phone(teacher, "Teacher dashboard") + phone(parent, "Parent dashboard (top)") + phone(mapscreen(True), "Demo map — tab bar replaced by one log-in CTA") + "</div>"))

    # per-screen specs
    S = []
    S.append(sub("screen-welcome", "8.1 Welcome (signed out)", table(["Part", "Spec"], [
        ("Route", "web <code>/</code> → <code>app/index.tsx</code> when signed out"),
        ("Top", "Section py lg, gap 8: logo 56 tall (left −8) with shimmer; subtitle typewriter (two lines, layout reserved up front)."),
        ("Hero", "centred, max 280: frame radius 24, padding 12, gradient purple/20→black→black, glow-pulse; slay-hero image square contain. Decorations: lightning lime 24 (top −32, left 8), star pink 20 (top-right −12), heart pink 20 (bottom-left −12), sparkle cyan 16 (bottom-right 12)."),
        ("Actions", "Section py lg gap 12: <b>“Let's Go!”</b> + chevron — green, 64 tall, 18/800 → demo map. <b>“Log In”</b> — 56 tall, border 2 white/25, 16/800 → login."),
    ])))
    S.append(sub("screen-auth", "8.2 Auth — login, register, forgot, reset", table(["Part", "Spec"], [
        ("Layout", "AppContainer centred vertically; AuthBackdrop behind: blobs purple/40 (256, top-left), pink/25 (288, right third), lime/15 (256, bottom), blur ~64; base mascot 288 bottom-right −48/−56, rotate 6°, opacity 15%, blur 2."),
        ("Title", "h1/900 centred, last word neon-pink: “Log <i>In</i>” / “Sign <i>Up</i>”."),
        ("Fields", "Email (you@example.com) · Password (••••••••, “Forgot password?” cyan 12/600 link on the label row, login only) · Confirm Password (register) · “I am a” role grid Student / Parent (register) · Student’s Email + hint “We'll link your student's account so you can follow their progress.” (parent only)."),
        ("Actions", "Submit pink lg full: “Log In” / “Create Account”. Divider OR. Ghost lg with Google logo: “Continue with Google” / “Sign up with Google”. Switch line small white/50 + cyan link: “New to Slay City? Create an account” / “Already have an account? Log in”. “← Back” under the form (not after the demo)."),
        ("After demo", "Lime notice card above the form: border 2 lime, bg lime/10, 16 padding — title 16/900 uppercase lime, body 14 white/80, ghost 48 button “back to the demo” (translated)."),
        ("Forgot / reset", "Same shell and field skin; one field + pink lg submit; status in lime, errors in pink."),
    ])))
    S.append(sub("screen-onboarding", "8.3 Onboarding (create profile)", table(["Part", "Spec"], [
        ("Title", "“Create Your <span class=t-pink>Profile</span>” h1/900 centred."),
        ("Fields", "Username (placeholder “Enter your name”) · Age <i>(optional)</i> (placeholder “5-99”) · Level: LevelPicker radio rows + locked-levels note (small white/40). No levels: white/15 card “No levels are open yet — you'll be able to pick one as soon as the city has content.”"),
        ("Actions", "Green lg submit full width; under the form “Not you? Log out” small white/40 underlined (the only way out)."),
    ])))
    S.append(sub("screen-map", "8.4 City map (student)", table(["Part", "Spec"], [
        ("Structure", "Full screen, no page scroll: Map HUD header → district bar → map area (flex 1) → bottom panel → tab bar."),
        ("Map area", "Frame fixed at 5:7 (<code>MAP_ASPECT</code>), full width, top-aligned, never cropped differently from the admin picker (positions are % of the frame). The same district art fills the area behind it, scaled 1.1, blurred (~24), 40% opacity, so no black bars. Inline loader until the art decodes, then fade-in 500ms. No art → fallback MapBackground SVG."),
        ("Location label", "Pill at (x%, y%) centred: 14×6 padding, max 38% screen width, 12/800 uppercase tracking .05em, border 2. Unlocked: bg black/55, border white/25, white, glow lime. Completed: border lime/50, lime text, “✓ Name”. Selected: bg black/70, border pink, glow-pulse. Each floats (label-float, staggered). Pressed scale .95."),
        ("Mascot marker", "Above the selected label (bottom 20 above its centre), 56–88 (≈74 at 390), bob + shadow, glides 700ms ease-in-out between stops; tap = hiss; the wrapper never blocks label taps."),
        ("Milestone banner", "Top of map area: pill border 2 lime, bg black/85, 14/800 lime, glow; banner-drop; hides after 4.5s. Copy: “🏆 Level cleared! Welcome to {level}.” · “🏙️ District cleared! Welcome to {district}.” · “✓ {location} complete!”"),
        ("Bottom panel", "Top divider, 20 side / 16 top padding: name 16/900 + mission count pill (“1/3 missions”, lime when done). Collapsing reward line when the stop is cleared: “🪙 +30 · ⚡ +50 earned”. CTA row: “▶ Start” green 56 (+ mission-start sound) / disabled outline “✓ Completed” or “Coming soon” (border 2 lime/40, lime/70) + 56pt restart square (border 2 white/20) sliding in for cleared stops. Height changes animate 300ms."),
        ("Level cleared", "Card above the panel: border 2 lime, bg lime/10 — “🏆 {level} cleared!” + explanation + outline lime “↻ Play this level again” (confirm)."),
        ("Pan / zoom", "WP-3.1 lists pan and zoom; the web has neither. If built: pinch 1×–2× on the frame only, labels and mascot scale with it, double-tap resets. Default view must equal the web frame."),
    ])))
    S.append(sub("screen-mission", "8.5 Mission player", table(["Part", "Spec"], [
        ("Container", "AppContainer fixedHeight: header (Section pt lg pb sm, gap 16) → task area (flex 1, scrolls) → “Skip this task” → status."),
        ("Header", "Exit circle (confirm) · location icon 44 with lime ring + glow · eyebrow location name · info button (how-to-play tooltip) · “2/5”. ProgressBar pink under it, hidden for immersive types (snake_game, bubble_pop)."),
        ("Task area", "TaskRunner renders the type (§9). Unknown/malformed content: “This task type isn't available yet — skip ahead.” white/60 + green lg “Skip”."),
        ("Footer", "“Skip this task” small white/40 underlined (confirm) — hidden while submitting. Submitting: “Saving your rewards…” pulse. Error: pink message + pink “Try Again”."),
        ("Labels", "Action label: “Next”, last task “Finish Mission” (review: “Finish Review”)."),
        ("Review mode (teacher)", "Same screen, nothing recorded; end card h2 title + “That's every task in this mission. Reviews aren't recorded — no progress, XP or coins were given.” + green “Next: {mission}”, ghost “Play Again”, ghost “Back”."),
        ("Empty", "h2 title + “This mission has no tasks yet.” + ghost “Back to Map”."),
    ])))
    S.append(sub("screen-reward", "8.6 Reward", table(["Part", "Spec"], [
        ("Theme", "Random each time, never the same twice in a row (store last index): Amazing! pink · Awesome! lime · Legendary! cyan · Fantastic! orange · Incredible! purple · Iconic! coin-yellow · Unstoppable! lime · Slay! pink. Theme sets headline colour + glow and the mascot frame gradient/ring."),
        ("Stack", "Centred column gap 24: headline display/900 uppercase with glow (pop then pulse) → mascot lg 200, wiggle, frame radius 24 padding 12 ring 2 → two reward cards (2-col, gap 12: radius 16 white/5, 20 vertical; 40pt icon, +n 24/900 coin-yellow / cyan, label small/700 uppercase white/50 “Coins” / “XP”) → “Mission Complete” + title h3/900 → task names joined “ · ” white/60 → milestone card or “n/m missions done at {location} — keep going!” → <b>“Claim Reward”</b> green lg full."),
        ("Milestone cards", "border 2 lime, bg lime/10, 16×12: “🏆 {level} cleared!” / “🏙️ District cleared!” / “✓ {location} complete!” + small white/70 explanation (copy in web RewardScreen.tsx)."),
        ("Background", "48 brand-coloured dots (pink, lime, cyan, purple, coin-rain) 6–14pt with glow fall continuously; hidden with reduced motion."),
        ("Sound / haptic", "Applause + fireworks once on land; success haptic."),
        ("Entrances", "headline .5s pop · mascot .6s pop (+.1s) · cards/recap/tasks/banner/CTA rise at .25/.35/.45/.5/.55s."),
    ])))
    S.append(sub("screen-wardrobe", "8.7 Wardrobe", table(["Part", "Spec"], [
        ("Header", "Centred-title variant, left-aligned “Wardrobe” 20/700, coins right (coin-yellow)."),
        ("Preview", "160 circle, bg white/5, ring 1 white/10, padding 12, mascot with the equipped look, lookFloat; caption “Your look” 11/600 uppercase white/40."),
        ("Grid", "Per category (Hats, Glasses, Accessories): heading 14/700 uppercase white/50, 3 columns gap 12."),
        ("Item card", "radius 16, border white/15 (lime when equipped), bg white/5, padding 8, gap 8: square image well (radius 12, white/5; art contain with 4 inset; else category emoji 36) · name 12/500 white/80 centred · action. “ON” badge lime top-right when equipped."),
        ("Actions", "Equipped: “Unequip” outline (border white/20, 11/600 white/70). Owned: “Equip” lime fill black. For sale: pink fill, black text, coin + price; disabled at 50% when unaffordable. Level-locked: outline “🔒 Lvl n”, whole card 60%. Busy card shows “…”. Errors in the pink banner under the preview."),
        ("Empty", "“No items in the shop yet. Check back soon!” small white/40 centred."),
    ])))
    S.append(sub("screen-profile", "8.8 Profile (student) &amp; level card", table(["Part", "Spec"], [
        ("Header", "Centred “Profile” 20/700 (translated)."),
        ("Identity", "96 mascot circle (white/5, ring 2 lime) · username 20/900 · email 14 white/50 · role badge."),
        ("Cards (gap 32)", "Username card (student) · Level card · Placement card · Language picker · then at the bottom Feedback &amp; Bugs (outline cyan/40) and Log out (outline pink/40), both 14/600 with 18 icons, radius 16, 14 vertical."),
        ("Inline-edit card", "radius 16, border white/10, bg white/5, 16: label + value (lime for level) + outline pill “Change” / “Cancel”. Opening reveals the input or LevelPicker; saving shows small lime confirmation; errors small pink."),
    ])))
    S.append(sub("screen-placement", "8.9 Placement test (“What's my English level?”)", table(["Part", "Spec"], [
        ("Intro", "Mascot shell; title 30/900 “What's my English level?”; rules card (radius 16, border white/10, bg white/5): 📝 n questions · 👆 Pick the word that fits the gap · 🤷 Too hard? Tap “I don't know” · 🏁 You can finish at any time. Pink lg “Start the test”; “← Back to profile”."),
        ("Question", "Header: “← Back” · level badge (purple/30, cyan 11/700 uppercase) · “Finish now” neon-orange; ProgressBar cyan, no animation, “3 / 30”. Prompt 24/900 centred with the gap drawn as a 56-wide cyan underline (border 4). Answers: full-width tiles radius 16 border 2, 20×14, 20/700 — idle white/15 + white/5, picked lime/15 + lime + answer-pick, others dim to 40%. “I don't know” outline pill. Advance after 450ms (200ms for skip) with question-in. Footer “n answered”."),
        ("Result", "Label “Your English level” · level 36/900 lime · “x of y answers right (p%)” · per-level score bars (green passed / pink not, 8 tall, “✓ Level”, “c/t”) · note 11 white/40 · pink lg “Play {level}” / “Go to the map” · “Take the test again” text button."),
    ])))
    S.append(sub("screen-homework", "8.10 Homework (student)", table(["Part", "Spec"], [
        ("List", "Title h2/900 “Homework”, group names 12/700 uppercase cyan, “Practice what your teacher assigned.” small white/50. Topic rows (surface row): eyebrow “By {teacher}” 11/700 uppercase white/40 · title bodyStrong + unread badge · description 2 lines small white/50 · footer: status 12/700 uppercase (cyan “1/2 passed”, lime “Completed”, white/50 “Nothing to study yet”) + white/10 pill “Start / Continue / Review”. Empty: “No homework yet. Check back once your teacher assigns some.”"),
        ("Topic", "“← Homework” · h2 title · description. Note card (image radius 12, text small white/70, link cyan bold). Module cards: radius 16, border cyan/30, bg cyan/5 — “Learn the Words” / “Learn the Grammar”, subtitle “n words + test”, pill cyan “Start” or lime “Passed ✓”. Q&amp;A section below."),
        ("Flow intro", "“← {topic}” · h2 “Learn the Words” · “n words to study, then a k-task test.” · success notice if passed · green lg “Start” / “Study Again”."),
        ("Word card", "SlayCard cyan centred gap 16: image 160 radius 16 · word h2/900 · transcription 18/600 white/60 · translation 18/600 cyan · “🔊 Listen” outline pill (border white/20, bg white/5) → expo-speech en-US 0.9 · green lg “Next” / “Start Test” / “Finish”."),
        ("Grammar card", "SlayCard cyan gap 16: title h3/900 · explanation body white/80 · example box (radius 12, border white/10, bg white/5: “EXAMPLE” 11/700 white/40 + 18/600 cyan)."),
        ("Flow header", "Flow header variant (“Word 2 of 5” / “Word Test”), pink progress."),
        ("Done", "64 circle lime/15 with 🎉 · h2 “Words passed!” · “You learned every word and finished the test. Your teacher can see it too.” · XP chip (cyan/10, “+20 XP”) · green “Study Again” + ghost “Back to Topic” side by side."),
        ("Q&amp;A chat", "Card radius 16 surface padding 12: message list (max 288, scroll): meta line 11/700 white/50 name (“You”) + pink “TEACHER” badge + 10 white/30 time; bubble radius 16, 12×8, small, max 85%: mine cyan/15 (right), teacher pink/10, others white/5 white/80. Own messages: long-press → delete (web shows a × on hover). Composer: textarea + green sm “Send”. Empty: “No messages yet. Ask a question or leave a note — everyone in the group will see it.”"),
    ])))
    S.append(sub("screen-demo", "8.11 Signed-out demo", "<p>Same map and mission player. Map HUD has no scoreboard; restart/replay hidden; the tab bar is replaced by a bar (black/95, top divider, 20×12, bottom 32 + inset) with one pink 56 button (translated log-in label). Finishing the demo location lands on the login screen with the lime “demo gate” notice. Demo chrome follows the device language.</p>"))
    T(sec("screens", "8 · Student screens", "".join(S)))

    # ── Tasks ────────────────────────────────────────────────────────────
    TASKS = [
        ("vocabulary", "Vocabulary", "Read-only word card: SlayCard cyan — image 160 · word h2 · translation 18/600 cyan · example italic white/70. Next.", "tap"),
        ("matching", "Matching", "Prompt h3. Two columns (gap 12) of 64-tall tiles radius 16: words left, translations or images right. Tap word (cyan) → tap match; correct pair locks lime, wrong flashes pink 500ms.", "tap"),
        ("quiz", "Quiz", "Question h2 centred · optional image 192 · option tiles stacked · reveal correct + wrong · feedback line.", "tap"),
        ("snake_game", "Play Snake Game", "Immersive. Prompt 18/700 + translation cyan; letter strip; square grid (cells radius 3, letters cyan/20 border cyan/40, empty white 4%); D-pad 3×3 of 56 squares (radius 12, border white/20, bg white/7, pressed cyan/20). Overlays on black/80: “Ready?” → green; “Oops! Game over.” pink; word in lime + “You collected every letter!”. Tick 260ms, edges wrap.", "timed"),
        ("word_scramble", "Word Scramble", "Optional image 128. Answer slots 36×44 dashed white/20 grouped per word, in a black/30 tray; letter tiles 40×48 radius 12 (white/10, border white/20); placed tiles cyan/10; row turns lime when right.", "tap"),
        ("hangman", "Hangman", "Emoji face stage (😀→💀, 48) · blanks 32×44 with bottom border 2 · keyboard grid 7 cols of 40-tall keys radius 8; used-right lime/10, used-wrong pink/10 at 50%. Six misses restarts.", "tap"),
        ("bubble_pop", "Bubble Pop", "Immersive. Tray (radius 16, border white/10, bg black/20) of round bubbles ≥72, border 2, rotating pink/cyan/purple/lime tints, gentle bounce; wrong pop pulses pink/40; popped vanish.", "timed"),
        ("memory_cards", "Memory Cards", "4-col grid of 3:4 cards radius 12 border 2: back purple/30 (text hidden), flipped cyan/15, matched lime/15. Mismatch flips back after a beat.", "tap"),
        ("emoji_decode", "Emoji Decode", "Emoji rebus 48 (EmojiText) · option tiles · reveal.", "tap"),
        ("word_search", "Word Search", "Letter grid of 28 cells; tap first then last letter; found words lock lime; word list chips under the grid; can finish early (partial reward).", "special"),
        ("crossword", "Crossword", "Numbered grid of 36 cells (radius 3, white/10, border white/25, caret pink); Across / Down clue lists; Check → right cells lime, wrong pink until edited.", "text"),
        ("category_sort", "Category Sort", "Word tray (black/30) of chips radius 12; picked chip cyan/20 + ring; bucket cards radius 16 border 2; correct drop shows a lime chip inside the bucket; wrong bucket flashes pink.", "tap"),
        ("odd_one_out", "Odd One Out", "2-col option tiles, h2 words; reveal.", "tap"),
        ("sentence_builder", "Sentence Builder", "Answer tray of chips (radius 12, cyan/10 border cyan/60) + pool chips (white/10); used pool chips fade to white 3%; tray turns lime when correct.", "tap"),
        ("fill_blank", "Fill in the Blank", "Sentence with the gap (___) drawn as an underline; 2-col option tiles or a SlayInput + Check (pink/green feedback).", "text"),
        ("spelling_bee", "Spelling Bee", "96 speaker button (🔊 36) plays authored audio or expo-speech; SlayInput; Check.", "text"),
        ("true_false", "True or False", "Statement h3 · optional image 160 · two big tiles (2-col, 24 vertical, h3/900): True lime/40 border lime/5 bg, False pink/40 + pink/5; after answer: picked solid tint, other dims.", "tap"),
        ("flashcards", "Flashcards", "Large card radius 24 border 2: front cyan (gradient cyan/25→black→purple/25, blurred cyan/purple blobs), back lime (lime/25→black→pink/25); image 112–176; flip = rotateY 0→90°, swap, −90→0 (260ms per half). Step through all cards.", "tap"),
        ("story_sequencing", "Story Sequencing", "Rows with up/down 28 arrow buttons; Check → lime / pink; advance when correct.", "tap"),
        ("counting_game", "Counting Game", "4-col emoji grid (36) · number option tiles h2.", "tap"),
        ("simon_sequence", "Simon Sequence", "2-col tiles radius 16 border 2, 32 vertical: pink/cyan/lime/purple at /20–/30; lit = solid fill, black text, scale 1.05 (150ms). Wrong tap replays.", "timed"),
        ("reaction_tap", "Speed Tap", "Timer bar (6 tall, cyan, linear) · tray of word pills (radius full, border 2): tapped-right lime/15, tapped-wrong pink/40, missed-right lime/5 lime/70 at the end.", "timed"),
        ("picture_reveal", "Picture Reveal", "Image 192 blurred 20 → 12 → 6 per “Reveal more”; options; answering removes the blur.", "tap"),
        ("rhyme_match", "Rhyme Match", "Target word h1 · 2-col option tiles.", "tap"),
        ("letter_fill", "Missing Letters", "Word slots 40×48 radius 12; shuffled letter bank; fill in order.", "tap"),
        ("dialogue_choice", "Pick the Reply", "Chat: 36 avatar circle (white/10) + bubble radius 16 with tail corner (tl 2), white/5 border white/15; reply bubbles right-aligned max 85% (tr 2) cyan/10 border cyan/40; reveal lime / pink.", "tap"),
        ("cause_effect", "Cause &amp; Effect", "Cause card h3 · stacked option tiles.", "tap"),
        ("analogy", "Analogies", "“A is to B as C is to ___” h3 · 2-col option tiles.", "tap"),
        ("antonym_match", "Antonym Match", "Word h1 · 2-col option tiles.", "tap"),
        ("size_order", "Size Order", "Tap items into the answer tray in order; tapping a placed chip returns it.", "tap"),
        ("spot_the_difference", "Spot the Difference", "Emoji grid (24); tap the impostor; wrong tap flashes.", "tap"),
        ("clock_reading", "Clock Reading", "Analog clock 176 (12 ticks, hands) · 2-col time tiles (radius 16, 20 vertical, bodyStrong).", "tap"),
    ]
    T(sec("tasks", "9 · Task types (32)", '<p class="lead">All share §6.1 answer-tile states, a green lg full-width action at the end, and the how-to-play text from <code>taskTypeInstructions</code> (packages/core). Tier column = native work-package grouping (tap → WP-3.3, timed → WP-3.4, text → WP-3.5, special/snake → WP-3.6).</p>' +
          table(["type", "Label", "Look &amp; behaviour", "Tier"], [(code(a), b, c, d) for a, b, c, d in TASKS]) +
          '<div class="note">Text-input tasks: keyboard must not cover the input — wrap the task area in KeyboardAvoidingView and scroll the field into view; <code>autoCapitalize="none"</code>, <code>autoCorrect={false}</code>, <code>spellCheck={false}</code> (spelling is the lesson).</div>'))

    # ── Teacher ──────────────────────────────────────────────────────────
    T(sec("teacher", "10 · Teacher console", table(["Screen", "Spec"], [
        ("Dashboard <code>/teacher</code>", "ScrollScreen + teacher tab bar. Console header “Teacher Dashboard”, name (small white), “n groups” (white/50), logout pill. Per group: label row with group name, “n students” 12/700 white/40, lime outline pill “HOMEWORK” → group. Student rows = expandable rows: username + stat chips Topics “2/3” and Missions; expanded: “Level test: Elementary (18/30) · 01/10/2026” cyan or “not taken yet”; topic chips lime/15 “✓ Title” or white/5 “○ Title”. Empty: 48 cyan/10 circle with group icon, “No groups assigned yet”, “An admin will assign your groups of students. They'll appear here once set up.”"),
        ("Group <code>/teacher/groups/[id]</code>", "TeacherHeader (back, group name, logout). “Lesson Topics (n)” label. Topic rows (surface) with word/grammar counts and unread badge, tap → topic. Empty “No topics yet. Add the first one below.” Green md full “Add Topic” opens the dialog: Topic Title, Description (optional), info note about Q&amp;A, Link (optional, https://...), Image (optional) picker; green “Add Topic” + ghost “Cancel”."),
        ("Topic editor", "TeacherHeader with topic title. Collapsible sections (purple/30 border, purple/5): <b>Topic Info</b> (edit form, green sm Save) · <b>Vocabulary Learning</b> (“Words the group learns as flashcards, plus an auto-built test to check them.”) · <b>Grammar Learning</b> (“…an AI-built test…”) · Q&amp;A section."),
        ("AI generate block", "Box radius 12, border white/10, bg black/30, padding 12: label “GENERATE WITH AI”; 2-col compact number fields “Words” / “Test tasks” (grammar: “Rule points”); “Extra instructions (optional)” (placeholder “e.g. beginner level, only nouns”); checkbox row “Generate images for all words”; green button. While images generate: bottom progress toast."),
        ("Word / rule editors", "List of compact editor rows: word (English), /trænˈskrɪp.ʃən/, translation, image (generate / upload) — or rule title, “short, kid-friendly explanation”, “example sentence”. Small action pills: cyan outline, purple fill (10/700 uppercase, radius 6). Actions row: green “Publish” (flex 1) + ghost “Clear” (confirm). Under it: completions list (student + passed pill). “Copy from another topic” importer: select + button."),
        ("Test preview", "Plays the topic’s tasks with TaskRunner in a dialog; ghost “Close” + green “Restart”."),
        ("Map <code>/teacher/map</code>", "CityMapPreview: same frame and labels as the student map, no game. District stepper row: 36 circles “‹ ›” (border white/20, disabled 25%) around name 14/900 uppercase + “District 2 of 5” label. Bottom panel: name, “Move” pill (pink when active → tap the map to drop the label; hint pill on black/80 over the map), missions count, reward line “+30 · +50 to earn here”, green 56 “Open missions”."),
        ("Location → missions", "Header: eyebrow district, h2 location, description, outline pill back. Mission rows: 32 lime/15 circle with the index (900 lime), title + description, trailing “PLAY” 12/900 lime; pressed border lime/40."),
        ("Mission review", "Mission player in review mode (§8.5)."),
        ("View-as banner", "Admin “view as teacher”: sticky 49 bar, bg purple, “VIEWING AS {name}” small (900 uppercase + 700) + white pill “EXIT VIEW” (purple text). Pushes content down by 49 (ScrollScreen topOffset)."),
        ("Profile", "Same shell as the parent profile: centred header, name, email, role badge, logout. English only."),
    ])))

    # ── Parent ───────────────────────────────────────────────────────────
    T(sec("parent", "11 · Parent console (translated en / uk / ru)", table(["Section", "Spec"], [
        ("Header", "Console header: “Dashboard” h2, “Progress of {student}” / “Linking {email}…” / “No student linked”, logout pill."),
        ("Pending link", "Card surface centred, 48 pink/10 circle with profile icon, h3 title, explanation small white/60 per reason (not registered, no profile, not a student, no email)."),
        ("Student card", "Row gap 16, surface, 16: 80 mascot circle (ring 2 lime) · name 18/900 · “English level: <b>Elementary</b>” · XP + coins 14/700 · “Last active: {date}” small white/40."),
        ("Vocabulary hero", "radius 16, border pink/40, gradient pink/15→transparent, 20: label white/60 · count 48/900 pink + “words” h3 white/80."),
        ("Placement", "Section heading + hint. Card radius 16, border cyan/30, bg cyan/5: level 24/900 cyan, score small white/60, date right; per-level bars (green/pink, 8)."),
        ("Study time", "Card: 3-col stats Today / This week / Total (label + 18/900 cyan duration) · 7 columns 64 tall (white/5 track, cyan/70 fill, radius 6) with weekday initials 10/600 white/35."),
        ("Stats grid", "2×2 StatCards (radius 16, border white/10, surface, 16): label + 30/900 value — Missions completed (lime), Tasks completed (purple), Current streak (pink, “n days”), Longest streak (cyan)."),
        ("Map progress", "Label + “64%” · bar 12 tall white/10 track, lime fill · “n of m locations unlocked” small white/50."),
        ("Practice", "Rows: family name + “n tasks”, 6-tall purple share bar."),
        ("Homework", "Rows: title + “Group · Teacher {name}”, status pill (lime passed / coin-yellow in progress / white/10 not started), module chips “✓ Vocabulary · 12 words”."),
        ("Recent activity", "Rows: 32 lime/15 circle with check · title · score (lime) + date."),
        ("Map", "CityMapPreview with “Completed by {student}” lime/80 label strip; no Move, no Open."),
        ("Profile", "Centred header, identity, LocalePicker (Auto + English / Українська / Русский chips), linked student card (name, level, hint), logout at the bottom."),
    ])))

    # ── Native adaptation ────────────────────────────────────────────────
    T(sec("native", "12a · Web → native mapping", table(["Web", "Native"], [
        ("<code>hover:</code> styles", "Pressed styles (G5); ignore <code>[@media(hover:hover)]</code>"),
        ("<code>focus-visible:ring</code>", "Not drawn; keep accessibility labels/roles"),
        ("<code>backdrop-blur</code> on bars and modals", "Solid colour at the same alpha (expo-blur optional, not required)"),
        ("<code>blur-xl</code> image behind the map", "<code>Image blurRadius≈24</code> (or expo-image <code>blurRadius</code>)"),
        ("<code>bg-gradient-to-*</code>", "expo-linear-gradient"),
        ("<code>box-shadow</code> glows", "RN <code>boxShadow</code> on an outer, unclipped view"),
        ("CSS keyframes", "Reanimated hooks in <code>src/animations/</code>"),
        ("<code>window.confirm</code> / <code>alert</code>", "<code>Alert.alert</code> with Cancel + destructive button"),
        ("Admin toast", "In-app Toast component (§4)"),
        ("<code>speechSynthesis</code>", "expo-speech (<code>language: 'en-US', rate: 0.9</code>)"),
        ("WebAudio SFX", "Pre-rendered files + expo-audio"),
        ("Twemoji <code>EmojiText</code>", "System emoji for chrome; Twemoji images for emoji task content"),
        ("<code>h-dvh</code> fixed screens", "Flex 1 screen with safe-area insets; KeyboardAvoidingView where there is input"),
        ("Fixed BottomNav + 150px clearance", "Expo Router Tabs custom bar; content padding = bar height"),
        ("PortraitLock overlay, InstallPrompt, ServiceWorker, MediaGuard, AudioUnlock", "Not ported (OS handles orientation and long-press; no install flow; audio needs no unlock)"),
        ("Cookies (locale, mascot image, view-as)", "SecureStore / AsyncStorage (WP-4.7, WP-5.7)"),
    ])))

    T(sec("deviations", "12b · Where native differs from the web, and why", table(["#", "Web", "Native", "Why"], [
        ("X1", "md button <code>h-13</code> renders 24px (class missing in Tailwind 3)", "52pt", "Evident intent; 24 breaks touch targets (SCN-5 D5)"),
        ("X2", "Coins coloured with Tailwind <code>text-yellow-300</code>; rain <code>#facc15</code>", "<code>artwork.coin.text</code> #FDE047, <code>artwork.coin.rain</code> #FACC15", "Not brand colours; named so no raw hex reaches components"),
        ("X3", "Raw <code>bg-[#1a1a1a]</code>", "<code>surface</code> token", "G2"),
        ("X4", "Hover tooltips (StreakBadge), hover delete × on own chat messages", "Tap toggles tooltip (3s auto-hide); long-press → delete confirm", "No hover on phones"),
        ("X5", "Ripple: none", "None by default; opt-in white/10 on ghost and list rows only", "SCN-5 D6"),
        ("X6", "Fixed 150px bottom clearance", "Tab bar height + inset", "Native tab bar reports its height"),
        ("X7", "Grid flex mode hardcodes widths for the md gap", "Width from the actual gap", "SCN-56 D7"),
        ("X8", "ProgressBar animates <code>width</code>", "scaleX on the UI thread", "SCN-56 D10"),
        ("X9", "Visual 36–40pt buttons", "Same visuals + hitSlop to 44", "G6"),
        ("X10", "Map has no pan/zoom", "Optional pinch 1–2× (WP-3.1), default view identical", "Ticket scope, not design"),
        ("X11", "No haptics", "Haptics per §2.8", "Native-only feedback channel"),
        ("X12", "Selects / file inputs in teacher tools", "Action-sheet picker; expo-image-picker", "Platform controls"),
    ])))

    T(sec("provenance", "13 · Provenance", f'''<p>Read from <code>rubanwd/slay-city@{SOURCE_COMMIT}</code>: <code>tailwind.config.ts</code>, <code>src/styles/*.css</code>, <code>src/components/**</code>,
<code>src/features/{{auth,demo,feedback,homework,i18n,levels,map,mission,onboarding,parent,placement,profile,reward,teacher,wardrobe}}/*.tsx</code>, <code>src/features/admin/{{formStyles.ts,AdminModal,AdminToast,AdminCreateModal}}</code> (shared by the teacher console), <code>src/lib/{{sfx,hiss}}.ts</code>.
Admin screens are out of scope (admin stays on the web). To refresh after a web change: <code>node scripts/fetch-upstream.mjs</code>, compare, edit the data in <code>design/tools/build_index.py</code>, re-run it, commit both files.</p>'''))

    # ── TOC ──────────────────────────────────────────────────────────────
    toc = [("Start", [("use", "How to use"), ("index", "Ticket index"), ("rules", "1 Global rules")]),
           ("Foundations", [("tokens-color", "2.1 Colour"), ("tokens-type", "2.2 Typography"), ("tokens-space", "2.3 Spacing &amp; radii"), ("tokens-elevation", "2.4 Glow"), ("motion", "2.5 Motion"), ("icons", "2.6 Icons"), ("assets", "2.7 Brand assets"), ("sound", "2.8 Sound &amp; haptics")]),
           ("Structure", [("layout", "3 Layout &amp; navigation"), ("tabbar", "— Tab bar"), ("headers", "— Header bars"), ("states", "— Loading / empty / error"), ("overlays", "4 Overlays")]),
           ("Components", [("primitives", "5 Primitives"), ("p-button", "— SlayButton"), ("p-card", "— SlayCard"), ("p-input", "— Inputs"), ("p-progress", "— ProgressBar"), ("p-currency", "— Coins, XP, streak"), ("p-mascot", "— Mascot"), ("p-pills", "— Pills &amp; badges"), ("p-choice", "— Choice controls"), ("patterns", "6 Patterns"), ("pattern-answers", "— Answer tiles")]),
           ("Screens", [("screens-gallery", "7 Mockups"), ("screen-welcome", "8.1 Welcome"), ("screen-auth", "8.2 Auth"), ("screen-onboarding", "8.3 Onboarding"), ("screen-map", "8.4 Map"), ("screen-mission", "8.5 Mission"), ("screen-reward", "8.6 Reward"), ("screen-wardrobe", "8.7 Wardrobe"), ("screen-profile", "8.8 Profile"), ("screen-placement", "8.9 Placement test"), ("screen-homework", "8.10 Homework"), ("screen-demo", "8.11 Demo"), ("tasks", "9 Task types"), ("teacher", "10 Teacher"), ("parent", "11 Parent")]),
           ("Native", [("native", "12a Web → native"), ("deviations", "12b Deviations"), ("provenance", "13 Provenance")])]
    toc_html = "".join(f'<div class="g">{g}</div>' + "".join(f'<a href="#{i}">{t}</a>' for i, t in items) for g, items in toc)

    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Slay City Design System</title>
<meta name="description" content="Single design reference for SLAY CITY Native (Expo / React Native): tokens, components, patterns, every screen and task type, with native adaptation rules.">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>{CSS}</style></head>
<body><div class="layout"><nav class="toc">{toc_html}</nav><main>
<!--
  AGENT NOTE: this file is the single design reference for SLAY CITY Native.
  Read §1 "Global rules" first, then the section the ticket index (#index) points to.
  Values are points at a 390pt-wide screen. Colours are tokens from @slay/tokens; NEW tokens are listed in §2.1.
-->
{"".join(parts)}
</main></div></body></html>'''


if __name__ == "__main__":
    OUT.write_text(build(), encoding="utf-8")
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")
