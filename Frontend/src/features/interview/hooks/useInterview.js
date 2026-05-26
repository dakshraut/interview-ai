import { getAllInterviewReports, generateInterviewReport, getInterviewReportById, generateResumePdf, generateAnswerFeedback } from "../services/interview.api"
import { useContext, useEffect, useState } from "react"
import { InterviewContext } from "../interview.context-value"
import { useParams } from "react-router"


export const useInterview = () => {

    const context = useContext(InterviewContext)
    const { interviewId } = useParams()

    if (!context) {
        throw new Error("useInterview must be used within an InterviewProvider")
    }

    const { loading, setLoading, report, setReport, reports, setReports } = context
    const [ error, setError ] = useState("")

    const generateReport = async ({ jobDescription, selfDescription, resumeFile }) => {
        setLoading(true)
        setError("")
        let response = null
        try {
            response = await generateInterviewReport({ jobDescription, selfDescription, resumeFile })
            setReport(response.interviewReport)
        } catch (error) {
            setError(error.response?.data?.message || error.message || "Unable to generate interview report.")
        } finally {
            setLoading(false)
        }

        return response?.interviewReport || null
    }

    const getReportById = async (interviewId) => {
        setLoading(true)
        setError("")
        let response = null
        try {
            response = await getInterviewReportById(interviewId)
            setReport(response.interviewReport)
        } catch (error) {
            setError(error.response?.data?.message || error.message || "Unable to load interview report.")
        } finally {
            setLoading(false)
        }
        return response?.interviewReport || null
    }

    const getReports = async () => {
        setLoading(true)
        setError("")
        let response = null
        try {
            response = await getAllInterviewReports()
            setReports(response.interviewReports)
        } catch (error) {
            setError(error.response?.data?.message || error.message || "Unable to load reports.")
        } finally {
            setLoading(false)
        }

        return response?.interviewReports || []
    }

    const getResumePdf = async (interviewReportId) => {
        setLoading(true)
        setError("")
        try {
            const response = await generateResumePdf({ interviewReportId })
            const url = window.URL.createObjectURL(new Blob([ response ], { type: "application/pdf" }))
            const link = document.createElement("a")
            link.href = url
            link.setAttribute("download", `resume_${interviewReportId}.pdf`)
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)
        }
        catch (error) {
            setError(error.response?.data?.message || error.message || "Unable to generate resume PDF.")
        } finally {
            setLoading(false)
        }
    }

    const getAnswerFeedback = async ({ interviewReportId, question, answer, intention, idealAnswer, questionType }) => {
        setError("")
        const response = await generateAnswerFeedback({ interviewReportId, question, answer, intention, idealAnswer, questionType })
        return response.feedback
    }

    useEffect(() => {
        if (interviewId) {
            getReportById(interviewId)
        } else {
            getReports()
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ interviewId ])

    return { loading, error, report, reports, generateReport, getReportById, getReports, getResumePdf, getAnswerFeedback }

}
