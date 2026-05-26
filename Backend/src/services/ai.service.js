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
    })).min(7),
    behavioralQuestions: z.array(z.object({
        question: z.string(),
        intention: z.string(),
        answer: z.string()
    })).min(5),
    skillGaps: z.array(z.object({
        skill: z.string(),
        severity: z.enum([ "low", "medium", "high" ])
    })),
    preparationPlan: z.array(z.object({
        day: z.number(),
        focus: z.string(),
        tasks: z.array(z.string())
    })).min(7),
    projectStories: z.array(z.object({
        projectName: z.string(),
        positioning: z.string(),
        pitch: z.string(),
        technicalDeepDive: z.string(),
        architecture: z.array(z.string()),
        challenges: z.array(z.string()),
        followUps: z.array(z.string())
    })).min(2),
    title: z.string()
})

const resumePdfSchema = z.object({
    html: z.string()
})

const answerFeedbackSchema = z.object({
    score: z.number().min(0).max(100),
    verdict: z.string(),
    strengths: z.array(z.string()),
    improvements: z.array(z.string()),
    improvedAnswer: z.string(),
    followUpQuestions: z.array(z.string())
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

const SKILL_CATALOG = [
    { key: "react", label: "React", aliases: [ "react", "react.js", "reactjs" ] },
    { key: "node", label: "Node.js", aliases: [ "node", "node.js", "nodejs" ] },
    { key: "express", label: "Express.js", aliases: [ "express", "express.js", "expressjs" ] },
    { key: "mongodb", label: "MongoDB", aliases: [ "mongodb", "mongo db", "mongoose" ] },
    { key: "jwt", label: "JWT", aliases: [ "jwt", "json web token", "json web tokens" ] },
    { key: "rest api", label: "REST APIs", aliases: [ "rest api", "rest apis", "restful", "api development" ] },
    { key: "typescript", label: "TypeScript", aliases: [ "typescript", "ts" ] },
    { key: "javascript", label: "JavaScript", aliases: [ "javascript", "ecmascript" ] },
    { key: "system design", label: "system design", aliases: [ "system design", "architecture", "scalable systems" ] },
    { key: "testing", label: "testing", aliases: [ "testing", "unit test", "integration test", "jest", "vitest", "cypress", "playwright" ] },
    { key: "docker", label: "Docker", aliases: [ "docker", "container", "containers" ] },
    { key: "aws", label: "AWS", aliases: [ "aws", "amazon web services", "ec2", "s3", "lambda" ] },
    { key: "sql", label: "SQL", aliases: [ "sql", "mysql", "postgresql", "postgres", "database" ] },
    { key: "python", label: "Python", aliases: [ "python", "django", "flask", "fastapi" ] },
    { key: "java", label: "Java", aliases: [ "java", "spring boot", "spring" ] },
    { key: "html", label: "HTML", aliases: [ "html", "html5" ] },
    { key: "css", label: "CSS", aliases: [ "css", "css3", "scss", "sass" ] },
    { key: "tailwind", label: "Tailwind CSS", aliases: [ "tailwind", "tailwind css" ] },
    { key: "redux", label: "Redux", aliases: [ "redux", "redux toolkit" ] },
    { key: "git", label: "Git", aliases: [ "git", "github", "version control" ] },
    { key: "ci/cd", label: "CI/CD", aliases: [ "ci/cd", "ci cd", "github actions", "deployment pipeline" ] }
]

const STOP_WORDS = new Set([
    "about", "above", "after", "again", "against", "also", "and", "any", "are", "because", "been",
    "being", "below", "between", "both", "but", "can", "candidate", "company", "could", "day",
    "description", "developer", "during", "each", "engineer", "experience", "from", "full", "have",
    "into", "job", "more", "must", "our", "role", "should", "stack", "that", "the", "their", "this",
    "through", "using", "with", "work", "will", "years", "your"
])

function textHasAlias(text, aliases) {
    return aliases.some(alias => {
        const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")
        return new RegExp(`(^|[^a-z0-9])${escapedAlias}([^a-z0-9]|$)`, "i").test(text)
    })
}

function extractSkills(text = "") {
    const lowerText = text.toLowerCase()
    return SKILL_CATALOG
        .filter(skill => textHasAlias(lowerText, skill.aliases))
        .map(skill => skill.key)
}

function tokenizeImportantWords(text = "") {
    return [ ...new Set(text
        .toLowerCase()
        .replace(/[^a-z0-9+#./-]+/g, " ")
        .split(/\s+/)
        .map(word => word.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ""))
        .filter(word => word.length >= 3 && !STOP_WORDS.has(word))
    ) ]
}

function calculateMatchScore({ resume, selfDescription, jobDescription, requiredSkills, matchedSkills, missingSkills }) {
    const profileText = `${resume || ""} ${selfDescription || ""}`
    const profileWords = tokenizeImportantWords(profileText)
    const jobWords = tokenizeImportantWords(jobDescription).slice(0, 80)
    const profileWordSet = new Set(profileWords)
    const keywordMatches = jobWords.filter(word => profileWordSet.has(word)).length
    const keywordScore = jobWords.length ? keywordMatches / jobWords.length : 0
    const skillScore = requiredSkills.length ? matchedSkills.length / requiredSkills.length : keywordScore
    const evidenceSignals = [
        profileWords.length >= 80,
        profileWords.length >= 180,
        /\b(project|built|developed|implemented|created|designed|optimized)\b/i.test(profileText),
        /\b\d+%|\b\d+\+|\b\d+\s*(year|month|user|client|project|api|feature)/i.test(profileText),
        /github|linkedin|portfolio|certification|internship|experience/i.test(profileText)
    ]
    const evidenceScore = evidenceSignals.filter(Boolean).length / evidenceSignals.length
    const baseScore = requiredSkills.length ? 22 : 28
    const rawScore = baseScore + (skillScore * 45) + (keywordScore * 23) + (evidenceScore * 10)
    const gapPenalty = Math.min(12, missingSkills.length * 3)
    const finalScore = Math.round(rawScore - gapPenalty)

    if (!profileText.trim()) {
        return 15
    }

    return Math.max(18, Math.min(96, finalScore))
}

function displaySkill(skill) {
    return SKILL_CATALOG.find(item => item.key === skill)?.label || skill
}

function buildTechnicalQuestions(requiredSkills, missingSkills) {
    const primarySkills = (requiredSkills.length ? requiredSkills : [ "javascript", "react", "node", "rest api", "sql" ])
        .map(displaySkill)
        .slice(0, 5)
    const weakestArea = displaySkill(missingSkills[0] || requiredSkills[0] || "role-specific fundamentals")

    return [
        {
            question: `Design and explain a production-ready feature using ${primarySkills.slice(0, 3).join(", ")}. What APIs, data model, validation, and edge cases would you include?`,
            intention: "Tests whether the candidate can connect the role's core stack to a complete implementation plan.",
            answer: "Start with the user goal, sketch the data model, name the API endpoints and request/response shapes, describe frontend state and error handling, then close with validation, security, tests, and tradeoffs."
        },
        {
            question: "Walk me through one project from your resume as if I am reviewing your pull request. What problem did you solve and what would you improve now?",
            intention: "Evaluates depth of ownership, code reasoning, and ability to discuss real project decisions beyond surface keywords.",
            answer: "Use a clear project narrative: context, your responsibility, architecture choices, difficult bugs, measurable result, and one honest improvement such as tests, caching, accessibility, or cleaner module boundaries."
        },
        {
            question: `If a page or API built with ${primarySkills[0]} becomes slow in production, how would you diagnose and fix it?`,
            intention: "Checks debugging method, performance awareness, and ability to move from symptoms to evidence.",
            answer: "Mention reproducing the issue, checking browser/network/server logs, measuring query/API latency, profiling render or database bottlenecks, applying the smallest fix, and verifying with before/after metrics."
        },
        {
            question: "How would you secure authentication and authorization for this application?",
            intention: "Assesses practical security thinking for real user accounts and protected routes.",
            answer: "Cover password hashing, token/session strategy, HTTP-only cookies where appropriate, route-level authorization, token expiry, logout/revocation, input validation, rate limiting, and safe error messages."
        },
        {
            question: `You are assigned a task involving ${weakestArea}, which is a gap area for you. How would you learn enough to ship it safely in one week?`,
            intention: "Measures learning strategy, risk management, and honesty around skill gaps.",
            answer: "Break the gap into concepts, build a tiny proof of concept, compare against official docs or known patterns, ask focused questions, add tests, and document assumptions before merging."
        },
        {
            question: "Explain how you would test this application from unit level to user workflow level.",
            intention: "Checks whether the candidate can protect behavior, not just write code.",
            answer: "Name unit tests for pure logic, integration tests for API/database behavior, component tests for UI states, one end-to-end happy path, and regression tests for previous bugs or high-risk validation."
        },
        {
            question: "Describe how data should flow from the database to the UI in this role's stack. Where can bugs usually enter?",
            intention: "Evaluates system thinking across persistence, API contracts, frontend state, and rendering.",
            answer: "Trace database query, service/controller logic, serialized API response, client fetching, state updates, loading/error states, and UI rendering. Call out common bugs like null data, stale state, mismatched field names, and missing authorization checks."
        }
    ]
}

function buildBehavioralQuestions() {
    return [
        {
            question: "Tell me about a project where requirements changed after you had already started building.",
            intention: "Assesses adaptability, communication, and how the candidate protects delivery under ambiguity.",
            answer: "Use STAR. Explain the original plan, what changed, how you clarified scope, what tradeoff you made, and the outcome. Include how you kept stakeholders or teammates aligned."
        },
        {
            question: "Describe a difficult bug you solved. How did you avoid guessing?",
            intention: "Evaluates debugging discipline and ability to learn from production or project issues.",
            answer: "Describe the symptom, evidence gathered, hypotheses tested, root cause, fix, verification, and the prevention step such as a test, log, guard clause, or documentation update."
        },
        {
            question: "Give an example of feedback you received on your code or approach. What changed afterward?",
            intention: "Checks coachability, collaboration, and maturity in code review.",
            answer: "Choose specific feedback, explain your initial understanding, how you applied it, and how it improved quality, maintainability, or teamwork. Avoid sounding defensive."
        },
        {
            question: "Tell me about a time you had to learn a tool or concept quickly to finish a task.",
            intention: "Tests learning velocity and whether the candidate can become productive without perfect preparation.",
            answer: "Share how you narrowed the learning scope, used docs or examples, built a small experiment, asked targeted questions, and delivered a working result."
        },
        {
            question: "When you have multiple tasks and limited time before a deadline, how do you prioritize?",
            intention: "Assesses judgment, ownership, and communication under delivery pressure.",
            answer: "Talk about ranking by user impact and risk, identifying blockers, making a small delivery plan, communicating tradeoffs early, and leaving the codebase in a stable state."
        }
    ]
}

function buildPreparationPlan(requiredSkills, missingSkills) {
    const targetSkills = (requiredSkills.length ? requiredSkills : [ "javascript", "react", "node", "rest api", "sql" ]).map(displaySkill)
    const gapSkills = (missingSkills.length ? missingSkills : [ "project metrics", "role-specific keywords" ]).map(displaySkill)

    return [
        { day: 1, focus: "Role mapping and resume story", tasks: [ `Map the job description to your strongest evidence for ${targetSkills.slice(0, 4).join(", ")}.`, "Prepare a 60-second introduction that connects your resume, projects, and target role.", "Rewrite three resume/project bullets with action, technology, and measurable impact." ] },
        { day: 2, focus: "Project deep dive", tasks: [ "Pick two projects and write the architecture, data flow, tradeoffs, and one improvement for each.", "Practice explaining one project in 2 minutes, then again in 5 minutes with technical details.", "Prepare answers for expected follow-ups about bugs, scaling, security, and testing." ] },
        { day: 3, focus: "Core technical refresh", tasks: [ `Review fundamentals for ${targetSkills.slice(0, 3).join(", ")} using small examples from your own code.`, "Build or revise one small feature that includes validation, loading/error states, and clean API handling.", "Write five flashcards for concepts you hesitate on." ] },
        { day: 4, focus: "Gap-closing sprint", tasks: [ `Spend focused practice time on ${gapSkills.slice(0, 2).join(" and ")}.`, "Create a tiny proof of concept or notes page that proves you can explain the gap area.", "Turn each gap into a confident interview sentence: what you know, what you have built, and how you would learn more." ] },
        { day: 5, focus: "Behavioral answer practice", tasks: [ "Prepare five STAR stories: ambiguity, bug, feedback, conflict, and deadline pressure.", "Record your answers and remove vague phrases or repeated filler.", "Attach each story to a positive signal: ownership, learning, collaboration, reliability, or impact." ] },
        { day: 6, focus: "Mock interview and correction", tasks: [ "Run a 45-minute mock: 20 minutes technical, 15 minutes project discussion, 10 minutes behavioral.", "Score each answer on clarity, depth, evidence, and confidence.", "Rewrite weak answers into concise answer frameworks, not memorized scripts." ] },
        { day: 7, focus: "Final readiness pass", tasks: [ "Review your strongest project, top skill gaps, and salary/role expectations.", "Prepare 4 thoughtful questions for the interviewer about team, stack, success metrics, and onboarding.", "Do a final light practice round and stop cramming at least one hour before the interview." ] }
    ]
}

function buildProjectStories({ resume, selfDescription, requiredSkills }) {
    const targetSkills = (requiredSkills.length ? requiredSkills : [ "javascript", "react", "node", "rest api" ]).map(displaySkill)
    const profileText = `${resume || ""} ${selfDescription || ""}`
    const projectSignals = profileText
        .split(/\n+/)
        .map(line => line.replace(/\s+/g, " ").trim())
        .filter(line => /\b(project|built|developed|implemented|created|designed|optimized|app|platform|system)\b/i.test(line))
        .slice(0, 2)

    const projectNames = projectSignals.length
        ? projectSignals.map((line, index) => line.split(/[|:-]/)[0].slice(0, 54).trim() || `Project ${index + 1}`)
        : [ "Primary Resume Project", "Most Relevant Technical Project" ]

    return projectNames.map((projectName, index) => ({
        projectName,
        positioning: `Use this story to prove hands-on ownership with ${targetSkills.slice(0, 3).join(", ")} and practical product thinking.`,
        pitch: `I built ${projectName} to solve a clear user or workflow problem, focusing on reliable implementation, clean data flow, and measurable improvements. My role covered the main technical decisions, debugging, and turning requirements into a working result.`,
        technicalDeepDive: `Explain the user flow first, then cover the frontend state, API contract, validation, persistence layer, error handling, and the tradeoff you made to keep the solution maintainable.`,
        architecture: [
            `Frontend or client layer captures user intent and handles loading, empty, and error states.`,
            `Backend/API layer validates input, applies business logic, and returns predictable response shapes.`,
            `Data layer stores the core entities and supports the most common read/write paths.`
        ],
        challenges: [
            "Name one bug or edge case, the evidence you gathered, and how you verified the fix.",
            "Describe one performance, security, or maintainability tradeoff you considered.",
            index === 0 ? "Connect the result to user impact, saved time, accuracy, or reliability." : "Explain what you would improve next if you had another week."
        ],
        followUps: [
            "What was the hardest technical decision in this project?",
            "How would you scale or secure this if real users depended on it?",
            "What would you refactor after reviewing the code today?"
        ]
    }))
}

function normalizePreparationPlan(plan = []) {
    return plan
        .filter(day => day && day.focus && Array.isArray(day.tasks))
        .sort((a, b) => (Number(a.day) || 0) - (Number(b.day) || 0))
        .map((day, index) => ({
            ...day,
            day: index + 1,
            tasks: day.tasks.filter(Boolean).slice(0, 3)
        }))
}

function normalizeProjectStories(stories = [], fallbackArgs = {}) {
    const fallbackStories = buildProjectStories(fallbackArgs)
    const validStories = stories
        .filter(story => story && story.projectName && story.pitch && story.technicalDeepDive)
        .map(story => ({
            projectName: story.projectName,
            positioning: story.positioning || "Use this story to prove ownership, decision-making, and role fit.",
            pitch: story.pitch,
            technicalDeepDive: story.technicalDeepDive,
            architecture: Array.isArray(story.architecture) && story.architecture.length ? story.architecture.slice(0, 4) : fallbackStories[0].architecture,
            challenges: Array.isArray(story.challenges) && story.challenges.length ? story.challenges.slice(0, 4) : fallbackStories[0].challenges,
            followUps: Array.isArray(story.followUps) && story.followUps.length ? story.followUps.slice(0, 4) : fallbackStories[0].followUps
        }))

    return [ ...validStories, ...fallbackStories ].slice(0, 3)
}

function buildFallbackReport({ resume, selfDescription, jobDescription }) {
    const combinedProfile = `${resume || ""} ${selfDescription || ""}`.toLowerCase()
    const requiredSkills = extractSkills(jobDescription)
    const matchedSkills = requiredSkills.filter(skill => textHasAlias(combinedProfile, SKILL_CATALOG.find(item => item.key === skill)?.aliases || [ skill ]))
    const missingSkills = requiredSkills.filter(skill => !textHasAlias(combinedProfile, SKILL_CATALOG.find(item => item.key === skill)?.aliases || [ skill ]))
    const matchScore = calculateMatchScore({ resume, selfDescription, jobDescription, requiredSkills, matchedSkills, missingSkills })

    const projectStories = buildProjectStories({ resume, selfDescription, requiredSkills })

    return {
        title: "Target Role Interview Plan",
        matchScore,
        technicalQuestions: buildTechnicalQuestions(requiredSkills, missingSkills),
        behavioralQuestions: buildBehavioralQuestions(),
        skillGaps: (missingSkills.length ? missingSkills : [ "quantified achievements", "interview-ready project stories" ]).map((skill, index) => ({
            skill: displaySkill(skill),
            severity: missingSkills.length ? (index < 2 ? "high" : "medium") : "low"
        })),
        preparationPlan: normalizePreparationPlan(buildPreparationPlan(requiredSkills, missingSkills)),
        projectStories
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
- at least 7 technical questions
- at least 5 behavioral questions
- practical skill gaps with severity
- a 7 day preparation roadmap
- at least 2 projectStories that turn resume projects into interview-ready narratives
- a concise target role title inferred from the job description

Quality requirements:
- Score honestly. Use 90+ only for excellent evidence, 75-89 for strong alignment, 55-74 for partial alignment, 35-54 for weak alignment, and below 35 for poor fit.
- The matchScore must reflect skill overlap, relevant project evidence, seniority/experience match, missing required skills, and resume quality. Do not default to 70.
- Technical questions must be specific to the job description and the candidate's resume/projects, not generic trivia.
- Each technical answer should be an interview-ready answer strategy: what to mention, tradeoffs, edge cases, tests, and signals of seniority where relevant.
- Behavioral questions must cover real hiring signals: ownership, ambiguity, feedback, debugging, learning speed, teamwork, and deadlines.
- Behavioral answers must use a STAR-style structure and tell the candidate what evidence to include.
- Roadmap days must be exactly Day 1 through Day 7 in order. Do not start at Day 2, Day 3, or any later day.
- Roadmap tasks must be practical and output-oriented. Each day should include exactly 3 concrete tasks that create a deliverable, practice loop, or measurable improvement.
- Project stories must be specific to the candidate evidence. Each story needs a short pitch, a technical deep dive, architecture talking points, challenges, and interviewer follow-up questions.
- Do not repeat the same advice across sections.

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

    const report = interviewReportSchema.parse(parseJsonResponse(response.text))
    return {
        ...report,
        preparationPlan: normalizePreparationPlan(report.preparationPlan),
        projectStories: normalizeProjectStories(report.projectStories, { resume, selfDescription, requiredSkills: extractSkills(jobDescription) })
    }
}

function buildFallbackAnswerFeedback({ question, answer, idealAnswer }) {
    const wordCount = answer.trim().split(/\s+/).filter(Boolean).length
    const hasStructure = /\b(context|situation|task|action|result|first|then|finally|because)\b/i.test(answer)
    const hasEvidence = /\b\d+%|\b\d+\+|\b\d+\s*(user|client|project|api|day|week|month|second|minute)/i.test(answer)
    const hasTradeoff = /\b(tradeoff|edge case|test|verify|metric|security|scale|performance|maintain)\b/i.test(answer)
    const score = Math.max(35, Math.min(92, 38 + Math.min(28, wordCount) + (hasStructure ? 12 : 0) + (hasEvidence ? 10 : 0) + (hasTradeoff ? 9 : 0)))

    return {
        score,
        verdict: score >= 80 ? "Strong answer with clear interview signal." : score >= 62 ? "Good base answer, but it needs sharper evidence." : "Needs more structure, detail, and proof.",
        strengths: [
            wordCount >= 35 ? "You gave enough material to evaluate instead of staying too vague." : "You have a clear starting point for the answer.",
            hasStructure ? "The answer has some sequencing, which makes it easier to follow." : "The core idea can become stronger with a simple beginning, middle, and result."
        ],
        improvements: [
            hasEvidence ? "Tie the metric directly to your action so the impact feels earned." : "Add one measurable result, scale detail, or before/after improvement.",
            hasTradeoff ? "Close with how you verified the decision worked." : "Mention one tradeoff, edge case, test, or debugging step."
        ],
        improvedAnswer: `I would answer this by first stating the context for "${question}", then naming the exact responsibility I owned. I would describe the decision or implementation steps, include one tradeoff or failure mode, and close with the result. A strong version should include evidence from my project and connect back to this role. ${idealAnswer ? `I would also make sure to cover: ${idealAnswer}` : ""}`.trim(),
        followUpQuestions: [
            "What specific evidence or metric proves your answer?",
            "What tradeoff did you consider and why?",
            "What would you improve if you faced the same situation again?"
        ]
    }
}

async function generateAnswerFeedback({ question, answer, intention, idealAnswer, questionType, resume, selfDescription, jobDescription }) {
    const ai = getAiClient()

    if (!answer?.trim()) {
        throw new Error("Answer is required.")
    }

    if (!ai) {
        return buildFallbackAnswerFeedback({ question, answer, idealAnswer })
    }

    const prompt = `
Review this candidate's interview answer.

Return only valid JSON matching the schema:
- score from 0 to 100
- verdict as one short sentence
- strengths as 2-3 concise bullets
- improvements as 2-4 concise bullets
- improvedAnswer as a polished interview answer the candidate can adapt
- followUpQuestions as 3 likely interviewer follow-ups

Question type: ${questionType || "general"}
Question: ${question}
Question intention: ${intention || "Not provided"}
Reference answer strategy: ${idealAnswer || "Not provided"}

Candidate answer:
${answer}

Candidate resume:
${resume || "No resume provided"}

Self description:
${selfDescription || "No self description provided"}

Job description:
${jobDescription || "No job description provided"}
`

    const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: zodToJsonSchema(answerFeedbackSchema)
        }
    })

    return answerFeedbackSchema.parse(parseJsonResponse(response.text))
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

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
}

function normalizeResumeLines(text = "") {
    const boilerplate = new Set([
        "ATS Optimized Resume",
        "Relevant Experience",
        "Core Strengths",
        "Full-stack web development",
        "JWT authentication and protected APIs",
        "AI-assisted analysis and content generation",
        "Resume parsing, skill extraction, and interview preparation workflows"
    ])

    return text
        .replace(/\r/g, "\n")
        .split("\n")
        .map(line => line.replace(/\s+/g, " ").trim())
        .filter(line => line && !/^--\s*\d+\s+of\s+\d+\s*--$/i.test(line))
        .filter(line => !boilerplate.has(line.replace(/[.]+$/, "")))
        .filter(line => !line.toLowerCase().startsWith("full-stack developer with practical experience building user-facing applications"))
}

function extractContact(lines) {
    const text = lines.join(" ")
    const emails = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []
    const phones = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/g) || []
    const textWithoutEmails = emails.reduce((value, email) => value.replace(email, " "), text)
    const links = textWithoutEmails.match(/(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com|github\.com|portfolio\.|[a-z0-9-]+\.[a-z]{2,})(?:\/[^\s,;]*)?/gi) || []

    return [ ...new Set([ ...phones, ...emails, ...links ]) ]
        .map(item => item.replace(/[.,;]+$/, ""))
        .slice(0, 6)
}

