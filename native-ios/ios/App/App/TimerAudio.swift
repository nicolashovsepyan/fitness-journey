import Foundation
import AVFoundation
import Capacitor

/* ============================================================
   THE TIMER'S SOUND, NATIVE.
   On an iPhone a web page cannot play through the silent switch AND keep
   the person's music playing, and after Siri or a call iOS does not
   reliably give a web page its sound back. So inside the app the page
   makes no sound at all: it hands every beep and every coach line to this
   engine (js/timer.js, when window.Capacitor has TimerAudio).

   · One AVAudioSession: .playback (the silent switch does not mute it)
     with .mixWithOthers (Spotify, YouTube Music keep playing at their
     own volume, the cues sit on top).
   · One AVAudioEngine, always running while a workout is on (a silent
     loop keeps it, and the app, alive when the phone is locked or the app
     is in the background: UIBackgroundModes audio).
   · Events carry an absolute time (epoch ms). Anything due within 2 s is
     handed to a player node at its exact host time; later ones wait in a
     queue. So the page can schedule the next minutes ahead (countdowns,
     round calls) and they play even while the page itself is asleep.
   · Siri, a call, an alarm: on "interruption ended" (and whenever the app
     comes back) the session is taken again, the engine restarted, the
     players restarted, the queue replayed. A route change (AirPods,
     Bluetooth speaker) or a media-services reset rebuilds the graph.
   · Coach clips are downloaded once from the site, decoded and kept.
   ============================================================ */
final class TimerSound {
    static let shared = TimerSound()

    struct Event { let at: Double; let kind: String; let urls: [String]; let stops: [Bool]; let cut: Bool; let tag: String; let gain: Float }

