import AppKit
import CoreImage
import Foundation

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let linksFile = root.appendingPathComponent("exhibition-links.md")
let output = root.appendingPathComponent("artwork-qr-codes", isDirectory: true)
let lines = try String(contentsOf: linksFile, encoding: .utf8).components(separatedBy: .newlines)
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)

func xml(_ value: String) -> String {
    value.replacingOccurrences(of: "&", with: "&amp;")
        .replacingOccurrences(of: "<", with: "&lt;")
        .replacingOccurrences(of: ">", with: "&gt;")
        .replacingOccurrences(of: "\"", with: "&quot;")
}

var title = ""
var count = 0
for line in lines {
    if line.hasPrefix("- **"), let end = line.range(of: "**", range: line.index(line.startIndex, offsetBy: 4)..<line.endIndex) {
        title = String(line[line.index(line.startIndex, offsetBy: 4)..<end.lowerBound])
        continue
    }
    let link = line.trimmingCharacters(in: .whitespaces)
    guard link.hasPrefix("https://pcdizmir.kodart.xyz/exhibition.html#"),
          let id = URL(string: link)?.fragment,
          !id.isEmpty else { continue }

    let filter = CIFilter(name: "CIQRCodeGenerator")!
    filter.setValue(Data(link.utf8), forKey: "inputMessage")
    filter.setValue("H", forKey: "inputCorrectionLevel")
    let image = filter.outputImage!
    let cgImage = CIContext(options: [.useSoftwareRenderer: true]).createCGImage(image, from: image.extent)!
    let bitmap = NSBitmapImageRep(cgImage: cgImage)
    let size = bitmap.pixelsWide
    precondition(bitmap.pixelsHigh == size)

    let modules = (0..<size).map { y in
        (0..<size).map { x in bitmap.colorAt(x: x, y: y)!.redComponent < 0.5 }
    }

    let margin = 0
    let viewSize = size + margin * 2
    var path = ""
    for y in 0..<size {
        var x = 0
        while x < size {
            if !modules[y][x] { x += 1; continue }
            let start = x
            while x < size && modules[y][x] { x += 1 }
            let run = x - start
            path += "M\(start + margin) \(y + margin)h\(run)v1h-\(run)z"
        }
    }
    let svg = """
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 \(viewSize) \(viewSize)" shape-rendering="crispEdges">
      <title>\(xml(title)) QR code</title>
      <desc>\(xml(link))</desc>
      <rect width="\(viewSize)" height="\(viewSize)" fill="#fff"/>
      <path d="\(path)" fill="#000"/>
    </svg>
    """
    try svg.write(to: output.appendingPathComponent("\(id).svg"), atomically: true, encoding: .utf8)
    count += 1
}
print("Generated \(count) SVG QR codes in artwork-qr-codes/.")
