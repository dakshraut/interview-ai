const { GoogleGenAI } = require("@google/genai")
const { z } = require("zod")
const { zodToJsonSchema } = require("zod-to-json-schema")
const puppeteer = require("puppeteer")

const interviewReportSchema = z.object({
    matchScore: z.number().min(0).max(100),
    technicalQuestions: z.array(z.object({
        question: z.string(),
        intention: z.string(),
        answer: z.string()
    })).min(5),
    behavioralQuestions: z.array(z.object({
        question: z.string(),
        intention: z.string(),
        answer: z.string()
    })).min(3),
    skillGaps: z.array(z.object({
        skill: z.string(),
        severity: z.enum([ "low", "medium", "high" ])
    })),
    preparationPlan: z.array(z.object({
        day: z.number(),
        focus: z.string(),
        tasks: z.array(z.string())
    })).min(5),
    title: z.string()
})

const resumePdfSchema = z.object({
    html: z.string()
})

function getAiClient() {
    if (!process.env.GOOGLE_GENAI_API_KEY) {
        return null
    }

    return new GoogleGenAI({
        apiKey: process.env.GOOGLE_GENAI_API_KEY
    })
}

function parseJsonResponse(responseText) {
    const cleanText = responseText.replace(/^```json\s*|\s*```$/g, "").trim()
    return JSON.parse(cleanText)
}

function buildFallbackReport({ resume, selfDescription, jobDescription }) {
    const combinedProfile = `${resume || ""} ${selfDescription || ""}`.toLowerCase()
    const jobText = jobDescription.toLowerCase()
    const skills = [
        "react", "node", "express", "mongodb", "jwt", "rest api", "typescript",
        "javascript", "system design", "testing", "docker", "aws", "sql"
    ]

    const requiredSkills = skills.filter(skill => jobText.includes(skill))
    const matchedSkills = requiredSkills.filter(skill => combinedProfile.includes(skill))
    const missingSkills = requiredSkills.filter(skill => !combinedProfile.includes(skill))
    const matchScore = requiredSkills.length
        ? Math.max(35, Math.round((matchedSkills.length / requiredSkills.length) * 100))
        : 70

    return {
        title: "Target Role Interview Plan",
        matchScore,
        technicalQuestions: [
            {
                question: "Walk me through a full-stack feature you built end to end.",
                intention: "Evaluate ownership across frontend, backend, database, and deployment concerns.",
                answer: "Frame the business problem, your architecture, the APIs and data model, tradeoffs, testing, and the measurable outcome."
            },
            {
                question: "How would you secure JWT authentication in this application?",
                intention: "Check practical understanding of token storage, expiration, revocation, and route protection.",
                answer: "Mention HTTP-only cookies, short token lifetime, strong secrets, server-side blacklist on logout, CORS restrictions, and middleware verification."
            },
            {
                question: "How would you design resume parsing for PDF and DOCX files?",
                intention: "Assess file handling, text extraction, validation, and failure handling.",
                answer: "Validate file type and size, parse in memory, normalize extracted text, reject unsupported files, and log parsing failures without exposing internals."
            },
            {
                question: "How would you make AI responses reliable for skill gap detection?",
                intention: "Probe prompt design, schemas, validation, and fallback behavior.",
                answer: "Use structured JSON schema output, validate with Zod, retry or fall back when parsing fails, and store the final validated report."
            },
            {
                question: "How would you generate an ATS-friendly resume PDF?",
                intention: "Check understanding of readable resume structure and dynamic PDF generation.",
                answer: "Generate semantic HTML, avoid complex layouts, keep clear headings and bullet points, render through Puppeteer, and return a downloadable PDF."
            }
        ],
        behavioralQuestions: [
            {
                question: "Tell me about a time you shipped a project under unclear requirements.",
                intention: "Understand how you clarify scope and make progress.",
                answer: "Use STAR: describe ambiguity, the questions you asked, the small milestone you chose, and the delivered result."
            },
            {
                question: "Describe a bug that taught you something important.",
                intention: "Evaluate debugging maturity and learning mindset.",
                answer: "Focus on root cause analysis, prevention, and how you improved tests, monitoring, or code review afterward."
            },
            {
                question: "How do you handle feedback on your code?",
                intention: "Assess collaboration and coachability.",
                answer: "Show that you separate ego from code, ask clarifying questions, apply feedback, and update your mental model."
            }
        ],
        skillGaps: (missingSkills.length ? missingSkills : [ "role-specific keywords", "quantified achievements" ]).map((skill, index) => ({
            skill,
            severity: index < 2 ? "high" : "medium"
        })),
        preparationPlan: [
            { day: 1, focus: "Resume and job description alignment", tasks: [ "Highlight matching keywords", "Rewrite two project bullets with metrics" ] },
            { day: 2, focus: "Core technical review", tasks: [ "Review backend APIs and auth flow", "Practice explaining database schema choices" ] },
            { day: 3, focus: "AI and resume parsing workflow", tasks: [ "Explain prompt/schema validation", "Prepare file upload edge cases" ] },
            { day: 4, focus: "Mock interview practice", tasks: [ "Answer five technical questions out loud", "Record and tighten answers" ] },
            { day: 5, focus: "Behavioral stories", tasks: [ "Prepare three STAR stories", "Connect each story to the target role" ] }
        ]
    }
}