    private let engine = AVAudioEngine()
    private let format = AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 2)!
    private var beepNodes: [AVAudioPlayerNode] = []
    private var nextBeep = 0
    private let voiceNode = AVAudioPlayerNode()
    private let idleNode = AVAudioPlayerNode()
    private var built = false
    private var idleLooping = false
    private var wanted = false                      // a workout asked for sound
    private var pending: [Event] = []               // not yet handed to a node
    private var clips: [String: AVAudioPCMBuffer] = [:]
    private var waiting: [String: [(AVAudioPCMBuffer?) -> Void]] = [:]
    private var voiceEndsAt: Double = 0             // epoch seconds the current line ends
    private var beepEndsAt: Double = 0              // the last beep's end: a line waits for it
    private var pump: DispatchSourceTimer?
    private let q = DispatchQueue(label: "fj.timer.sound")
    private(set) var interrupted = false

    private init() {
        let nc = NotificationCenter.default
        nc.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: nil) { [weak self] n in self?.onInterruption(n) }
        nc.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: nil) { [weak self] _ in self?.q.async { self?.revive() } }
        nc.addObserver(forName: AVAudioSession.mediaServicesWereResetNotification, object: nil, queue: nil) { [weak self] _ in self?.q.async { self?.rebuild() } }
        nc.addObserver(forName: .AVAudioEngineConfigurationChange, object: engine, queue: nil) { [weak self] _ in self?.q.async { self?.revive() } }
        nc.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: nil) { [weak self] _ in self?.q.async { if self?.wanted == true { self?.revive() } } }
    }

    // MARK: session and engine
    private func takeSession() {
        let s = AVAudioSession.sharedInstance()
        try? s.setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try? s.setActive(true)
    }
    private func build() {
        guard !built else { return }
        for _ in 0..<8 { let n = AVAudioPlayerNode(); engine.attach(n); engine.connect(n, to: engine.mainMixerNode, format: format); beepNodes.append(n) }
        engine.attach(voiceNode); engine.connect(voiceNode, to: engine.mainMixerNode, format: format)
        engine.attach(idleNode); engine.connect(idleNode, to: engine.mainMixerNode, format: format)
        built = true
    }
    /* everything running again: session, engine, nodes, the silent loop, the queue */
    func revive() {
        guard wanted else { return }
        takeSession(); build()
        if !engine.isRunning { engine.prepare(); try? engine.start() }
        guard engine.isRunning else { interrupted = true; NSLog("[TimerAudio] engine did not start"); return }
        NSLog("[TimerAudio] running, other audio: %d", AVAudioSession.sharedInstance().isOtherAudioPlaying ? 1 : 0)
        interrupted = false
        for n in beepNodes + [voiceNode, idleNode] where !n.isPlaying { n.play() }
        if !idleLooping, let silence = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 4410) {
            silence.frameLength = 4410                  // a silent loop: keeps the engine (and the app) awake in the background
            idleNode.scheduleBuffer(silence, at: nil, options: [.loops], completionHandler: nil)
            idleLooping = true
        }
        startPump()
    }
    private func rebuild() {
        engine.stop(); idleLooping = false
        for n in beepNodes + [voiceNode, idleNode] { engine.detach(n) }
        beepNodes.removeAll(); built = false
        engine.reset()
        revive()
    }
    private func onInterruption(_ n: Notification) {
        guard let raw = n.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt, let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
        q.async {
            if type == .began { self.interrupted = true }
            else { self.revive() }                  // ended: take it all back, whatever iOS says about resuming
        }
    }
    func start() { q.async { self.wanted = true; self.revive() } }
    func stop() { q.async {
        self.wanted = false; self.pending.removeAll(); self.pump?.cancel(); self.pump = nil
        self.engine.stop(); self.idleNode.stop(); self.idleLooping = false
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
    } }

    // MARK: the queue
    func add(_ evs: [Event]) { q.async {
        for e in evs { if e.cut { self.pending.removeAll { $0.kind == "line" && $0.at <= e.at } } }
        self.pending.append(contentsOf: evs); self.pending.sort { $0.at < $1.at }
        if !self.engine.isRunning { self.revive() }
        self.flush()
    } }
    func cancel(tag: String) { q.async {
        self.pending.removeAll { tag.isEmpty || $0.tag == tag }
        if tag.isEmpty || tag == "all" { for n in self.beepNodes { n.stop(); n.play() }; self.voiceNode.stop(); self.voiceNode.play(); self.voiceEndsAt = 0 }
    } }
    private func startPump() {
        guard pump == nil else { return }
        let t = DispatchSource.makeTimerSource(queue: q)
        t.schedule(deadline: .now(), repeating: .milliseconds(100))
        t.setEventHandler { [weak self] in self?.flush() }
        t.resume(); pump = t
    }
    private func flush() {
        guard engine.isRunning else { return }
        let now = Date().timeIntervalSince1970
        while let e = pending.first, e.at / 1000 < now + 2.0 {
            pending.removeFirst()
            if e.at / 1000 < now - 1.5 { continue }        // too late to be useful: skipped, never played in a heap
            if e.kind == "line" { playLine(e) } else { playBeep(e) }
        }
    }
    /* an epoch time (s) → the player's clock */
    private func when(_ epoch: Double) -> AVAudioTime? {
        let d = epoch - Date().timeIntervalSince1970
        if d <= 0.005 { return nil }
        return AVAudioTime(hostTime: mach_absolute_time() + AVAudioTime.hostTime(forSeconds: d))
    }

    // MARK: beeps (the same tones as js/timer.js)
    private static let TONES: [String: [(Double, Double, Double)]] = [   // (Hz, ms, offset s)
        "go": [(1046, 110, 0), (1568, 190, 0.09)],
        "end": [(1318, 110, 0), (1568, 110, 0.10), (2093, 280, 0.20)],
        "count": [(1760, 95, 0)],
        "warn": [(1175, 70, 0), (1175, 70, 0.12)],
        "round": [(1046, 70, 0), (1318, 70, 0.07), (1568, 70, 0.14), (2093, 220, 0.21)],
        "start": [(1568, 110, 0), (1568, 160, 0.16)],
        "rep": [(1318, 150, 0)], "down": [(784, 120, 0)], "up": [(1568, 120, 0)], "tick": [(1318, 60, 0)],
    ]
    private var toneCache: [String: AVAudioPCMBuffer] = [:]
    private func toneBuffer(_ kind: String) -> AVAudioPCMBuffer? {
        if let b = toneCache[kind] { return b }
        guard let parts = TimerSound.TONES[kind] else { return nil }
        let sr = format.sampleRate
        let total = parts.map { $0.2 + $0.1 / 1000 + 0.03 }.max() ?? 0.2
        let frames = AVAudioFrameCount(total * sr)
        guard let b = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames), let ch = b.floatChannelData else { return nil }
        b.frameLength = frames
        var mono = [Float](repeating: 0, count: Int(frames))
        for (hz, ms, off) in parts {
            let start = Int(off * sr), len = Int(ms / 1000 * sr)
            for i in 0..<len where start + i < mono.count {
                let t = Double(i) / sr
                let sq = (sin(2 * .pi * hz * t) >= 0 ? 1.0 : -1.0) + (sin(2 * .pi * hz * 1.005 * t) >= 0 ? 1.0 : -1.0)   // square, detuned pair
                let env = min(1, t / 0.006) * pow(0.0001, t / (ms / 1000))   // fast attack, exponential fall
                mono[start + i] += Float(sq * 0.5 * env * 0.42)
            }
        }
        for i in 0..<Int(frames) { let v = tanhf(mono[i] * 1.4); ch[0][i] = v; ch[1][i] = v }   // soft limit, hot like the web
        toneCache[kind] = b
        return b
    }
    private func playBeep(_ e: Event) {
        guard let b = toneBuffer(e.kind) else { return }
        let n = beepNodes[nextBeep % beepNodes.count]; nextBeep += 1
        if !n.isPlaying { n.play() }
        n.volume = e.gain
        n.scheduleBuffer(b, at: when(e.at / 1000), options: [], completionHandler: nil)
        if e.kind != "count" && e.kind != "rep" { beepEndsAt = max(beepEndsAt, e.at / 1000 + Double(b.frameLength) / format.sampleRate) }
    }

    // MARK: coach lines: pieces back to back, the way js/voice.js plays them
    private func playLine(_ e: Event) {
        load(e.urls) { [weak self] bufs in
            guard let self = self else { return }
            self.q.async {
                let now = Date().timeIntervalSince1970
                if e.cut { self.voiceNode.stop(); self.voiceNode.play(); self.voiceEndsAt = 0 }
                if !self.voiceNode.isPlaying { self.voiceNode.play() }
                var t = max(e.at / 1000, now + 0.03, self.beepEndsAt, e.cut ? 0 : self.voiceEndsAt)
                for (i, b) in bufs.enumerated() {
                    guard let b = b else { continue }
                    self.voiceNode.volume = e.gain
                    self.voiceNode.scheduleBuffer(b, at: self.when(t), options: [], completionHandler: nil)
                    let stop = i < e.stops.count ? e.stops[i] : false
                    t += Double(b.frameLength) / self.format.sampleRate - (stop ? 0.02 : 0.13)
                }
                self.voiceEndsAt = t
            }
        }
    }
    func preload(_ urls: [String]) { load(urls) { _ in } }
    private func load(_ urls: [String], done: @escaping ([AVAudioPCMBuffer?]) -> Void) {
        let group = DispatchGroup(); var out = [AVAudioPCMBuffer?](repeating: nil, count: urls.count)
        for (i, u) in urls.enumerated() { group.enter(); clip(u) { b in out[i] = b; group.leave() } }
        group.notify(queue: q) { done(out) }
    }
    private func clip(_ url: String, done: @escaping (AVAudioPCMBuffer?) -> Void) {
        q.async {
            if let b = self.clips[url] { return done(b) }
            if self.waiting[url] != nil { self.waiting[url]!.append(done); return }
            self.waiting[url] = [done]
            let finish: (AVAudioPCMBuffer?) -> Void = { b in self.q.async { if let b = b { self.clips[url] = b }; let cbs = self.waiting.removeValue(forKey: url) ?? []; cbs.forEach { $0(b) } } }
            let dir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("fj-voice", isDirectory: true)
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            /* a stable name: the voice's folder and the clip (…/voices/kevin/c-go.mp3 → kevin-c-go.mp3) */
            let comps = URL(string: url)?.pathComponents ?? []
            let file = dir.appendingPathComponent(comps.suffix(2).joined(separator: "-").isEmpty ? "clip.mp3" : comps.suffix(2).joined(separator: "-"))
            if FileManager.default.fileExists(atPath: file.path) { return finish(self.decode(file)) }
            guard let src = URL(string: url) else { return finish(nil) }
            URLSession.shared.downloadTask(with: src) { tmp, resp, _ in
                guard let tmp = tmp, (resp as? HTTPURLResponse)?.statusCode == 200 else { return finish(nil) }
                try? FileManager.default.removeItem(at: file); try? FileManager.default.moveItem(at: tmp, to: file)
                finish(self.decode(file))
            }.resume()
        }
    }
    /* any mp3 → the engine's stereo 44.1 kHz float */
    private func decode(_ file: URL) -> AVAudioPCMBuffer? {
        guard let f = try? AVAudioFile(forReading: file),
              let src = AVAudioPCMBuffer(pcmFormat: f.processingFormat, frameCapacity: AVAudioFrameCount(f.length)) else { return nil }
        do { try f.read(into: src) } catch { return nil }
        guard let conv = AVAudioConverter(from: f.processingFormat, to: format) else { return nil }
        let cap = AVAudioFrameCount(Double(src.frameLength) * format.sampleRate / f.processingFormat.sampleRate) + 1024
        guard let out = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: cap) else { return nil }
        var fed = false
        var err: NSError?
        conv.convert(to: out, error: &err) { _, status in
            if fed { status.pointee = .endOfStream; return nil }
            fed = true; status.pointee = .haveData; return src
        }
        return err == nil ? out : nil
    }
}

