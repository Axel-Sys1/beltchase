// Assemble des images JPEG numérotées (frame-0000.jpg, frame-0001.jpg…) en vidéo MP4 H.264, sans ffmpeg.
// Sert au reel de présentation (marketing/reel.html).
// Usage : swift tools/frames2mp4.swift <dossier des images> <sortie.mp4> [images par seconde = 25]
import AVFoundation
import CoreImage
import Foundation

let args = CommandLine.arguments
guard args.count >= 3 else { print("usage : swift frames2mp4.swift <images> <sortie.mp4> [fps]"); exit(1) }
let dir = URL(fileURLWithPath: args[1])
let out = URL(fileURLWithPath: args[2])
let fps = Int32(args.count > 3 ? Int(args[3]) ?? 25 : 25)

let files = ((try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)) ?? [])
  .filter { $0.lastPathComponent.hasPrefix("frame-") && $0.pathExtension == "jpg" }
  .sorted { $0.lastPathComponent < $1.lastPathComponent }
guard let first = files.first, let firstImg = CIImage(contentsOf: first) else { print("aucune image"); exit(1) }
let w = Int(firstImg.extent.width), h = Int(firstImg.extent.height)

try? FileManager.default.removeItem(at: out)
let writer = try AVAssetWriter(outputURL: out, fileType: .mp4)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: w, AVVideoHeightKey: h,
  AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 8_000_000, AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel],
])
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA, kCVPixelBufferWidthKey as String: w, kCVPixelBufferHeightKey as String: h,
])
writer.add(input)
writer.startWriting()
writer.startSession(atSourceTime: .zero)
let ctx = CIContext()

for (i, file) in files.enumerated() {
  guard let img = CIImage(contentsOf: file) else { continue }
  while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.005) }
  var buf: CVPixelBuffer?
  CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &buf)
  guard let pb = buf else { continue }
  ctx.render(img, to: pb)
  adaptor.append(pb, withPresentationTime: CMTime(value: CMTimeValue(i), timescale: fps))
}
input.markAsFinished()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
print(writer.status == .completed ? "\(files.count) images → \(out.path)" : "erreur : \(String(describing: writer.error))")
