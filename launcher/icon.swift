// Draws the VJ.app icon — a halftone wave: a grid of dots whose size follows a sine wave — to a 1024 px PNG.
// Usage: swift icon.swift <out.png>
import AppKit

let size: CGFloat = 1024
let out = CommandLine.arguments[1]
let ctx = CGContext(data: nil, width: Int(size), height: Int(size), bitsPerComponent: 8, bytesPerRow: 0,
                    space: CGColorSpace(name: CGColorSpace.sRGB)!,
                    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!

// macOS icon grid: an 824 px rounded square centred on the 1024 canvas.
let tile = CGRect(x: 100, y: 100, width: 824, height: 824)
let tilePath = CGPath(roundedRect: tile, cornerWidth: 185, cornerHeight: 185, transform: nil)
ctx.addPath(tilePath)
ctx.clip()
let bg = CGGradient(colorsSpace: nil, colors: [CGColor(srgbRed: 0.06, green: 0.07, blue: 0.11, alpha: 1),
                                                CGColor(srgbRed: 0.01, green: 0.01, blue: 0.03, alpha: 1)] as CFArray,
                    locations: [0, 1])!
ctx.drawLinearGradient(bg, start: CGPoint(x: 512, y: 924), end: CGPoint(x: 512, y: 100), options: [])

// Dot grid: each dot's radius falls off with its distance from the wave line at its column.
// The grid sits 80 px inside the tile so no dot meets an edge or a rounded corner.
let cols = 13, rows = 13
let pitch = CGFloat(664) / CGFloat(cols)
let maxR = pitch * 0.46
for c in 0..<cols {
  let x = 180 + (CGFloat(c) + 0.5) * pitch
  let phase = CGFloat(c) / CGFloat(cols - 1) * 2 * .pi
  let waveY = 512 + 170 * sin(phase)
  for r in 0..<rows {
    let y = 180 + (CGFloat(r) + 0.5) * pitch
    let d = (y - waveY) / 150
    let k = exp(-d * d)
    let rad = maxR * k
    if rad < 2.5 { continue }
    // Brighter and whiter near the wave, deeper cyan at the edges of the band.
    let col = CGColor(srgbRed: 0.15 + 0.55 * k * k, green: 0.75 + 0.25 * k, blue: 1.0, alpha: 0.35 + 0.65 * k)
    ctx.setShadow(offset: .zero, blur: rad * 1.2, color: CGColor(srgbRed: 0.2, green: 0.9, blue: 1, alpha: 0.5 * k))
    ctx.setFillColor(col)
    ctx.fillEllipse(in: CGRect(x: x - rad, y: y - rad, width: 2 * rad, height: 2 * rad))
  }
}

let rep = NSBitmapImageRep(cgImage: ctx.makeImage()!)
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: out))