/* the page's handle on it: window.Capacitor.Plugins.TimerAudio */
@objc(TimerAudioPlugin)
public class TimerAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TimerAudioPlugin"
    public let jsName = "TimerAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "preload", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
    ]
    @objc func start(_ call: CAPPluginCall) { NSLog("[TimerAudio] start"); TimerSound.shared.start(); call.resolve() }
    @objc func stop(_ call: CAPPluginCall) { TimerSound.shared.stop(); call.resolve() }
    /* events: [{ at: epoch ms, kind: 'go'|'count'|…|'line', urls?: [..], stops?: [..], cut?: bool, tag?: '', gain?: 1 }] */
    @objc func play(_ call: CAPPluginCall) {
        let raw = call.getArray("events", JSObject.self) ?? []
        let evs = raw.map { o in TimerSound.Event(
            at: (o["at"] as? Double) ?? Date().timeIntervalSince1970 * 1000,
            kind: (o["kind"] as? String) ?? "tick",
            urls: (o["urls"] as? [String]) ?? [], stops: (o["stops"] as? [Bool]) ?? [],
            cut: (o["cut"] as? Bool) ?? false, tag: (o["tag"] as? String) ?? "",
            gain: Float((o["gain"] as? Double) ?? 1)) }
        NSLog("[TimerAudio] play %d: %@", evs.count, evs.map { $0.kind }.joined(separator: ","))
        TimerSound.shared.add(evs); call.resolve()
    }
    @objc func cancel(_ call: CAPPluginCall) { TimerSound.shared.cancel(tag: call.getString("tag") ?? ""); call.resolve() }
    @objc func preload(_ call: CAPPluginCall) { TimerSound.shared.preload(call.getArray("urls", String.self) ?? []); call.resolve() }
    @objc func status(_ call: CAPPluginCall) {
        call.resolve(["interrupted": TimerSound.shared.interrupted, "otherAudio": AVAudioSession.sharedInstance().isOtherAudioPlaying])
    }
}

/* the app's view controller, so the plugin is registered with the bridge */
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() { bridge?.registerPluginInstance(TimerAudioPlugin()) }
}
