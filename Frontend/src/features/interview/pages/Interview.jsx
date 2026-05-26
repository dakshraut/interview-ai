import React, { useState } from 'react'
import '../style/interview.scss'
import { useInterview } from '../hooks/useInterview.js'
import { useParams } from 'react-router'



const NAV_ITEMS = [
    { id: 'technical', label: 'Technical Questions', icon: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>) },
    { id: 'behavioral', label: 'Behavioral Questions', icon: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>) },
    { id: 'roadmap', label: 'Roadmap', icon: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>) },
    { id: 'projects', label: 'Project Stories', icon: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h18" /><path d="M3 12h18" /><path d="M3 17h18" /><path d="M7 3v18" /></svg>) },
    { id: 'practice', label: 'Answer Practice', icon: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>) },
    { id: 'mock', label: 'Mock Interview', icon: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" /></svg>) },
]

const normalizePreparationPlan = (plan = []) => plan
    .filter(day => day && day.focus && Array.isArray(day.tasks))
    .sort((a, b) => (Number(a.day) || 0) - (Number(b.day) || 0))
    .map((day, index) => ({
        ...day,
        day: index + 1,
        tasks: day.tasks.filter(Boolean).slice(0, 3)
    }))

const buildProjectStories = (report) => {
    if (report.projectStories?.length) {
        return report.projectStories
    }

    return [
        {
            projectName: 'Primary Resume Project',
            positioning: 'Use this story to prove ownership, technical judgment, and fit for the target role.',
            pitch: 'Explain the problem, your responsibility, the users affected, and the final result in a concise project narrative.',
            technicalDeepDive: 'Walk through the user flow, API/data flow, validation, persistence, edge cases, and one tradeoff you made.',
            architecture: [ 'Client/UI layer for user actions and states.', 'API/service layer for validation and business logic.', 'Data layer for storage and retrieval.' ],
            challenges: [ 'Name the hardest bug or decision.', 'Explain how you verified the fix.', 'Connect the result to impact.' ],
            followUps: [ 'What would you improve now?', 'How would this scale?', 'What tradeoff did you make?' ]
        }
    ]
}

const getQuestionSet = (report) => [
    ...(report.technicalQuestions || []).map((question, index) => ({ ...question, questionType: 'technical', label: `Technical Q${index + 1}` })),
    ...(report.behavioralQuestions || []).map((question, index) => ({ ...question, questionType: 'behavioral', label: `Behavioral Q${index + 1}` }))
]

