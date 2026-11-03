// Détourage des photos de combattants pour les silhouettes des cartes (tools/card_silhouettes.py).
// Usage : swift tools/silhouette.swift <dossier des photos> <dossier de sortie>
// Pour chaque photo : masque de la personne (Vision), plus grand morceau seulement (pas l'arbitre ni le
// public), recadré au buste autour du visage, puis PNG blanc sur transparent de 420 px de haut.
import AppKit
import CoreImage
import Foundation
import Vision

let args = CommandLine.arguments
guard args.count == 3 else { print("usage : swift silhouette.swift <photos> <sortie>"); exit(1) }
let inDir = URL(fileURLWithPath: args[1])
let outDir = URL(fileURLWithPath: args[2])
let OUT_H = 420

func cgImage(_ url: URL) -> CGImage? {
  guard let src = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
  return CGImageSourceCreateImageAtIndex(src, 0, nil)
}

// Masque 8 bits de la personne, à la taille de l'image.
func personMask(_ img: CGImage) -> (w: Int, h: Int, px: [UInt8])? {
  let req = VNGeneratePersonSegmentationRequest()
  req.qualityLevel = .accurate
  req.outputPixelFormat = kCVPixelFormatType_OneComponent8
  let handler = VNImageRequestHandler(cgImage: img, options: [:])
  guard (try? handler.perform([req])) != nil, let buf = req.results?.first?.pixelBuffer else { return nil }
  // Mise à l'échelle du masque à la taille de l'image (Core Image).
  let ci = CIImage(cvPixelBuffer: buf)
  let sx = CGFloat(img.width) / ci.extent.width, sy = CGFloat(img.height) / ci.extent.height
  let scaled = ci.transformed(by: CGAffineTransform(scaleX: sx, y: sy))
  let w = img.width, h = img.height
  var px = [UInt8](repeating: 0, count: w * h)
  let ctx = CIContext()
  px.withUnsafeMutableBytes { ptr in
    ctx.render(scaled, toBitmap: ptr.baseAddress!, rowBytes: w, bounds: CGRect(x: 0, y: 0, width: w, height: h), format: .L8, colorSpace: nil)
  }
  return (w, h, px)
}

// Visages (repère Vision : origine en bas à gauche, valeurs 0…1) → rectangles en pixels, origine en haut.
func faces(_ img: CGImage) -> [CGRect] {
  let req = VNDetectFaceRectanglesRequest()
  let handler = VNImageRequestHandler(cgImage: img, options: [:])
  guard (try? handler.perform([req])) != nil else { return [] }
  let W = CGFloat(img.width), H = CGFloat(img.height)
  return (req.results ?? []).map { f in
    let b = f.boundingBox
    return CGRect(x: b.minX * W, y: (1 - b.maxY) * H, width: b.width * W, height: b.height * H)
  }
}

// Plus grand morceau connexe du masque (seuil 50 %) : renvoie l'étiquette de chaque pixel gardé.
func largestComponent(_ w: Int, _ h: Int, _ px: [UInt8]) -> (keep: [Bool], area: Int) {
  var label = [Int32](repeating: 0, count: w * h)
  var best = 0, bestLabel: Int32 = 0, next: Int32 = 0
  var stack = [Int]()
  for start in 0..<(w * h) where px[start] > 127 && label[start] == 0 {
    next += 1
    var area = 0
    stack.append(start); label[start] = next
    while let i = stack.popLast() {
      area += 1
      let x = i % w, y = i / w
      for (nx, ny) in [(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)] where nx >= 0 && ny >= 0 && nx < w && ny < h {
        let j = ny * w + nx
        if px[j] > 127 && label[j] == 0 { label[j] = next; stack.append(j) }
      }
    }
    if area > best { best = area; bestLabel = next }
  }
  return (label.map { $0 == bestLabel && bestLabel != 0 }, best)
}