async function generateInterviewReport({ resume, selfDescription, jobDescription }) {
    const ai = getAiClient()

    if (!ai) {
        return buildFallbackReport({ resume, selfDescription, jobDescription })
    }

    const prompt = `
Generate an interview preparation report for this candidate.

Return only valid JSON matching the schema. Include:
- a realistic matchScore from 0 to 100
- at least 5 technical questions
- at least 3 behavioral questions
- practical skill gaps with severity
- a 5 to 7 day preparation plan
- a concise target role title inferred from the job description

Resume:
${resume || "No resume provided"}

Self description:
${selfDescription || "No self description provided"}

Job description:
${jobDescription}
`

    const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: zodToJsonSchema(interviewReportSchema)
        }
    })

    return interviewReportSchema.parse(parseJsonResponse(response.text))
}

async function generatePdfFromHtml(htmlContent) {
    const browser = await puppeteer.launch({
        headless: "new",
        args: [ "--no-sandbox", "--disable-setuid-sandbox" ]
    })

    try {
        const page = await browser.newPage()
        await page.setContent(htmlContent, { waitUntil: "networkidle0" })

        return await page.pdf({
            format: "A4",
            printBackground: true,
            margin: {
                top: "16mm",
                bottom: "16mm",
                left: "14mm",
                right: "14mm"
            }
        })
    } finally {
        await browser.close()
    }
}

function fallbackResumeHtml({ resume, selfDescription }) {
    const safeSummary = (selfDescription || "Full-stack developer with practical experience building user-facing applications, secure APIs, and AI-assisted workflows.").replace(/[<>]/g, "")
    const safeResume = (resume || "").replace(/[<>]/g, "").split("\n").filter(Boolean).slice(0, 12)

    return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; color: #1f2933; line-height: 1.45; }
    h1 { font-size: 26px; margin: 0 0 6px; }
    h2 { font-size: 15px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-top: 22px; }
    p, li { font-size: 11.5px; }
    ul { padding-left: 18px; }
  </style>
</head>
<body>
  <h1>ATS Optimized Resume</h1>
  <p>${safeSummary}</p>
  <h2>Relevant Experience</h2>
  <ul>${safeResume.map(line => `<li>${line}</li>`).join("") || "<li>Built full-stack applications with secure authentication, API integration, and responsive UI.</li>"}</ul>
  <h2>Core Strengths</h2>
  <ul>
    <li>Full-stack web development</li>
    <li>JWT authentication and protected APIs</li>
    <li>AI-assisted analysis and content generation</li>
    <li>Resume parsing, skill extraction, and interview preparation workflows</li>
  </ul>
</body>
</html>`
}

async function generateResumePdf({ resume, selfDescription, jobDescription }) {
    const ai = getAiClient()

    if (!ai) {
        return generatePdfFromHtml(fallbackResumeHtml({ resume, selfDescription }))
    }

    const prompt = `
Create an ATS-friendly resume tailored to the job description below.
Return only JSON with one field: html.
The HTML must be professional, text-based, semantic, and suitable for A4 PDF rendering.

Resume:
${resume || "No resume provided"}

Self description:
${selfDescription || "No self description provided"}

Job description:
${jobDescription}
`

    const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: zodToJsonSchema(resumePdfSchema)
        }
    })

    const jsonContent = resumePdfSchema.parse(parseJsonResponse(response.text))
    return generatePdfFromHtml(jsonContent.html)
}

module.exports = { generateInterviewReport, generateResumePdf }
