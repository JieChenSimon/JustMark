import AppKit
import PDFKit
import SwiftUI

struct PDFPreviewView: NSViewRepresentable {
    let data: Data?

    func makeNSView(context: Context) -> PDFView {
        let view = PDFView()
        view.autoScales = true
        view.displayMode = .singlePageContinuous
        view.displayDirection = .vertical
        view.backgroundColor = .white
        view.displayBox = .cropBox
        view.document = PDFDocument()
        return view
    }

    func updateNSView(_ nsView: PDFView, context: Context) {
        guard let data else {
            nsView.document = PDFDocument()
            return
        }

        if nsView.document?.documentRef == nil {
            nsView.document = PDFDocument(data: data)
            return
        }

        if let current = nsView.document?.dataRepresentation(), current != data {
            nsView.document = PDFDocument(data: data)
        }
    }
}
