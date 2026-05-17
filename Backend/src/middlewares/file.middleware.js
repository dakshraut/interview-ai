const multer = require("multer")


const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ]

        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error("Only PDF and DOCX resumes are supported."))
        }

        cb(null, true)
    }
})


module.exports = upload
