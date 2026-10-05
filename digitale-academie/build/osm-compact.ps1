# Convertit l'extrait OpenStreetMap (Overpass, out geom) en un fichier compact pour la maquette du territoire.
# Repère local en mètres : x vers l'est, z vers le sud, origine (LAT0, LON0). Lignes simplifiées (Douglas-Peucker).
# Données © contributeurs OpenStreetMap, licence ODbL.
param([string]$In = "$PSScriptRoot\..\ref\osm\raw.json", [string]$Out = "$PSScriptRoot\..\v5\assets\data\montereau.json")

$code = @'
using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;

public static class OsmCompact {
  const double LAT0 = 48.39, LON0 = 2.955;
  static readonly double KX = Math.Cos(LAT0 * Math.PI / 180) * 111320.0, KZ = 110540.0;
  static CultureInfo IC = CultureInfo.InvariantCulture;

  static List<double[]> Geom(Dictionary<string, object> w) {
    var res = new List<double[]>();
    object g; if (!w.TryGetValue("geometry", out g) || g == null) return res;
    foreach (var o in (IEnumerable)g) {
      var p = (Dictionary<string, object>)o; if (p == null) continue;
      double lat = Convert.ToDouble(p["lat"], IC), lon = Convert.ToDouble(p["lon"], IC);
      res.Add(new double[] { (lon - LON0) * KX, -(lat - LAT0) * KZ });
    }
    return res;
  }
  static double SegDist(double[] p, double[] a, double[] b) {
    double dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz;
    double t = l > 0 ? Math.Max(0, Math.Min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l)) : 0;
    double ex = a[0] + t * dx - p[0], ez = a[1] + t * dz - p[1]; return Math.Sqrt(ex * ex + ez * ez);
  }
  static void DP(List<double[]> pts, int i0, int i1, double tol, bool[] keep) {
    double best = 0; int bi = -1;
    for (int i = i0 + 1; i < i1; i++) { double d = SegDist(pts[i], pts[i0], pts[i1]); if (d > best) { best = d; bi = i; } }
    if (bi >= 0 && best > tol) { keep[bi] = true; DP(pts, i0, bi, tol, keep); DP(pts, bi, i1, tol, keep); }
  }
  static List<double[]> Simplify(List<double[]> pts, double tol) {
    if (pts.Count < 3) return pts;
    var keep = new bool[pts.Count]; keep[0] = keep[pts.Count - 1] = true; DP(pts, 0, pts.Count - 1, tol, keep);
    var r = new List<double[]>(); for (int i = 0; i < pts.Count; i++) if (keep[i]) r.Add(pts[i]); return r;
  }
  static string Flat(List<double[]> pts) {
    var sb = new StringBuilder();
    for (int i = 0; i < pts.Count; i++) { if (i > 0) sb.Append(','); sb.Append(Math.Round(pts[i][0]).ToString(IC)); sb.Append(','); sb.Append(Math.Round(pts[i][1]).ToString(IC)); }
    return sb.ToString();
  }
  static string Tag(Dictionary<string, object> tags, string k) { object v; return tags != null && tags.TryGetValue(k, out v) && v != null ? v.ToString() : null; }
  static double Area(List<double[]> p) { double a = 0; for (int i = 0, j = p.Count - 1; i < p.Count; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return Math.Abs(a / 2); }

  public static string Run(string inPath, string outPath) {
    var ser = new JavaScriptSerializer(); ser.MaxJsonLength = int.MaxValue; ser.RecursionLimit = 256;
    var root = (Dictionary<string, object>)ser.DeserializeObject(File.ReadAllText(inPath, Encoding.UTF8));
    var water = new List<string>(); var rivers = new List<string>(); var roads = new List<string>(); var rail = new List<string>(); var bld = new List<string>();
    int nb = 0;
    foreach (var eo in (object[])root["elements"]) {
      var e = (Dictionary<string, object>)eo; var type = (string)e["type"];
      Dictionary<string, object> tags = null; object to; if (e.TryGetValue("tags", out to)) tags = (Dictionary<string, object>)to;
      if (type == "relation") {
        if (Tag(tags, "natural") != "water") continue;
        object mo; if (!e.TryGetValue("members", out mo)) continue;
        foreach (var m in (object[])mo) {
          var md = (Dictionary<string, object>)m; if ((md["role"] as string) != "outer") continue;
          var g = Simplify(Geom(md), 3); var wt = Tag(tags, "water"); if (g.Count > 2) water.Add("[" + ((wt == "river" || wt == "canal") ? 1 : 0) + "," + Flat(g) + "]");
        }
        continue;
      }
      var pts = Geom(e); if (pts.Count < 2) continue;
      string hw = Tag(tags, "highway"), ww = Tag(tags, "waterway"), nat = Tag(tags, "natural"), b = Tag(tags, "building"), rw = Tag(tags, "railway");
      if (nat == "water" || ww == "riverbank") { var g = Simplify(pts, 3); var wt = Tag(tags, "water"); int riv = (ww == "riverbank" || wt == "river" || wt == "canal") ? 1 : 0; if (g.Count > 2) water.Add("[" + riv + "," + Flat(g) + "]"); }
      else if (ww == "river" || ww == "canal") {
        var n = Tag(tags, "name") ?? ""; n = n.Replace("\"", "");
        rivers.Add("{\"n\":\"" + n + "\",\"p\":[" + Flat(Simplify(pts, 4)) + "]}");
      }
      else if (hw != null) {
        int c = (hw == "motorway" || hw == "trunk" || hw == "primary" || hw == "secondary") ? 0 : hw == "tertiary" ? 1 : 2;
        roads.Add("[" + c + "," + Flat(Simplify(pts, 2.5)) + "]");
      }
      else if (rw == "rail") rail.Add("[" + Flat(Simplify(pts, 3)) + "]");
      else if (b != null) {
        var g = Simplify(pts, 1.2); if (g.Count > 1 && g[0][0] == g[g.Count - 1][0] && g[0][1] == g[g.Count - 1][1]) g.RemoveAt(g.Count - 1);
        if (g.Count < 3) continue;
        double h; var lv = Tag(tags, "building:levels"); var ht = Tag(tags, "height"); double area = Area(g);
        double v;
        if (ht != null && double.TryParse(ht.Replace("m", "").Trim(), NumberStyles.Float, IC, out v)) h = v;
        else if (lv != null && double.TryParse(lv, NumberStyles.Float, IC, out v)) h = v * 3 + 1;
        else if (b == "apartments") h = 15;
        else if (b == "industrial" || b == "warehouse" || b == "retail" || b == "commercial") h = 8;
        else if (b == "church" || b == "cathedral") h = 18;
        else if (area > 1500) h = 10; else if (area < 40) h = 3; else h = 6;
        bld.Add("[" + Math.Round(h).ToString(IC) + "," + Flat(g) + "]"); nb++;
      }
    }
    var sb = new StringBuilder();
    sb.Append("{\"src\":\"OpenStreetMap (ODbL)\",\"o\":[48.39,2.955],");
    sb.Append("\"water\":[" + string.Join(",", water) + "],");
    sb.Append("\"rivers\":[" + string.Join(",", rivers) + "],");
    sb.Append("\"roads\":[" + string.Join(",", roads) + "],");
    sb.Append("\"rail\":[" + string.Join(",", rail) + "],");
    sb.Append("\"bld\":[" + string.Join(",", bld) + "]}");
    Directory.CreateDirectory(Path.GetDirectoryName(outPath));
    File.WriteAllText(outPath, sb.ToString(), new UTF8Encoding(false));
    return string.Format("eau {0}, rivieres {1}, routes {2}, rail {3}, batiments {4}, {5:N0} octets", water.Count, rivers.Count, roads.Count, rail.Count, nb, sb.Length);
  }
}
'@
Add-Type -TypeDefinition $code -ReferencedAssemblies System.Web.Extensions
[OsmCompact]::Run((Resolve-Path $In).Path, [IO.Path]::GetFullPath($Out))
