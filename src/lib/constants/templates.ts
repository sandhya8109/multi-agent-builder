export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  nodes: any[];
  edges: any[];
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'job-application-autopilot',
    name: 'Job Application Autopilot (with RAG)',
    description: 'Parse job postings, score resume fit against a strict rubric, identify gaps, retrieve STAR examples, and generate tailored rewrites + cover letter.',
    category: 'Career & HR',
    nodes: [
      {
        id: 'api_fetcher_1',
        type: 'apiNode',
        position: { x: 50, y: 50 },
        data: {
          label: 'API Fetcher',
          method: 'GET',
          // Left blank intentionally — point this at a real job-posting
          // API/URL before running. A fake example.com placeholder here
          // would just fail the fetch at run time.
          url: '',
        },
      },
      {
        id: 'user_input_resume',
        type: 'inputNode',
        position: { x: 50, y: 320 },
        data: {
          label: 'Candidate Resume Text',
          value: 'Paste candidate resume text or upload resume file here...',
        },
      },
      {
        id: 'agent_extractor',
        type: 'agentNode',
        position: { x: 450, y: 180 },
        data: {
          label: 'Extractor Agent',
          model: 'openai/gpt-oss-120b',
          temperature: 0.2,
          instructions: 'Parse incoming job posting content and candidate resume text into a structured JSON payload with keys: "jd_requirements" (hard_skills, soft_skills, experience_years) and "resume_data" (skills, experience, education).',
        },
      },
      {
        id: 'agent_scorer',
        type: 'agentNode',
        position: { x: 850, y: 180 },
        data: {
          label: 'Scorer Agent',
          model: 'openai/gpt-oss-120b',
          temperature: 0.1,
          instructions: 'Evaluate extracted resume data against job requirements using this exact scoring rubric:\n- Hard Skills Match: 40%\n- Experience & Domain Fit: 20%\n- Soft Skills: 15%\n- Keyword Alignment: 15%\n- Quantified Impact Statements: 10%\nOutput a score breakdown table and total overall score (0-100%).',
        },
      },
      {
        id: 'agent_gap_analyst',
        type: 'agentNode',
        position: { x: 1250, y: 180 },
        data: {
          label: 'Gap Analyst Agent',
          model: 'openai/gpt-oss-120b',
          temperature: 0.3,
          instructions: 'Perform a precise gap analysis. Cite exact JD language alongside candidate resume language for every missing skill or requirement gap identified.',
        },
      },
      {
        id: 'rag_filter_1',
        type: 'ragNode',
        position: { x: 1250, y: 520 },
        data: {
          label: 'STAR Example Retriever',
          query: 'High-impact STAR accomplishment bullets for tech & leadership roles',
        },
      },
      {
        id: 'agent_rewriter',
        type: 'agentNode',
        position: { x: 1650, y: 350 },
        data: {
          label: 'Rewriter & Cover Letter Agent',
          model: 'openai/gpt-oss-120b',
          temperature: 0.7,
          instructions: 'Using the identified gaps and retrieved STAR accomplishment examples, produce:\n1. STAR-method bullet rewrites for each flagged gap.\n2. A highly tailored, compelling 3-paragraph cover letter.',
        },
      },
      {
        id: 'final_output_1',
        type: 'outputNode',
        position: { x: 2050, y: 350 },
        data: {
          label: 'Final Application Package',
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'api_fetcher_1', target: 'agent_extractor' },
      { id: 'e2', source: 'user_input_resume', target: 'agent_extractor' },
      { id: 'e3', source: 'agent_extractor', target: 'agent_scorer' },
      { id: 'e4', source: 'agent_extractor', target: 'agent_gap_analyst' },
      { id: 'e5', source: 'agent_scorer', target: 'agent_gap_analyst' },
      { id: 'e6', source: 'agent_gap_analyst', target: 'rag_filter_1' },
      { id: 'e7', source: 'agent_gap_analyst', target: 'agent_rewriter' },
      { id: 'e8', source: 'rag_filter_1', target: 'agent_rewriter' },
      { id: 'e9', source: 'agent_rewriter', target: 'final_output_1' },
    ],
  },
  {
    id: 'personal-finance-analyzer',
    name: 'Personal Finance Statement Analyzer',
    description: 'Process raw transaction records to categorize spending, flag unusual activity/subscriptions, and generate budget adjustments with strict PII guardrails.',
    category: 'Finance & Analytics',
    nodes: [
      {
        id: 'user_input_transactions',
        type: 'inputNode',
        position: { x: 50, y: 200 },
        data: {
          label: 'Transaction Data / CSV',
          value: 'Paste raw transactions or upload CSV (Date, Merchant, Amount)...',
        },
      },
      {
        id: 'agent_categorizer',
        type: 'agentNode',
        position: { x: 450, y: 200 },
        data: {
          label: 'Categorizer Agent',
          model: 'openai/gpt-oss-120b',
          temperature: 0.1,
          instructions: 'Group input transactions into standard categories (Housing, Food, Subscriptions, Utilities, Transportation, Discretionary).\nCRITICAL SAFETY RULE: Never output or repeat bank account numbers, SSNs, or sensitive customer identifiers.',
        },
      },
      {
        id: 'agent_anomaly_detector',
        type: 'agentNode',
        position: { x: 850, y: 200 },
        data: {
          label: 'Anomaly Detector Agent',
          model: 'openai/gpt-oss-120b',
          temperature: 0.2,
          instructions: 'Analyze categorized spend to identify:\n1. Outlier high-value transactions.\n2. Duplicate merchant charges.\n3. Recurring subscription charges that appear unused or redundant.',
        },
      },
      {
        id: 'agent_budget_advisor',
        type: 'agentNode',
        position: { x: 1250, y: 200 },
        data: {
          label: 'Budget Advisor Agent',
          model: 'openai/gpt-oss-120b',
          temperature: 0.5,
          instructions: 'Review categorized spending totals and flagged anomalies. Recommend 3 to 5 concrete budget adjustments and monthly savings opportunities.',
        },
      },
      {
        id: 'final_output_finance',
        type: 'outputNode',
        position: { x: 1650, y: 200 },
        data: {
          label: 'Financial Audit Report',
        },
      },
    ],
    edges: [
      { id: 'fe1', source: 'user_input_transactions', target: 'agent_categorizer' },
      { id: 'fe2', source: 'agent_categorizer', target: 'agent_anomaly_detector' },
      { id: 'fe3', source: 'agent_categorizer', target: 'agent_budget_advisor' },
      { id: 'fe4', source: 'agent_anomaly_detector', target: 'agent_budget_advisor' },
      { id: 'fe5', source: 'agent_budget_advisor', target: 'final_output_finance' },
    ],
  },
  {
    id: 'hook-master-studio',
    name: 'Hook Master (Content Studio)',
    description: 'Transform raw transcripts or ideas into viral script angles, matching captions with hashtags, and second-by-second shot lists in a branching DAG.',
    category: 'Content Strategy',
    nodes: [
      {
        id: 'user_input_dump',
        type: 'inputNode',
        position: { x: 50, y: 250 },
        data: {
          label: 'Raw Brain Dump / Transcript',
          value: 'Paste raw voice transcript or video content outline here...',
        },
      },
      {
        id: 'agent_producer',
        type: 'agentNode',
        position: { x: 450, y: 250 },
        data: {
          label: 'Producer Agent',
          model: 'openai/gpt-oss-120b',
          temperature: 0.4,
          instructions: 'Extract key elements from input: Core Value Proposition, Target Audience Persona, and Primary Emotional Hook.',
        },
      },
      {
        id: 'agent_hook_master',
        type: 'agentNode',
        position: { x: 850, y: 250 },
        data: {
          label: 'Hook Master Agent',
          model: 'openai/gpt-oss-120b',
          temperature: 0.8,
          instructions: 'Generate 3 video script angles: 1. Curiosity Hook, 2. Antagonistic/Contrarian Hook, 3. Relatable Story Hook. Explicitly select and flag the top recommended angle.\nGUARDRAIL: Do not fabricate stats or claims not present in the original input.',
        },
      },
      {
        id: 'agent_copywriter',
        type: 'agentNode',
        position: { x: 1250, y: 100 },
        data: {
          label: 'Copywriter Agent',
          model: 'openai/gpt-oss-120b',
          temperature: 0.7,
          instructions: 'Branching off the recommended angle from Hook Master: Write a social media caption, emoji placement, and 10 platform-specific hashtags.',
        },
      },
      {
        id: 'agent_director',
        type: 'agentNode',
        position: { x: 1250, y: 400 },
        data: {
          label: 'Director Agent',
          model: 'openai/gpt-oss-120b',
          temperature: 0.6,
          instructions: 'Branching off the recommended angle from Hook Master: Build a second-by-second video shot list breakdown (Talking Head, B-roll cues, Text Overlays, Sound Effects).',
        },
      },
      {
        id: 'final_output_content',
        type: 'outputNode',
        position: { x: 1650, y: 250 },
        data: {
          label: 'Complete Production Package',
        },
      },
    ],
    edges: [
      { id: 'ce1', source: 'user_input_dump', target: 'agent_producer' },
      { id: 'ce2', source: 'agent_producer', target: 'agent_hook_master' },
      { id: 'ce3', source: 'agent_hook_master', target: 'agent_copywriter' },
      { id: 'ce4', source: 'agent_hook_master', target: 'agent_director' },
      { id: 'ce5', source: 'agent_copywriter', target: 'final_output_content' },
      { id: 'ce6', source: 'agent_director', target: 'final_output_content' },
    ],
  },
];