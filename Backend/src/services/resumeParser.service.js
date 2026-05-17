const pdfParse = require("pdf-parse")
const mammoth = require("mammoth")

async function parseResume(file) {
    if (!file) {
        return ""
    }

    if (file.mimetype === "application/pdf") {
        const parser = new pdfParse.PDFParse(Uint8Array.from(file.buffer))
        const result = await parser.getText()
        return result.text.trim()
    }

    if (file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        const result = await mammoth.extractRawText({ buffer: file.buffer })
        return result.value.trim()
    }

    const error = new Error("Unsupported resume file type.")
    error.status = 400
    throw error
}

module.exports = { parseResume }
