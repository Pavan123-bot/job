// ============================================================
// AutoApply AI — AI Matching Engine & Career Insights
// src/services/AIMatchingEngine.ts
// ============================================================

import { supabase } from '../lib/supabase';
import {
  Job, Profile, Resume, JobMatch, JobMatchInsert,
  CareerInsights, SkillGap, RecommendedCert, LearningPathStep,
  ServiceResult
} from '../types/database';
import { JobService } from './JobService';
import { ActivityService } from './NotificationService';

// ── Claude API call ───────────────────────────────────────────
async function claudeCall(system: string, user: string, maxTokens = 1200): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
  const d = await res.json();
  return d.content?.[0]?.text || '';
}

function parseJSON<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim()) as T;
  } catch {
    return fallback;
  }
}

// ── Match score interface returned by AI ──────────────────────
interface AIMatchResult {
  overall_score: number;
  skill_score: number;
  experience_score: number;
  education_score: number;
  ats_score: number;
  matched_skills: string[];
  missing_skills: string[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  verdict: string;
  ai_summary: string;
  should_apply: boolean;
}

export class AIMatchingEngine {
  // ── Score a single job against a profile ───────────────────
  static async scoreJob(
    profile: Profile,
    resume: Resume | null,
    job: Job,
  ): Promise<ServiceResult<AIMatchResult>> {
    try {
      const resumeText = resume?.raw_text || '';
      const skills = profile.skills.join(', ');
      const experience = (resume?.parsed_data?.experience || [])
        .map(e => `${e.title} at ${e.company} (${e.duration})`)
        .join('; ');
      const education = (resume?.parsed_data?.education || [])
        .map(e => `${e.degree} from ${e.school}`)
        .join('; ');

      const raw = await claudeCall(
        'You are an expert job matching AI. Analyze candidate-job fit and return ONLY valid JSON, no markdown.',
        `Analyze this candidate-job match and return detailed scores.

CANDIDATE:
Name: ${profile.name}
Skills: ${skills}
Experience Level: ${profile.experience_level}
Experience: ${experience || 'Not provided'}
Education: ${education || 'Not provided'}
Summary: ${profile.summary || ''}
Resume excerpt: ${resumeText.slice(0, 800)}

JOB:
Title: ${job.title}
Company: ${job.company}
Required Skills: ${job.skills_required.join(', ')}
Experience Level: ${job.experience_level}
Description: ${job.description.slice(0, 1000)}
Requirements: ${job.requirements.slice(0, 500)}

Return JSON exactly:
{
  "overall_score": 0-100,
  "skill_score": 0-100,
  "experience_score": 0-100,
  "education_score": 0-100,
  "ats_score": 0-100,
  "matched_skills": ["skill1","skill2"],
  "missing_skills": ["skill1","skill2"],
  "strengths": ["strength1","strength2","strength3"],
  "weaknesses": ["weakness1","weakness2"],
  "recommendations": ["action1","action2","action3"],
  "verdict": "Strong Match|Good Match|Partial Match|Weak Match",
  "ai_summary": "2-sentence summary of fit",
  "should_apply": true|false
}`,
        900
      );

      const result = parseJSON<AIMatchResult>(raw, {
        overall_score: 0, skill_score: 0, experience_score: 0,
        education_score: 0, ats_score: 0,
        matched_skills: [], missing_skills: [],
        strengths: [], weaknesses: [], recommendations: [],
        verdict: 'Unknown', ai_summary: '', should_apply: false,
      });

      return { data: result, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Score job and save to DB ────────────────────────────────
  static async scoreAndSave(
    userId: string,
    profile: Profile,
    resume: Resume | null,
    job: Job,
  ): Promise<ServiceResult<JobMatch>> {
    const scoreResult = await AIMatchingEngine.scoreJob(profile, resume, job);
    if (!scoreResult.data) return { data: null, error: scoreResult.error };

    const matchData: JobMatchInsert = {
      user_id: userId,
      job_id: job.id,
      resume_id: resume?.id || null,
      ...scoreResult.data,
      computed_at: new Date().toISOString(),
    };

    const saveResult = await JobService.upsertMatch(matchData);
    await ActivityService.log(userId, 'ai_call', `Scored job: ${job.title} at ${job.company}`, {
      job_id: job.id, score: scoreResult.data.overall_score,
    });

    return saveResult;
  }

  // ── Batch score all unmatched jobs ──────────────────────────
  static async batchScoreUnmatched(
    userId: string,
    profile: Profile,
    resume: Resume | null,
    onProgress?: (current: number, total: number) => void,
  ): Promise<ServiceResult<{ scored: number; errors: number }>> {
    try {
      const { data: jobs, error } = await JobService.getUnmatchedJobs(userId);
      if (error) return { data: null, error };
      if (!jobs || jobs.length === 0) return { data: { scored: 0, errors: 0 }, error: null };

      let scored = 0;
      let errors = 0;

      for (let i = 0; i < jobs.length; i++) {
        try {
          await AIMatchingEngine.scoreAndSave(userId, profile, resume, jobs[i]);
          scored++;
        } catch {
          errors++;
        }
        onProgress?.(i + 1, jobs.length);
        // Rate limit: 1 call per second
        await new Promise(r => setTimeout(r, 1000));
      }

      return { data: { scored, errors }, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Generate career insights ────────────────────────────────
  static async generateCareerInsights(
    userId: string,
    profile: Profile,
    jobs: Job[],
    applications: any[],
  ): Promise<ServiceResult<CareerInsights>> {
    try {
      const topJobSkills = jobs
        .flatMap(j => j.skills_required)
        .reduce((acc: Record<string, number>, s) => {
          acc[s] = (acc[s] || 0) + 1;
          return acc;
        }, {});

      const topRequired = Object.entries(topJobSkills)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([skill, count]) => `${skill} (${count} jobs)`);

      const raw = await claudeCall(
        'You are a career coach AI. Return ONLY valid JSON, no markdown.',
        `Generate career insights for this job seeker.

PROFILE:
Skills: ${profile.skills.join(', ')}
Target Roles: ${profile.target_roles.join(', ')}
Experience Level: ${profile.experience_level}
Years: ${profile.years_experience}

MARKET DATA:
Top skills in demand: ${topRequired.join(', ')}
Total jobs found: ${jobs.length}
Applications submitted: ${applications.length}
Interview rate: ${applications.length > 0 ? Math.round((applications.filter((a: any) => a.status === 'interview').length / applications.length) * 100) : 0}%

Return JSON exactly:
{
  "skill_gaps": [
    {"skill":"","importance":"critical|high|medium|low","reason":"","jobs_requiring":0}
  ],
  "recommended_certs": [
    {"name":"","provider":"Coursera|Udemy|Google|AWS|Microsoft|LinkedIn","url":"","relevance":"","estimated_time":""}
  ],
  "learning_path": [
    {"order":1,"title":"","description":"","resources":[""],"estimated_weeks":0}
  ],
  "career_suggestions": ["suggestion1","suggestion2","suggestion3","suggestion4","suggestion5"],
  "market_insights": {
    "hot_skills": ["skill1","skill2"],
    "salary_trend": "increasing|stable|decreasing",
    "competition_level": "high|medium|low",
    "top_hiring_companies": ["company1","company2"]
  },
  "salary_insights": {
    "estimated_min": 0,
    "estimated_max": 0,
    "currency": "USD",
    "negotiation_tips": ["tip1","tip2"]
  }
}`,
        1400
      );

      const insights = parseJSON(raw, {
        skill_gaps: [],
        recommended_certs: [],
        learning_path: [],
        career_suggestions: [],
        market_insights: {},
        salary_insights: {},
      });

      // Upsert to DB
      const { data: saved, error: saveErr } = await supabase
        .from('career_insights')
        .upsert({
          user_id: userId,
          ...insights,
          generated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (saveErr) return { data: null, error: saveErr.message };

      await ActivityService.log(userId, 'ai_call', 'Generated career insights');
      return { data: saved, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Get saved career insights ───────────────────────────────
  static async getCareerInsights(userId: string): Promise<ServiceResult<CareerInsights>> {
    try {
      const { data, error } = await supabase
        .from('career_insights')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return { data: null, error: null };
        return { data: null, error: error.message };
      }
      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Generate optimized resume for a specific job ────────────
  static async optimizeResumeForJob(
    profile: Profile,
    resume: Resume | null,
    job: Job,
  ): Promise<ServiceResult<{
    ats_score: number;
    matched_keywords: string[];
    missing_keywords: string[];
    optimized_summary: string;
    bullet_improvements: { original: string; improved: string }[];
    skills_to_add: string[];
    overall_advice: string;
  }>> {
    try {
      const resumeText = resume?.raw_text || profile.summary || '';

      const raw = await claudeCall(
        'You are an expert ATS resume optimizer. Return ONLY valid JSON, no markdown.',
        `Optimize this resume for the target job.

JOB: ${job.title} at ${job.company}
REQUIRED SKILLS: ${job.skills_required.join(', ')}
JOB DESCRIPTION: ${job.description.slice(0, 1500)}

CURRENT RESUME:
${resumeText.slice(0, 1500)}
CANDIDATE SKILLS: ${profile.skills.join(', ')}

Return JSON:
{
  "ats_score": 0-100,
  "matched_keywords": [],
  "missing_keywords": [],
  "optimized_summary": "",
  "bullet_improvements": [{"original":"","improved":""}],
  "skills_to_add": [],
  "overall_advice": ""
}`,
        1000
      );

      const result = parseJSON(raw, {
        ats_score: 0, matched_keywords: [], missing_keywords: [],
        optimized_summary: '', bullet_improvements: [], skills_to_add: [], overall_advice: '',
      });

      await ActivityService.log(
        profile.user_id, 'ai_call',
        `Resume optimized for: ${job.title} at ${job.company}`,
        { job_id: job.id }
      );

      return { data: result, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Generate cover letter ───────────────────────────────────
  static async generateCoverLetter(
    profile: Profile,
    job: Job,
  ): Promise<ServiceResult<string>> {
    try {
      const experience = (profile as any).experience?.map((e: any) => `${e.title} at ${e.company}`).join('; ') || '';

      const letter = await claudeCall(
        'You are an expert cover letter writer. Write compelling, concise letters.',
        `Write a professional cover letter.
CANDIDATE: ${profile.name}
SKILLS: ${profile.skills.join(', ')}
EXPERIENCE: ${experience}
SUMMARY: ${profile.summary}
JOB: ${job.title} at ${job.company}
DESCRIPTION: ${job.description.slice(0, 1200)}

Rules: 3 paragraphs max, under 270 words, strong opening hook (not "I am applying for..."), specific skill connections, clear CTA.
Return ONLY the letter text.`,
        800
      );

      await ActivityService.log(
        profile.user_id, 'ai_call',
        `Cover letter generated for: ${job.title} at ${job.company}`,
        { job_id: job.id }
      );

      return { data: letter, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Answer screening question ───────────────────────────────
  static async answerScreeningQuestion(
    profile: Profile,
    question: string,
    jobTitle: string,
  ): Promise<ServiceResult<string>> {
    try {
      const answer = await claudeCall(
        'Answer job application screening questions professionally.',
        `Answer this screening question.
Question: ${question}
Job: ${jobTitle}
Candidate: ${profile.name}, skills: ${profile.skills.slice(0, 6).join(', ')}
Write 2-3 sentence professional answer. Return only the answer text.`,
        350
      );

      await ActivityService.log(profile.user_id, 'ai_call', 'Answered screening question');
      return { data: answer, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Parse resume text with AI ───────────────────────────────
  static async parseResume(
    userId: string,
    rawText: string,
  ): Promise<ServiceResult<any>> {
    try {
      const raw = await claudeCall(
        'You are a resume parser. Return ONLY valid JSON, no markdown.',
        `Parse this resume:
${rawText.slice(0, 3000)}

Return JSON: {"name":"","email":"","phone":"","location":"","linkedin":"","github":"","portfolio":"","summary":"","skills":[],"experience":[{"title":"","company":"","duration":"","bullets":[]}],"education":[{"degree":"","school":"","year":""}],"certifications":[]}`,
        1000
      );

      const parsed = parseJSON(raw, {});
      await ActivityService.log(userId, 'ai_call', 'Resume parsed with AI');
      return { data: parsed, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }
}
