const express = require("express")
const cookieParser = require("cookie-parser")
const cors = require("cors")

const app = express()

const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean)

app.set("trust proxy", 1)
app.use(express.json())
app.use(cookieParser())
app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true)
        }

        return callback(new Error("Not allowed by CORS"))
    },
    credentials: true
}))

/* require all the routes here */
const authRouter = require("./routes/auth.routes")
const interviewRouter = require("./routes/interview.routes")


/* using all the routes here */
app.use("/api/auth", authRouter)
app.use("/api/interview", interviewRouter)

app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok" })
})

app.use((err, req, res, next) => {
    console.error(err)

    if (err.name === "MulterError") {
        return res.status(400).json({ message: err.message })
    }

    res.status(err.status || 500).json({
        message: err.message || "Something went wrong."
    })
})

module.exports = app