let fm = FileManager.default
try? fm.createDirectory(at: outDir, withIntermediateDirectories: true)
let files = (try? fm.contentsOfDirectory(at: inDir, includingPropertiesForKeys: nil)) ?? []
var ok = 0
for file in files.sorted(by: { $0.lastPathComponent < $1.lastPathComponent }) {
  let id = file.deletingPathExtension().lastPathComponent
  guard let img = cgImage(file), let m = personMask(img) else { print("— \(id) : illisible"); continue }
  let (keep, area) = largestComponent(m.w, m.h, m.px)
  if Double(area) < 0.03 * Double(m.w * m.h) { print("— \(id) : personne trop petite"); continue }
  // Boîte du morceau gardé.
  var x0 = m.w, y0 = m.h, x1 = 0, y1 = 0
  for i in 0..<(m.w * m.h) where keep[i] { let x = i % m.w, y = i / m.w; x0 = min(x0, x); x1 = max(x1, x); y0 = min(y0, y); y1 = max(y1, y) }
  // Buste : autour du visage le plus grand situé dans la silhouette ; sinon le haut de la silhouette.
  let face = faces(img).filter { f in
    let cx = Int(f.midX), cy = Int(f.midY)
    return cx >= 0 && cy >= 0 && cx < m.w && cy < m.h && keep[cy * m.w + cx]
  }.max { $0.width < $1.width }
  var crop: CGRect
  if let f = face {
    let half = f.width * 2.3
    let bottom = min(CGFloat(y1), f.maxY + f.height * 2.6)
    crop = CGRect(x: f.midX - half, y: CGFloat(y0), width: half * 2, height: bottom - CGFloat(y0))
  } else {
    let bw = CGFloat(x1 - x0), bh = CGFloat(y1 - y0)
    crop = CGRect(x: CGFloat(x0), y: CGFloat(y0), width: bw, height: min(bh, bw * 1.3))
  }
  crop = crop.intersection(CGRect(x: 0, y: 0, width: m.w, height: m.h)).integral
  if crop.width < 40 || crop.height < 40 { print("— \(id) : recadrage trop petit"); continue }
  // Silhouette pleine : trous bouchés (fond non relié au bord du cadre = trou dans le corps).
  let cw = Int(crop.width), ch = Int(crop.height)
  var solid = [Bool](repeating: false, count: cw * ch)
  for y in 0..<ch { for x in 0..<cw { solid[y * cw + x] = keep[(Int(crop.minY) + y) * m.w + Int(crop.minX) + x] } }
  var outside = [Bool](repeating: false, count: cw * ch)
  var st = [Int]()
  for x in 0..<cw { st.append(x); st.append((ch - 1) * cw + x) }
  for y in 0..<ch { st.append(y * cw); st.append(y * cw + cw - 1) }
  while let i = st.popLast() {
    if solid[i] || outside[i] { continue }
    outside[i] = true
    let x = i % cw, y = i / cw
    if x > 0 { st.append(i - 1) }; if x < cw - 1 { st.append(i + 1) }
    if y > 0 { st.append(i - cw) }; if y < ch - 1 { st.append(i + cw) }
  }
  // PNG : blanc opaque dans la silhouette ; sur le bord extérieur (1 px), l'opacité du masque pour
  // adoucir le contour. Pas de zones à moitié transparentes à l'intérieur.
  var rgba = [UInt8](repeating: 0, count: cw * ch * 4)
  for y in 0..<ch {
    for x in 0..<cw {
      let j = y * cw + x
      let i = (Int(crop.minY) + y) * m.w + Int(crop.minX) + x
      var a: UInt8 = outside[j] ? 0 : 255
      if outside[j] {
        let near = (x > 0 && !outside[j - 1]) || (x < cw - 1 && !outside[j + 1]) || (y > 0 && !outside[j - cw]) || (y < ch - 1 && !outside[j + cw])
        if near { a = m.px[i] }
      }
      let o = (y * cw + x) * 4
      rgba[o] = a; rgba[o + 1] = a; rgba[o + 2] = a; rgba[o + 3] = a // blanc prémultiplié
    }
  }
  let cs = CGColorSpaceCreateDeviceRGB()
  guard let src = CGContext(data: &rgba, width: cw, height: ch, bitsPerComponent: 8, bytesPerRow: cw * 4, space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue),
        let cut = src.makeImage() else { continue }
  let ow = max(1, Int(Double(cw) * Double(OUT_H) / Double(ch)))
  guard let dst = CGContext(data: nil, width: ow, height: OUT_H, bitsPerComponent: 8, bytesPerRow: 0, space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { continue }
  dst.interpolationQuality = .high
  dst.draw(cut, in: CGRect(x: 0, y: 0, width: ow, height: OUT_H))
  guard let out = dst.makeImage() else { continue }
  let rep = NSBitmapImageRep(cgImage: out)
  if let data = rep.representation(using: .png, properties: [:]) {
    try? data.write(to: outDir.appendingPathComponent("\(id).png"))
    ok += 1
    print("✓ \(id)\(face == nil ? " (sans visage)" : "")")
  }
}
print("\(ok) silhouettes")