function inferCandidateName(lines) {
    const sectionNames = new Set([
        "summary", "profile", "education", "experience", "work experience", "professional experience",
        "projects", "skills", "technical skills", "certifications", "achievements", "coursework",
        "relevant coursework", "core strengths"
    ])

    return lines.find(line => {
        const normalized = line.toLowerCase()
        const words = line.split(/\s+/)
        return words.length >= 2
            && words.length <= 5
            && !sectionNames.has(normalized)
            && !/[0-9@/:]/.test(line)
            && /^[a-zA-Z .'-]+$/.test(line)
    }) || "Candidate Name"
}

function splitResumeSections(lines, candidateName, contactItems) {
    const sectionAliases = new Map([
        [ "summary", "Professional Summary" ],
        [ "profile", "Professional Summary" ],
        [ "education", "Education" ],
        [ "experience", "Experience" ],
        [ "work experience", "Experience" ],
        [ "professional experience", "Experience" ],
        [ "employment", "Experience" ],
        [ "projects", "Projects" ],
        [ "project", "Projects" ],
        [ "skills", "Technical Skills" ],
        [ "technical skills", "Technical Skills" ],
        [ "core skills", "Technical Skills" ],
        [ "coursework", "Relevant Coursework" ],
        [ "relevant coursework", "Relevant Coursework" ],
        [ "certifications", "Certifications" ],
        [ "certification", "Certifications" ],
        [ "achievements", "Achievements" ],
        [ "awards", "Achievements" ]
    ])

    const contactSet = new Set(contactItems)
    const sections = []
    let current = null
    const intro = []

    for (const line of lines) {
        if (line === candidateName || [ ...contactSet ].some(contact => line.includes(contact))) {
            continue
        }

        const heading = sectionAliases.get(line.toLowerCase().replace(/:$/, ""))
        if (heading) {
            current = { title: heading, items: [] }
            sections.push(current)
            continue
        }

        if (current) {
            current.items.push(line)
        } else {
            intro.push(line)
        }
    }

    if (intro.length) {
        sections.unshift({ title: "Profile Highlights", items: intro })
    }

    return sections
        .map(section => ({
            title: section.title,
            items: section.items
                .map(item => item.replace(/^[•\-\u2022]\s*/, "").trim())
                .filter(Boolean)
        }))
        .filter(section => section.items.length)
}

function getJobKeywords(jobDescription = "") {
    const displayNames = {
        "mongodb": "MongoDB",
        "mysql": "MySQL",
        "postgresql": "PostgreSQL",
        "javascript": "JavaScript",
        "typescript": "TypeScript",
        "node": "Node.js",
        "express": "Express.js",
        "rest api": "REST API",
        "graphql": "GraphQL",
        "jwt": "JWT",
        "html": "HTML",
        "css": "CSS",
        "ci/cd": "CI/CD"
    }
    const knownSkills = [
        "javascript", "typescript", "react", "node", "express", "mongodb", "sql", "mysql",
        "postgresql", "python", "java", "aws", "docker", "kubernetes", "rest api", "graphql",
        "jwt", "html", "css", "tailwind", "redux", "testing", "git", "ci/cd"
    ]
    const lowerJobDescription = jobDescription.toLowerCase()

    return knownSkills
        .filter(skill => lowerJobDescription.includes(skill))
        .map(skill => displayNames[skill] || skill.replace(/\b\w/g, char => char.toUpperCase()))
        .slice(0, 12)
}

function sectionItemsHtml(section) {
    const hasDenseSkillList = section.items.length <= 4 && section.items.some(item => item.split(/[,\u2022|]/).length > 3)
    const className = hasDenseSkillList || /skills|coursework/i.test(section.title) ? "skills-list" : "bullet-list"

    return `<ul class="${className}">
      ${section.items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>`
}

function fallbackResumeHtml({ resume, selfDescription, jobDescription }) {
    const lines = normalizeResumeLines(resume)
    const candidateName = inferCandidateName(lines)
    const contactItems = extractContact(lines)
    const sections = splitResumeSections(lines, candidateName, contactItems)
    const keywords = getJobKeywords(jobDescription)
    const summary = selfDescription?.trim()
        || "Motivated software professional with hands-on project experience, strong fundamentals, and a focus on building reliable user-facing applications."
    const renderedSections = sections.length
        ? sections.map(section => `
          <section>
            <h2>${escapeHtml(section.title)}</h2>
            ${sectionItemsHtml(section)}
          </section>`).join("")
        : `
          <section>
            <h2>Profile Highlights</h2>
            <ul class="bullet-list">
              <li>Built and maintained practical software projects with attention to usability, reliability, and clean implementation.</li>
              <li>Applied computer science fundamentals, debugging, and problem-solving to deliver working solutions.</li>
              <li>Collaborated through version control, documentation, and iterative improvement.</li>
            </ul>
          </section>`

    return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #111827;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10.7px;
      line-height: 1.38;
      background: #ffffff;
    }
    header {
      text-align: center;
      border-bottom: 1.5px solid #111827;
      padding-bottom: 9px;
      margin-bottom: 12px;
    }
    h1 {
      margin: 0 0 4px;
      font-size: 24px;
      line-height: 1.1;
      letter-spacing: 0;
      text-transform: uppercase;
    }
    .contact {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 4px 10px;
      color: #374151;
      font-size: 10px;
    }
    .summary {
      margin: 0 0 10px;
      text-align: left;
    }
    section { margin-top: 10px; break-inside: avoid; }
    h2 {
      margin: 0 0 5px;
      padding-bottom: 2px;
      border-bottom: 1px solid #9ca3af;
      color: #111827;
      font-size: 12px;
      line-height: 1.2;
      text-transform: uppercase;
      letter-spacing: 0;
    }
    ul { margin: 0; padding-left: 15px; }
    li { margin: 0 0 3px; }
    .skills-list {
      columns: 2;
      column-gap: 22px;
      list-style-position: outside;
    }
    .keywords {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .keywords li {
      margin: 0;
      color: #1f2937;
    }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(candidateName)}</h1>
    ${contactItems.length ? `<div class="contact">${contactItems.map(item => `<span>${escapeHtml(item)}</span>`).join("")}</div>` : ""}
  </header>
  <section>
    <h2>Professional Summary</h2>
    <p class="summary">${escapeHtml(summary)}</p>
  </section>
  ${keywords.length ? `
  <section>
    <h2>Target Keywords</h2>
    <ul class="keywords">${keywords.map(keyword => `<li>${escapeHtml(keyword)}</li>`).join("")}</ul>
  </section>` : ""}
  ${renderedSections}
</body>
</html>`
}

async function generateResumePdf({ resume, selfDescription, jobDescription }) {
    const ai = getAiClient()

    if (!ai) {
        return generatePdfFromHtml(fallbackResumeHtml({ resume, selfDescription, jobDescription }))
    }

    const prompt = `
Create an ATS-friendly resume tailored to the job description below.
Return only JSON with one field: html.
The HTML must be a complete professional one-page resume document suitable for A4 PDF rendering.
Requirements:
- Preserve the candidate name, contact details, education, projects, experience, skills, and achievements from the source resume.
- Do not invent employers, dates, degrees, links, phone numbers, or certifications.
- Improve wording and ordering for relevance to the job description.
- Use semantic HTML, simple CSS, dark text on white background, compact spacing, and ATS-friendly headings.
- Do not include placeholder labels such as "ATS Optimized Resume" or generic filler content.

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

module.exports = { generateInterviewReport, generateResumePdf, generateAnswerFeedback }
