// Ajoute une piste audio (WAV) à une vidéo MP4, sans ffmpeg : sert au reel (tools/reel_sound.py).
// Usage : swift tools/mux.swift <video.mp4> <son.wav> <sortie.mp4>
import AVFoundation
import Foundation

let a = CommandLine.arguments
guard a.count == 4 else { print("usage : swift mux.swift <video.mp4> <son.wav> <sortie.mp4>"); exit(1) }
let video = AVURLAsset(url: URL(fileURLWithPath: a[1]))
let audio = AVURLAsset(url: URL(fileURLWithPath: a[2]))
let out = URL(fileURLWithPath: a[3])

let sem = DispatchSemaphore(value: 0)
Task {
  do {
    let comp = AVMutableComposition()
    let vDur = try await video.load(.duration)
    let range = CMTimeRange(start: .zero, duration: vDur)
    guard let vSrc = try await video.loadTracks(withMediaType: .video).first,
          let aSrc = try await audio.loadTracks(withMediaType: .audio).first else { print("piste manquante"); exit(1) }
    let vTrack = comp.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
    try vTrack.insertTimeRange(range, of: vSrc, at: .zero)
    let aDur = try await audio.load(.duration)
    let aTrack = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
    try aTrack.insertTimeRange(CMTimeRange(start: .zero, duration: CMTimeMinimum(vDur, aDur)), of: aSrc, at: .zero)
    try? FileManager.default.removeItem(at: out)
    guard let exp = AVAssetExportSession(asset: comp, presetName: AVAssetExportPresetHighestQuality) else { print("export impossible"); exit(1) }
    exp.outputURL = out
    exp.outputFileType = .mp4
    await exp.export()
    print(exp.status == .completed ? "ok → \(out.path)" : "erreur : \(String(describing: exp.error))")
  } catch { print("erreur : \(error)") }
  sem.signal()
}
sem.wait()
