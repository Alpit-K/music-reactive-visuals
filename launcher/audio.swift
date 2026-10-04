// vj-audio: read and set the macOS default output device, and read a device's sample rate.
// Core Audio directly, so the launcher needs no third-party tools (design §2: £0 software).
import CoreAudio
import Foundation

func prop(_ sel: AudioObjectPropertySelector, _ scope: AudioObjectPropertyScope = kAudioObjectPropertyScopeGlobal) -> AudioObjectPropertyAddress {
    AudioObjectPropertyAddress(mSelector: sel, mScope: scope, mElement: 0)
}

func devices() -> [AudioDeviceID] {
    var addr = prop(kAudioHardwarePropertyDevices)
    var size: UInt32 = 0
    AudioObjectGetPropertyDataSize(AudioObjectID(kAudioObjectSystemObject), &addr, 0, nil, &size)
    var ids = [AudioDeviceID](repeating: 0, count: Int(size) / MemoryLayout<AudioDeviceID>.size)
    AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &addr, 0, nil, &size, &ids)
    return ids
}

func name(_ id: AudioDeviceID) -> String {
    var addr = prop(kAudioObjectPropertyName)
    var value: Unmanaged<CFString>?
    var size = UInt32(MemoryLayout<Unmanaged<CFString>?>.size)
    guard AudioObjectGetPropertyData(id, &addr, 0, nil, &size, &value) == noErr, let v = value else { return "" }
    return v.takeRetainedValue() as String
}

func hasOutput(_ id: AudioDeviceID) -> Bool {
    var addr = prop(kAudioDevicePropertyStreams, kAudioObjectPropertyScopeOutput)
    var size: UInt32 = 0
    AudioObjectGetPropertyDataSize(id, &addr, 0, nil, &size)
    return size > 0
}

func find(_ wanted: String) -> AudioDeviceID? {
    devices().first { name($0) == wanted && hasOutput($0) }
}

let args = CommandLine.arguments
switch (args.count > 1 ? args[1] : "", args.count > 2 ? args[2] : "") {
case ("get", _):
    var addr = prop(kAudioHardwarePropertyDefaultOutputDevice)
    var id = AudioDeviceID(0)
    var size = UInt32(MemoryLayout<AudioDeviceID>.size)
    AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &addr, 0, nil, &size, &id)
    print(name(id))
case ("set", let wanted) where !wanted.isEmpty:
    guard var id = find(wanted) else { FileHandle.standardError.write("no output device named \(wanted)\n".data(using: .utf8)!); exit(1) }
    var addr = prop(kAudioHardwarePropertyDefaultOutputDevice)
    let status = AudioObjectSetPropertyData(AudioObjectID(kAudioObjectSystemObject), &addr, 0, nil, UInt32(MemoryLayout<AudioDeviceID>.size), &id)
    exit(status == noErr ? 0 : 1)
case ("rate", let wanted) where !wanted.isEmpty:
    guard let id = find(wanted) else { exit(1) }
    var addr = prop(kAudioDevicePropertyNominalSampleRate)
    var rate = Float64(0)
    var size = UInt32(MemoryLayout<Float64>.size)
    AudioObjectGetPropertyData(id, &addr, 0, nil, &size, &rate)
    print(Int(rate))
default:
    FileHandle.standardError.write("usage: vj-audio get | set <name> | rate <name>\n".data(using: .utf8)!)
    exit(2)
}