// ── Sub-components ────────────────────────────────────────────────────────────
const QuestionCard = ({ item, index }) => {
    const [ open, setOpen ] = useState(false)
    return (
        <div className='q-card'>
            <div className='q-card__header' onClick={() => setOpen(o => !o)}>
                <span className='q-card__index'>Q{index + 1}</span>
                <p className='q-card__question'>{item.question}</p>
                <span className={`q-card__chevron ${open ? 'q-card__chevron--open' : ''}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </span>
            </div>
            {open && (
                <div className='q-card__body'>
                    <div className='q-card__section'>
                        <span className='q-card__tag q-card__tag--intention'>Intention</span>
                        <p>{item.intention}</p>
                    </div>
                    <div className='q-card__section'>
                        <span className='q-card__tag q-card__tag--answer'>Answer Strategy</span>
                        <p>{item.answer}</p>
                    </div>
                </div>
            )}
        </div>
    )
}

const RoadMapDay = ({ day }) => (
    <div className='roadmap-day'>
        <div className='roadmap-day__header'>
            <span className='roadmap-day__badge'>Day {day.day}</span>
            <h3 className='roadmap-day__focus'>{day.focus}</h3>
        </div>
        <ul className='roadmap-day__tasks'>
            {day.tasks.map((task, i) => (
                <li key={i}>
                    <span className='roadmap-day__bullet' />
                    {task}
                </li>
            ))}
        </ul>
    </div>
)

const FeedbackPanel = ({ feedback }) => {
    if (!feedback) return null

    return (
        <div className='feedback-panel'>
            <div className='feedback-panel__score'>
                <span>{feedback.score}</span>
                <small>/100</small>
            </div>
            <div className='feedback-panel__content'>
                <p className='feedback-panel__verdict'>{feedback.verdict}</p>
                <div className='feedback-grid'>
                    <div>
                        <h4>Strengths</h4>
                        <ul>{feedback.strengths.map((item, i) => <li key={i}>{item}</li>)}</ul>
                    </div>
                    <div>
                        <h4>Improve</h4>
                        <ul>{feedback.improvements.map((item, i) => <li key={i}>{item}</li>)}</ul>
                    </div>
                </div>
                <div className='feedback-panel__answer'>
                    <h4>Stronger Version</h4>
                    <p>{feedback.improvedAnswer}</p>
                </div>
                <div className='feedback-panel__answer'>
                    <h4>Follow-Ups</h4>
                    <ul>{feedback.followUpQuestions.map((item, i) => <li key={i}>{item}</li>)}</ul>
                </div>
            </div>
        </div>
    )
}

const PracticeQuestion = ({ question, answer, feedback, busy, onAnswerChange, onSubmit }) => (
    <div className='practice-card'>
        <div className='practice-card__top'>
            <span>{question.label}</span>
            <p>{question.question}</p>
        </div>
        <textarea
            value={answer}
            onChange={(event) => onAnswerChange(event.target.value)}
            placeholder='Draft your answer here...'
            rows={5}
        />
        <div className='practice-card__actions'>
            <button className='button primary-button' disabled={busy || !answer.trim()} onClick={onSubmit}>
                {busy ? 'Reviewing...' : 'Get Feedback'}
            </button>
        </div>
        <FeedbackPanel feedback={feedback} />
    </div>
)

const ProjectStories = ({ stories }) => (
    <div className='story-list'>
        {stories.map((story, index) => (
            <article className='story-card' key={`${story.projectName}-${index}`}>
                <div className='story-card__header'>
                    <span>Story {index + 1}</span>
                    <h3>{story.projectName}</h3>
                    <p>{story.positioning}</p>
                </div>
                <div className='story-card__body'>
                    <section>
                        <h4>Pitch</h4>
                        <p>{story.pitch}</p>
                    </section>
                    <section>
                        <h4>Deep Dive</h4>
                        <p>{story.technicalDeepDive}</p>
                    </section>
                    <section>
                        <h4>Architecture</h4>
                        <ul>{story.architecture.map((item, i) => <li key={i}>{item}</li>)}</ul>
                    </section>
                    <section>
                        <h4>Challenges</h4>
                        <ul>{story.challenges.map((item, i) => <li key={i}>{item}</li>)}</ul>
                    </section>
                    <section>
                        <h4>Follow-Ups</h4>
                        <ul>{story.followUps.map((item, i) => <li key={i}>{item}</li>)}</ul>
                    </section>
                </div>
            </article>
        ))}
    </div>
)

const MockInterview = ({ questions, currentIndex, answer, feedback, busy, onAnswerChange, onSubmit, onNext, onPrevious }) => {
    const question = questions[currentIndex]

    if (!question) return null

    return (
        <div className='mock-shell'>
            <div className='mock-shell__status'>
                <span>Question {currentIndex + 1} of {questions.length}</span>
                <div className='mock-shell__progress'><span style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} /></div>
            </div>
            <PracticeQuestion
                question={question}
                answer={answer}
                feedback={feedback}
                busy={busy}
                onAnswerChange={onAnswerChange}
                onSubmit={onSubmit}
            />
            <div className='mock-shell__nav'>
                <button className='button' disabled={currentIndex === 0} onClick={onPrevious}>Previous</button>
                <button className='button primary-button' disabled={currentIndex === questions.length - 1} onClick={onNext}>Next Question</button>
            </div>
        </div>
    )
}

// ── Main Component ────────────────────────────────────────────────────────────
const getMatchSummary = (score) => {
    if (score >= 90) return 'Excellent match for this role'
    if (score >= 75) return 'Strong match for this role'
    if (score >= 55) return 'Partial match with clear gaps'
    if (score >= 35) return 'Needs focused preparation'
    return 'Low match for this role'
}

const Interview = () => {
    const [ activeNav, setActiveNav ] = useState('technical')
    const [ practiceAnswers, setPracticeAnswers ] = useState({})
    const [ practiceFeedback, setPracticeFeedback ] = useState({})
    const [ mockIndex, setMockIndex ] = useState(0)
    const [ mockAnswers, setMockAnswers ] = useState({})
    const [ mockFeedback, setMockFeedback ] = useState({})
    const [ feedbackLoadingKey, setFeedbackLoadingKey ] = useState('')
    const { report, loading, error, getResumePdf, getAnswerFeedback } = useInterview()
    const { interviewId } = useParams()



    if (loading) {
        return (
            <main className='loading-screen'>
                <h1>Loading your interview plan...</h1>
            </main>
        )
    }

    if (!report) {
        return (
            <main className='loading-screen'>
                <h1>{error || "Interview report not found."}</h1>
            </main>
        )
    }

    const scoreColor =
        report.matchScore >= 80 ? 'score--high' :
            report.matchScore >= 60 ? 'score--mid' : 'score--low'
    const preparationPlan = normalizePreparationPlan(report.preparationPlan)
    const questionSet = getQuestionSet(report)
    const projectStories = buildProjectStories(report)

    const submitFeedback = async ({ question, answer, key, target }) => {
        setFeedbackLoadingKey(key)

        try {
            const feedback = await getAnswerFeedback({
                interviewReportId: interviewId,
                question: question.question,
                answer,
                intention: question.intention,
                idealAnswer: question.answer,
                questionType: question.questionType
            })

            if (target === 'mock') {
                setMockFeedback(current => ({ ...current, [key]: feedback }))
            } else {
                setPracticeFeedback(current => ({ ...current, [key]: feedback }))
            }
        } finally {
            setFeedbackLoadingKey('')
        }
    }


    return (
        <div className='interview-page'>
            <div className='interview-layout'>

                {/* ── Left Nav ── */}
                <nav className='interview-nav'>
                    <div className="nav-content">
                        <p className='interview-nav__label'>Sections</p>
                        {NAV_ITEMS.map(item => (
                            <button
                                key={item.id}
                                className={`interview-nav__item ${activeNav === item.id ? 'interview-nav__item--active' : ''}`}
                                onClick={() => setActiveNav(item.id)}
                            >
                                <span className='interview-nav__icon'>{item.icon}</span>
                                {item.label}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => { getResumePdf(interviewId) }}
                        className='button primary-button' >
                        <svg height={"0.8rem"} style={{ marginRight: "0.8rem" }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M10.6144 17.7956 11.492 15.7854C12.2731 13.9966 13.6789 12.5726 15.4325 11.7942L17.8482 10.7219C18.6162 10.381 18.6162 9.26368 17.8482 8.92277L15.5079 7.88394C13.7092 7.08552 12.2782 5.60881 11.5105 3.75894L10.6215 1.61673C10.2916.821765 9.19319.821767 8.8633 1.61673L7.97427 3.75892C7.20657 5.60881 5.77553 7.08552 3.97685 7.88394L1.63658 8.92277C.868537 9.26368.868536 10.381 1.63658 10.7219L4.0523 11.7942C5.80589 12.5726 7.21171 13.9966 7.99275 15.7854L8.8704 17.7956C9.20776 18.5682 10.277 18.5682 10.6144 17.7956ZM19.4014 22.6899 19.6482 22.1242C20.0882 21.1156 20.8807 20.3125 21.8695 19.8732L22.6299 19.5353C23.0412 19.3526 23.0412 18.7549 22.6299 18.5722L21.9121 18.2532C20.8978 17.8026 20.0911 16.9698 19.6586 15.9269L19.4052 15.3156C19.2285 14.8896 18.6395 14.8896 18.4628 15.3156L18.2094 15.9269C17.777 16.9698 16.9703 17.8026 15.956 18.2532L15.2381 18.5722C14.8269 18.7549 14.8269 19.3526 15.2381 19.5353L15.9985 19.8732C16.9874 20.3125 17.7798 21.1156 18.2198 22.1242L18.4667 22.6899C18.6473 23.104 19.2207 23.104 19.4014 22.6899Z"></path></svg>
                        Download Resume
                    </button>
                </nav>

                <div className='interview-divider' />

                {/* ── Center Content ── */}
                <main className='interview-content'>
                    {activeNav === 'technical' && (
                        <section>
                            <div className='content-header'>
                                <h2>Technical Questions</h2>
                                <span className='content-header__count'>{report.technicalQuestions.length} questions</span>
                            </div>
                            <div className='q-list'>
                                {report.technicalQuestions.map((q, i) => (
                                    <QuestionCard key={i} item={q} index={i} />
                                ))}
                            </div>
                        </section>
                    )}

                    {activeNav === 'behavioral' && (
                        <section>
                            <div className='content-header'>
                                <h2>Behavioral Questions</h2>
                                <span className='content-header__count'>{report.behavioralQuestions.length} questions</span>
                            </div>
                            <div className='q-list'>
                                {report.behavioralQuestions.map((q, i) => (
                                    <QuestionCard key={i} item={q} index={i} />
                                ))}
                            </div>
                        </section>
                    )}

                    {activeNav === 'roadmap' && (
                        <section>
                            <div className='content-header'>
                                <h2>Preparation Roadmap</h2>
                                <span className='content-header__count'>{preparationPlan.length}-day plan</span>
                            </div>
                            <div className='roadmap-list'>
                                {preparationPlan.map((day) => (
                                    <RoadMapDay key={day.day} day={day} />
                                ))}
                            </div>
                        </section>
                    )}

                    {activeNav === 'projects' && (
                        <section>
                            <div className='content-header'>
                                <h2>Project Stories</h2>
                                <span className='content-header__count'>{projectStories.length} stories</span>
                            </div>
                            <ProjectStories stories={projectStories} />
                        </section>
                    )}

                    {activeNav === 'practice' && (
                        <section>
                            <div className='content-header'>
                                <h2>Answer Practice</h2>
                                <span className='content-header__count'>{questionSet.length} prompts</span>
                            </div>
                            <div className='practice-list'>
                                {questionSet.map((question, index) => {
                                    const key = `practice-${index}`
                                    return (
                                        <PracticeQuestion
                                            key={key}
                                            question={question}
                                            answer={practiceAnswers[key] || ''}
                                            feedback={practiceFeedback[key]}
                                            busy={feedbackLoadingKey === key}
                                            onAnswerChange={(value) => setPracticeAnswers(current => ({ ...current, [key]: value }))}
                                            onSubmit={() => submitFeedback({
                                                question,
                                                answer: practiceAnswers[key] || '',
                                                key,
                                                target: 'practice'
                                            })}
                                        />
                                    )
                                })}
                            </div>
                        </section>
                    )}

                    {activeNav === 'mock' && (
                        <section>
                            <div className='content-header'>
                                <h2>Mock Interview</h2>
                                <span className='content-header__count'>{questionSet.length} rounds</span>
                            </div>
                            <MockInterview
                                questions={questionSet}
                                currentIndex={mockIndex}
                                answer={mockAnswers[`mock-${mockIndex}`] || ''}
                                feedback={mockFeedback[`mock-${mockIndex}`]}
                                busy={feedbackLoadingKey === `mock-${mockIndex}`}
                                onAnswerChange={(value) => setMockAnswers(current => ({ ...current, [`mock-${mockIndex}`]: value }))}
                                onSubmit={() => submitFeedback({
                                    question: questionSet[mockIndex],
                                    answer: mockAnswers[`mock-${mockIndex}`] || '',
                                    key: `mock-${mockIndex}`,
                                    target: 'mock'
                                })}
                                onNext={() => setMockIndex(index => Math.min(questionSet.length - 1, index + 1))}
                                onPrevious={() => setMockIndex(index => Math.max(0, index - 1))}
                            />
                        </section>
                    )}
                </main>

                <div className='interview-divider' />

                {/* ── Right Sidebar ── */}
                <aside className='interview-sidebar'>

                    {/* Match Score */}
                    <div className='match-score'>
                        <p className='match-score__label'>Match Score</p>
                        <div className={`match-score__ring ${scoreColor}`}>
                            <span className='match-score__value'>{report.matchScore}</span>
                            <span className='match-score__pct'>%</span>
                        </div>
                        <p className='match-score__sub'>{getMatchSummary(report.matchScore)}</p>
                    </div>

                    <div className='sidebar-divider' />

                    {/* Skill Gaps */}
                    <div className='skill-gaps'>
                        <p className='skill-gaps__label'>Skill Gaps</p>
                        <div className='skill-gaps__list'>
                            {report.skillGaps.map((gap, i) => (
                                <span key={i} className={`skill-tag skill-tag--${gap.severity}`}>
                                    {gap.skill}
                                </span>
                            ))}
                        </div>
                    </div>

                </aside>
            </div>
        </div>
    )
}

export default Interview
