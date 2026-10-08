from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os, math, random

W, H = 720, 1280
FPS = 30
DURATION = 5
FRAMES = FPS * DURATION
OUT = "video/frames"
os.makedirs(OUT, exist_ok=True)

def get_font(size):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
    ]
    for p in candidates:
        if os.path.exists(p):
            return ImageFont.truetype(p, size=size)
    return ImageFont.load_default()

TITLE = get_font(44)
NUM = get_font(42)
DMG = get_font(54)
SMALL = get_font(28)

random.seed(7)
snow_seed = [(random.random(), random.random(), random.random()) for _ in range(45)]
spark_seed = [(random.random(), random.random(), random.random()) for _ in range(30)]

def lerp(a,b,t): return a + (b-a)*t
def clamp(v,a=0,b=1): return max(a,min(b,v))
def ease(t): return t*t*(3-2*t)

def glow_circle(img, xy, r, color, alpha=150, blur=18):
    layer = Image.new("RGBA", img.size, (0,0,0,0))
    d = ImageDraw.Draw(layer)
    x,y = xy
    d.ellipse((x-r,y-r,x+r,y+r), fill=(*color,alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    img.alpha_composite(layer)

def draw_ball(img, x, y, r, fill, label, outline=(15,20,34), label_size=None):
    d = ImageDraw.Draw(img)
    glow_circle(img, (x,y), r*1.1, fill, 100, int(r*0.28))
    d.ellipse((x-r,y-r,x+r,y+r), fill=(*fill,255), outline=(255,255,255,70), width=max(2,int(r*0.07)))
    # glossy highlight
    d.ellipse((x-r*0.55,y-r*0.6,x+r*0.15,y+r*0.05), fill=(255,255,255,28))
    f = NUM if label_size is None else get_font(label_size)
    txt = str(label)
    box = d.textbbox((0,0), txt, font=f, stroke_width=4)
    tw, th = box[2]-box[0], box[3]-box[1]
    d.text((x-tw/2,y-th/2-3), txt, font=f, fill="white", stroke_width=5, stroke_fill=(0,0,0,255))

def draw_bomb(img, x, y, r, label, phase=0.0, frozen=0.0, explode=0.0):
    d = ImageDraw.Draw(img)
    if explode > 0:
        er = r*(1.3+2.5*explode)
        glow_circle(img,(x,y),er,(255,100,20),int(170*(1-explode)),int(12+20*explode))
        for i in range(18):
            a = 2*math.pi*i/18 + phase
            rr = r*(1.0+3.0*explode)
            px,py = x+math.cos(a)*rr,y+math.sin(a)*rr
            d.ellipse((px-4,py-4,px+4,py+4), fill=(255,140+int(80*(1-explode)),40,220))
    body=(62,24,92)
    draw_ball(img,x,y,r,body,label)
    # fuse cap
    d.rounded_rectangle((x-r*0.18,y-r*1.03,x+r*0.18,y-r*0.70), radius=4, fill=(210,210,220,255))
    tipx, tipy = x, y-r*1.15
    glow_circle(img,(tipx,tipy),9,(255,120,10),190,7)
    d.line((x,y-r*0.87,tipx,tipy), fill=(245,180,90,255), width=4)
    for i in range(6):
        a=phase+i*2.4
        rr=10+6*((i%3)/2)
        sx=tipx+math.cos(a)*rr
        sy=tipy+math.sin(a)*rr
        d.ellipse((sx-2,sy-2,sx+2,sy+2), fill=(255,180,50,230))
    if frozen>0:
        a=int(180*frozen)
        ice=(80,200,255,a)
        for k in range(8):
            ang=2*math.pi*k/8+0.2
            rr=r*1.12
            cx=x+math.cos(ang)*rr*0.55
            cy=y+math.sin(ang)*rr*0.55
            s=r*0.34
            d.rectangle((cx-s,cy-s,cx+s,cy+s), fill=ice, outline=(180,240,255,a), width=2)

def snowflake(d, x, y, s, alpha):
    c=(190,245,255,alpha)
    for a in [0, math.pi/3, 2*math.pi/3]:
        dx=math.cos(a)*s; dy=math.sin(a)*s
        d.line((x-dx,y-dy,x+dx,y+dy), fill=c, width=max(1,int(s/5)))

def draw_ice_shard(d, x,y,s,alpha):
    pts=[(x,y-s),(x+s*0.7,y-s*0.2),(x+s*0.35,y+s),(x-s*0.55,y+s*0.35)]
    d.polygon(pts, fill=(95,210,255,alpha), outline=(210,250,255,alpha))

for fi in range(FRAMES):
    t = fi/FPS
    img = Image.new("RGBA",(W,H),(0,0,0,255))
    d = ImageDraw.Draw(img)

    # header
    d.rectangle((0,0,W,180), fill=(0,0,0,255))
    title="Freeze ball vs Bomb ball"
    tb=d.textbbox((0,0),title,font=TITLE)
    tw=tb[2]-tb[0]
    d.text(((W-tw)/2,76), title, font=TITLE, fill="white")
    # sky strip
    for y in range(180,220):
        q=(y-180)/40
        d.line((0,y,W,y), fill=(int(80+70*q),int(170+50*q),int(230+20*q),255))

    # arena
    ax,ay,aw,ah=34,220,652,910
    d.rounded_rectangle((ax,ay,ax+aw,ay+ah), radius=10, fill=(7,22,44,255), outline=(2,10,23,255), width=12)
    d.rounded_rectangle((ax+18,ay+18,ax+aw-18,ay+ah-18), radius=8, fill=(11,31,58,255), outline=(24,49,77,255), width=4)
    # subtle floor vignette
    vign = Image.new("RGBA",(W,H),(0,0,0,0))
    vd=ImageDraw.Draw(vign)
    vd.ellipse((120,400,660,1160), fill=(5,25,55,80))
    vign=vign.filter(ImageFilter.GaussianBlur(70))
    img.alpha_composite(vign)

    # freeze ball path
    fx = 360 + 55*math.sin(t*1.7)
    fy = 470 + 28*math.sin(t*2.2+0.8)
    fr = 52

    # icy motion trail
    trail = Image.new("RGBA",(W,H),(0,0,0,0))
    td=ImageDraw.Draw(trail)
    for j in range(12):
        lag=j*0.045
        px = 360 + 55*math.sin((t-lag)*1.7) - j*16
        py = 470 + 28*math.sin((t-lag)*2.2+0.8) + j*2
        a=max(0,115-j*8)
        td.rounded_rectangle((px-50,py-28,px+50,py+28),radius=14,fill=(45,155,255,a))
    img.alpha_composite(trail)

    # snow particles
    pd=ImageDraw.Draw(img)
    for i,(sx,sy,sv) in enumerate(snow_seed):
        xx=ax+40+sx*(aw-80)+30*math.sin(t*(0.7+sv)+i)
        yy=ay+70+((sy*650 + t*(30+70*sv))%650)
        snowflake(pd,xx,yy,5+7*sv,150)

    # freeze ball
    draw_ball(img,fx,fy,fr,(35,155,235),100)
    # inner ice crystal
    dd=ImageDraw.Draw(img)
    for k in range(6):
        a=2*math.pi*k/6 + t*0.3
        x2=fx+math.cos(a)*21; y2=fy+math.sin(a)*21
        draw_ice_shard(dd,x2,y2,7,130)

    # target
    tx,ty=330,690
    hit_index=min(4,int(t)+1)
    health=96-4*hit_index
    pulse=0
    last_hit=math.floor(t)
    dt=t-last_hit
    if 0 <= dt < 0.34:
        pulse=1-dt/0.34
    tr=48+6*pulse
    # target frozen shell
    glow_circle(img,(tx,ty),78,(40,160,255),130,22)
    draw_ball(img,tx,ty,tr,(55,42,115),health)
    dd=ImageDraw.Draw(img)
    for k in range(10):
        a=2*math.pi*k/10 + t*0.45
        rr=70+8*math.sin(t*4+k)
        cx=tx+math.cos(a)*rr
        cy=ty+math.sin(a)*rr
        draw_ice_shard(dd,cx,cy,11+3*(k%3),190)

    # -4 popup each second
    if pulse>0:
        yy=ty-115-28*(1-pulse)
        txt="-4"
        box=dd.textbbox((0,0),txt,font=DMG,stroke_width=5)
        tw=box[2]-box[0]
        dd.text((tx-tw/2,yy),txt,font=DMG,fill=(255,38,28,int(255*pulse)),stroke_width=5,stroke_fill=(0,0,0,int(255*pulse)))

    # bombs move and bounce
    bx1=555-55*ease(clamp(t/4.1)) + 8*math.sin(t*3.1)
    by1=610+35*math.sin(t*2.4)
    bx2=598-35*ease(clamp(t/4.4)) + 6*math.sin(t*2.7+1)
    by2=750+28*math.sin(t*2.0+1.2)
    frozen=clamp((t-3.1)/0.7)
    explode=clamp((t-4.2)/0.55)
    draw_bomb(img,bx1,by1,44,3,phase=t*7,frozen=frozen,explode=0)
    draw_bomb(img,bx2,by2,42,2,phase=t*8+1,frozen=0,explode=explode)

    # impact burst near end
    if t>4.15:
        e=clamp((t-4.15)/0.8)
        dd=ImageDraw.Draw(img)
        for i,(a1,a2,a3) in enumerate(spark_seed):
            ang=2*math.pi*a1
            rr=30+180*e*a2
            px=bx2+math.cos(ang)*rr
            py=by2+math.sin(ang)*rr
            s=2+6*a3
            dd.ellipse((px-s,py-s,px+s,py+s), fill=(255,110+int(100*a3),25,int(240*(1-e*0.65))))
        for k in range(12):
            ang=2*math.pi*k/12+t
            rr=55+140*e
            draw_ice_shard(dd,tx+math.cos(ang)*rr,ty+math.sin(ang)*rr,12,180)

    # bottom subtle caption
    cap="5s gameplay test"
    cb=dd.textbbox((0,0),cap,font=SMALL)
    dd.text(((W-(cb[2]-cb[0]))/2,1175),cap,font=SMALL,fill=(160,170,185,210))

    img=img.convert("RGB")
    img.save(f"{OUT}/frame_{fi:04d}.png", quality=92)

print(f"Rendered {FRAMES} frames to {OUT}")
