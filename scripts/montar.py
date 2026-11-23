#!/usr/bin/env python3
"""
Editor en la nube de Sherine: monta un vídeo vertical 1080x1920 a partir de una
"lista de montaje" JSON (episodios/*.json) con la identidad «Bali en crudo».

Uso:  python3 scripts/montar.py episodios/2026-11-23_berrysport.json RUSH_DIR SALIDA.mp4

La lista de montaje:
{
  "serie": "berrysport", "episodio": "séance quadriceps",
  "titulo_duracion": 2.6,
  "audio_ambiente": 0.25,          # volumen del sonido original (0 = mudo)
  "planos": [ {"clip": "IMG_9632.MOV", "desde": 0.0, "hasta": 2.6, "texto": ""}, ... ]
}
"""
import json, os, subprocess, sys, tempfile

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
F = os.path.join(REPO, "marca", "fuentes")
BLANCO_ROTO = "0xF4F1EC"
# Aproximación del preset "Berry Cálido": cálido, azules/turquesas apagados, grano suave
def grade(calidez=2):
    """calidez 0 neutro · 1 suave · 2 Berry Cálido · 3 muy cálido (se edita en Berry Studio)."""
    k = [0.0, 0.5, 1.0, 1.6][int(calidez)]
    return (f"eq=contrast={1 + 0.06 * k:.3f}:saturation={1 - 0.08 * k:.3f},"
            f"colorbalance=rs={0.03 * k:.3f}:bs={-0.04 * k:.3f}:rm={0.02 * k:.3f}:bm={-0.03 * k:.3f}"
            f":rh={0.01 * k:.3f}:bh={-0.02 * k:.3f},noise=alls=6:allf=t")


def esc(t):
    return t.replace("\\", "\\\\").replace(":", "\\:").replace("'", "’").replace("%", "\\%")


def titulo_png(serie, episodio, ruta):
    """Título de serie con sombra difuminada sobre fondo transparente."""
    dt = (f"drawtext=fontfile={F}/DMSerifDisplay-Italic.ttf:text='{esc(serie)}':fontsize=150:"
          f"fontcolor={{c}}:x=(w-tw)/2:y=380,"
          f"drawtext=fontfile={F}/PlayfairDisplay-Italic.ttf:text='{esc(episodio)}':fontsize=50:"
          f"fontcolor={{c}}:x=(w-tw)/2:y=578")
    fc = (f"color=c=black@0:s=1080x1920,format=rgba,split[a][b];"
          f"[a]{dt.format(c='black@0.75')},boxblur=22:2[sh];"
          f"[b]{dt.format(c=BLANCO_ROTO)}[tx];[sh][tx]overlay=format=auto")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "nullsrc=s=1080x1920",
                    "-filter_complex", fc, "-frames:v", "1", ruta], check=True)


def main(lista, rush_dir, salida):
    ed = json.load(open(lista))
    tmp = tempfile.mkdtemp()
    piezas, t, textos = [], 0.0, []
    for i, p in enumerate(x for x in ed["planos"] if x.get("activo", True)):
        dur = p["hasta"] - p["desde"]
        out = os.path.join(tmp, f"p{i:02d}.mp4")
        vf = (f"scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,"
              f"fps=30,{grade(ed.get('calidez', 2))},format=yuv420p")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", str(p["desde"]), "-t", str(dur),
                        "-i", os.path.join(rush_dir, p["clip"]), "-vf", vf,
                        "-af", f"volume={ed.get('audio_ambiente', 0.25)},aresample=48000",
                        "-c:v", "libx264", "-crf", "17", "-preset", "medium",
                        "-c:a", "aac", "-b:a", "192k", "-ac", "2", out], check=True)
        piezas.append(out)
        if p.get("texto"):
            textos.append((t, t + min(dur, p.get("texto_dur", dur)), p["texto"]))
        t += dur

    lista_concat = os.path.join(tmp, "concat.txt")
    open(lista_concat, "w").write("".join(f"file '{x}'\n" for x in piezas))
    unido = os.path.join(tmp, "unido.mp4")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
                    "-i", lista_concat, "-c", "copy", unido], check=True)

    tpng = os.path.join(tmp, "titulo.png")
    titulo_png(ed["serie"], ed["episodio"], tpng)
    td = ed.get("titulo_duracion", 2.6)

    dts = []
    for a, b, txt in textos:
        # aparición/desaparición suave (0,25 s)
        alpha = f"if(lt(t,{a}+0.25),(t-{a})/0.25,if(gt(t,{b}-0.25),({b}-t)/0.25,1))"
        dts.append(f"drawtext=fontfile={F}/Inter.ttf:text='{esc(txt)}':fontsize=46:fontcolor=white:"
                   f"shadowcolor=black@0.45:shadowx=0:shadowy=2:x=90:y=1390:"
                   f"enable='between(t,{a},{b})':alpha='{alpha}'")
    fc = (f"[1]format=rgba,fade=t=out:st={td - 0.5}:d=0.5:alpha=1[ti];"
          f"[0][ti]overlay=enable='lte(t,{td})'" + ("," + ",".join(dts) if dts else "") + "[v]")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", unido, "-loop", "1", "-t", str(td),
                    "-i", tpng, "-filter_complex", fc, "-map", "[v]", "-map", "0:a",
                    "-c:v", "libx264", "-crf", "18", "-preset", "slow", "-pix_fmt", "yuv420p",
                    "-c:a", "copy", "-movflags", "+faststart", salida], check=True)
    print(f"OK {salida} ({t:.1f} s)")


if __name__ == "__main__":
    main(*sys.argv[1:4])
