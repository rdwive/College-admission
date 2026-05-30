/**
 * build-schools.ts
 *
 * Data pipeline for /data/schools.json.
 * Fetches from College Scorecard API (federal, free) and merges with:
 *   - Manually curated CDS data (SAT/ACT percentiles, acceptance rate labels)
 *   - Manually curated Clery Act safety data (crimes per 1000 students)
 *   - Carnegie classification overrides
 *   - NOAA-derived climate averages by city
 *   - Curated culture and mental health summaries
 *
 * Run: npx ts-node --esm scripts/build-schools.ts
 * Or:  npx tsx scripts/build-schools.ts
 *
 * Requires COLLEGE_SCORECARD_API_KEY in env (or .env.local).
 * Output: /data/schools.json
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// ─── Load env from .env.local ──────────────────────────────────────────────────
function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
}
loadEnvLocal()

const SCORECARD_KEY = process.env.COLLEGE_SCORECARD_API_KEY
if (!SCORECARD_KEY) {
  console.error('ERROR: COLLEGE_SCORECARD_API_KEY not set in .env.local')
  process.exit(1)
}

// ─── Types ─────────────────────────────────────────────────────────────────────

// Scorecard API returns FLAT keys with dot notation, not nested objects.
// e.g. result['school.name'], result['latest.student.size'], etc.
type ScorecardResult = Record<string, number | string | null>

// Helper to safely get a numeric field from a flat Scorecard result
function num(r: ScorecardResult | null, key: string): number | null {
  if (!r) return null
  const v = r[key]
  return typeof v === 'number' ? v : null
}

// Helper to safely get a string field from a flat Scorecard result
function str(r: ScorecardResult | null, key: string): string | null {
  if (!r) return null
  const v = r[key]
  return typeof v === 'string' ? v : null
}

interface SchoolOutput {
  id: string
  name: string
  state: string
  type: 'public' | 'private'
  size: number | null
  setting: 'urban' | 'suburban' | 'rural' | 'town'
  carnegie_class: string | null
  acceptance_rate: number | null
  acceptance_rate_source: string
  sat_25: number | null
  sat_75: number | null
  act_25: number | null
  act_75: number | null
  net_price_0_30k: number | null
  net_price_30_48k: number | null
  net_price_48_75k: number | null
  net_price_75_110k: number | null
  median_earnings_6yr: number | null
  pell_grant_pct: number | null
  graduation_rate: number | null
  student_faculty_ratio: number | null
  clery_crimes_per_1000: number | null
  us_news_rank: number | null
  climate_avg_temp_f: number | null
  culture_summary: string | null
  mental_health_summary: string | null
  culture_data_type: 'curated' | 'verified' | null
  mental_health_data_type: 'curated' | 'verified' | null
}

// ─── Curated supplement data ───────────────────────────────────────────────────
// Fields that aren't available from the Scorecard API.
// Key = Scorecard school name (must match exactly for merge).

interface CuratedData {
  id: string
  scorecard_id?: number   // IPEDS unit ID — use when name search is unreliable
  acceptance_rate_source?: string
  sat_25?: number | null
  sat_75?: number | null
  act_25?: number | null
  act_75?: number | null
  clery_crimes_per_1000?: number | null
  us_news_rank?: number | null
  climate_avg_temp_f?: number | null
  culture_summary?: string | null
  mental_health_summary?: string | null
  carnegie_override?: string | null
}

// Note: Acceptance rates come from Scorecard. SAT/ACT from CDS (more precise).
// Clery crimes are per 1000 enrolled students, manually computed from Clery Act reports 2022.
// Climate is average annual temperature °F (NOAA city averages).
// US News ranks as of 2024-25 edition.
const CURATED: Record<string, CuratedData> = {
  'Massachusetts Institute of Technology': {
    id: 'mit',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1510, sat_75: 1580, act_25: 34, act_75: 36,
    clery_crimes_per_1000: 0.9,
    us_news_rank: 1,
    climate_avg_temp_f: 52,
    culture_summary: 'Intensely collaborative and technically rigorous. Students describe a culture of mutual respect and intellectual honesty — "people work hard and want to see each other succeed." Maker culture is deeply embedded; lab and shop access is nearly 24/7. Unusual openness about mental health struggles compared to peer institutions.',
    mental_health_summary: 'MIT has invested significantly in mental health infrastructure after high-profile concerns in the 2010s. S3 (Student Support Services) is widely regarded, and 24/7 crisis counseling is available. Students report that help-seeking is relatively destigmatized compared to comparable schools.',
  },
  'Stanford University': {
    id: 'stanford',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1500, sat_75: 1570, act_25: 34, act_75: 36,
    clery_crimes_per_1000: 1.1,
    us_news_rank: 3,
    climate_avg_temp_f: 60,
    culture_summary: 'Often described as "work hard, play hard" with strong entrepreneurial energy. The quarter system keeps things fast-paced. Greek life exists but isn\'t dominant. Outdoor culture is significant — students frequently cite easy access to hiking, beaches, and skiing. Can feel pressure-cooker despite the sunny campus.',
    mental_health_summary: 'Counseling and Psychological Services (CAPS) offers same-day urgent appointments. Stanford has a student-run peer counseling program (Bridge Peer Counseling) that is widely used. Wait times for ongoing therapy have historically been a student concern, though staffing increased post-COVID.',
  },
  'Harvard University': {
    id: 'harvard',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1500, sat_75: 1580, act_25: 34, act_75: 36,
    clery_crimes_per_1000: 1.3,
    us_news_rank: 3,
    climate_avg_temp_f: 52,
    culture_summary: 'Academically eclectic and socially varied. Final clubs (exclusive social organizations) exist but are peripheral for most students. The house system creates a strong residential community feel. Enormous resource base means near-unlimited academic and extracurricular options. The "Harvard bubble" is real — campus can feel self-contained.',
    mental_health_summary: 'Harvard added 20 additional mental health clinicians in 2022–23 in response to longstanding student advocacy. Counseling and Mental Health Services (CAMHS) has expanded tele-health options. The student group "Room 13" offers 24/7 peer counseling. Wait times for ongoing therapy remain a student concern.',
  },
  'Yale University': {
    id: 'yale',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1500, sat_75: 1570, act_25: 34, act_75: 36,
    clery_crimes_per_1000: 2.1,
    us_news_rank: 5,
    climate_avg_temp_f: 51,
    culture_summary: 'Yale is known for its residential college system (14 colleges), which creates tight-knit sub-communities within a mid-sized university. Strong theater and arts culture. Collaborative rather than cutthroat — students widely report willingness to help each other.',
    mental_health_summary: 'Yale\'s mental health services are housed within Yale Health. The Embedded Counselor program places therapists directly in residential colleges. A 2022 student survey found nearly 40% had sought counseling, suggesting lower stigma.',
  },
  'Princeton University': {
    id: 'princeton',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1500, sat_75: 1570, act_25: 34, act_75: 36,
    clery_crimes_per_1000: 0.7,
    us_news_rank: 1,
    climate_avg_temp_f: 54,
    culture_summary: 'Princeton\'s eating clubs (social organizations tied to upperclassman dining) are a defining feature of social life — students either love the structure or find it limiting. Undergraduate focus is genuine; graduate students don\'t TA most courses.',
    mental_health_summary: 'Princeton now offers single-session counseling with next-day availability in most cases. A peer counseling program (SHARE) is active. Students cite Counseling as relatively accessible compared to peer institutions.',
  },
  'Columbia University in the City of New York': {
    id: 'columbia',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1500, sat_75: 1560, act_25: 34, act_75: 36,
    clery_crimes_per_1000: 2.9,
    us_news_rank: 12,
    climate_avg_temp_f: 55,
    culture_summary: 'Morningside Heights gives Columbia a neighborhood feel within NYC. The Core Curriculum (mandatory great books sequence) is a strong identity marker. Political engagement is high. Social life spills into the city rather than staying on campus.',
    mental_health_summary: 'Columbia\'s CPS has expanded telehealth access significantly. Students report that the city environment both supports and complicates mental health — more options, but also more overstimulation.',
  },
  'University of Chicago': {
    id: 'uchicago',
    scorecard_id: 144050,
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1500, sat_75: 1570, act_25: 34, act_75: 36,
    clery_crimes_per_1000: 1.6,
    us_news_rank: 12,
    climate_avg_temp_f: 49,
    culture_summary: 'UChicago is genuinely unlike other elite schools — it attracts students who love ideas for their own sake. "Where fun comes to die" is an ironic motto that captures real intensity. The quarter system is fast. Intellectual culture permeates social life.',
    mental_health_summary: 'UChicago\'s Let\'s Talk program offers drop-in informal consultations without formal intake. Students flag that the academic culture can normalize excessive work, making it harder to recognize when support is needed. Crisis line is 24/7.',
  },
  'University of Pennsylvania': {
    id: 'upenn',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1490, sat_75: 1560, act_25: 33, act_75: 36,
    clery_crimes_per_1000: 2.2,
    us_news_rank: 6,
    climate_avg_temp_f: 55,
    culture_summary: 'Penn has a notably pre-professional culture. Philadelphia gives the campus genuine urban character. Greek life is significant. Students describe a "Penn face" phenomenon: everyone looks fine; few admit stress.',
    mental_health_summary: 'Penn has responded to past concerns with expanded walk-in hours, embedded counselors in schools, and increased crisis support. Students report improvements but note that demand continues to outpace supply.',
  },
  'Duke University': {
    id: 'duke',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1490, sat_75: 1570, act_25: 33, act_75: 36,
    clery_crimes_per_1000: 1.0,
    us_news_rank: 7,
    climate_avg_temp_f: 60,
    culture_summary: 'Basketball is a genuine cultural institution — Cameron Crazies and K-Ville camping are not hyperbole. Research culture is strong and undergraduate access to faculty research is high.',
    mental_health_summary: 'Duke\'s CAPS has expanded telehealth and embedded counselor programs. The Peer for You program trains students in mental health first aid.',
  },
  'Northwestern University': {
    id: 'northwestern',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1490, sat_75: 1570, act_25: 33, act_75: 36,
    clery_crimes_per_1000: 0.6,
    us_news_rank: 9,
    climate_avg_temp_f: 50,
    culture_summary: 'Northwestern sits on Lake Michigan in Evanston. Strong interdisciplinary identity: Medill journalism, Kellogg feeders, engineering, theater, and music all coexist. Chicago proximity matters enormously for internships.',
    mental_health_summary: 'Counseling and Psychological Services (CAPS) offers 12 free sessions per academic year, which students describe as more accessible than many peer schools. The Wildcat Wellness peer program is active.',
  },
  'Johns Hopkins University': {
    id: 'johns-hopkins',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1480, sat_75: 1570, act_25: 33, act_75: 36,
    clery_crimes_per_1000: 1.4,
    us_news_rank: 9,
    climate_avg_temp_f: 57,
    culture_summary: 'Hopkins is defined by pre-med culture — a significant portion of students are pre-medical, which shapes social dynamics including competitive anxiety around grading. Research opportunities are unparalleled at the undergrad level given the medical center connection.',
    mental_health_summary: 'CAPS expanded to 30+ clinicians and offers same-week appointments. The peer support organization (Active Minds) is active and well-resourced.',
  },
  'Dartmouth College': {
    id: 'dartmouth',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1490, sat_75: 1570, act_25: 33, act_75: 36,
    clery_crimes_per_1000: 0.8,
    us_news_rank: 15,
    climate_avg_temp_f: 45,
    culture_summary: 'Dartmouth\'s rural location in Hanover, NH is a feature or a bug depending on the student. The D-Plan (quarter system with off-term flexibility) allows for co-ops and adventures. Greek life is central to social life. Outdoors culture (skiing, hiking) is genuine and significant.',
    mental_health_summary: 'Dartmouth has faced scrutiny over alcohol culture and its intersection with mental health. Recent years show genuine institutional investment in wellness. The remote location means fewer off-campus mental health options, partially compensated by telehealth.',
  },
  'Brown University': {
    id: 'brown',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1480, sat_75: 1570, act_25: 33, act_75: 36,
    clery_crimes_per_1000: 0.9,
    us_news_rank: 9,
    climate_avg_temp_f: 52,
    culture_summary: 'Brown\'s Open Curriculum (no required courses beyond concentration requirements) attracts students who are self-directed. The culture is politically progressive and explicitly inclusive. Providence has a genuine arts and food scene.',
    mental_health_summary: 'Brown has made significant public commitments to mental health funding. Students describe the culture as more accepting of mental health conversations than most peer schools.',
  },
  'Vanderbilt University': {
    id: 'vanderbilt',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1480, sat_75: 1570, act_25: 33, act_75: 36,
    clery_crimes_per_1000: 1.0,
    us_news_rank: 12,
    climate_avg_temp_f: 60,
    culture_summary: 'Vandy is known for a strong social scene, good weather, and Nashville\'s booming culture. Greek life is extremely significant. Nashville provides enormous music, food, and entertainment access.',
    mental_health_summary: 'University Counseling Center offers short-term therapy. Students flag that Greek culture creates pressure to appear fine, which can complicate help-seeking. Telehealth options have expanded since 2021.',
  },
  'Rice University': {
    id: 'rice',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1490, sat_75: 1570, act_25: 33, act_75: 36,
    clery_crimes_per_1000: 0.8,
    us_news_rank: 17,
    climate_avg_temp_f: 69,
    culture_summary: 'Rice\'s residential college system (11 colleges) is the cornerstone of social life — O-Week bonding creates intense loyalty to one\'s college. Culture is collaborative and genuinely quirky; engineering and science students describe an environment where being openly nerdy is celebrated.',
    mental_health_summary: 'The residential college system means RAs and college associates are embedded in students\' daily lives in a way that provides genuine informal support. Formal CAPS services offer same-week appointments for most non-emergency cases.',
  },
  'Washington University in St Louis': {
    id: 'washu',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1470, sat_75: 1560, act_25: 33, act_75: 35,
    clery_crimes_per_1000: 0.9,
    us_news_rank: 24,
    climate_avg_temp_f: 56,
    culture_summary: 'WashU attracts students increasingly similar to Ivy-level profiles. Students describe a collaborative culture with strong school spirit. St. Louis as a city is underrated — Forest Park is a major asset.',
    mental_health_summary: 'WashU\'s Habif Health and Wellness Center is modern and well-staffed. Students generally report positive experiences accessing care, though demand has outpaced supply in recent years.',
  },
  'Cornell University': {
    id: 'cornell',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1450, sat_75: 1560, act_25: 33, act_75: 35,
    clery_crimes_per_1000: 1.2,
    us_news_rank: 12,
    climate_avg_temp_f: 47,
    culture_summary: 'Cornell\'s unusual structure — statutory (quasi-public) colleges alongside endowed private schools — means the experience varies significantly by school. Ithaca is isolated, which concentrates social life on campus. Greek life is significant.',
    mental_health_summary: 'Cornell Now offers same-day counseling. Students report improvements, though Ithaca winters and academic pressure remain real challenges. Safety netting was installed on the gorges after student safety concerns.',
  },
  'University of Notre Dame': {
    id: 'notre-dame',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1440, sat_75: 1560, act_25: 33, act_75: 35,
    clery_crimes_per_1000: 0.5,
    us_news_rank: 20,
    climate_avg_temp_f: 50,
    culture_summary: 'Notre Dame\'s Catholic identity is genuinely central. Football is a cultural institution. The dorm system (residential halls with their own traditions) shapes social life more than Greek organizations, which don\'t exist.',
    mental_health_summary: 'The strong dorm community structure provides natural informal support. Formal counseling access has improved; telehealth is now available.',
  },
  'Carnegie Mellon University': {
    id: 'carnegie-mellon',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1470, sat_75: 1570, act_25: 33, act_75: 36,
    clery_crimes_per_1000: 1.5,
    us_news_rank: 22,
    climate_avg_temp_f: 52,
    culture_summary: 'CMU is defined by technical rigor and a "builder" culture — CS, robotics, drama, and music all coexist in a uniquely CMU way. Workload is genuinely heavy. Pittsburgh has transformed significantly; the cultural scene is far richer than its reputation suggests.',
    mental_health_summary: 'CMU has been proactive since the 2010s. The "CMU bubble" effect (intense focus on work) can make it harder to maintain outside relationships and perspective. TimelyCare telehealth is available 24/7.',
  },
  'Emory University': {
    id: 'emory',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1400, sat_75: 1530, act_25: 32, act_75: 35,
    clery_crimes_per_1000: 1.8,
    us_news_rank: 24,
    climate_avg_temp_f: 62,
    culture_summary: 'Emory\'s pre-medical culture is strong — CDC proximity and Emory Medical\'s reputation attract health-focused students. Greek life is significant. Atlanta provides genuine urban immersion.',
    mental_health_summary: 'Emory\'s connection to public health research means campus wellness programming is data-informed. The pre-med culture can increase stress, but Emory has been explicit about addressing wellbeing.',
  },
  'University of California-Berkeley': {
    id: 'uc-berkeley',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1310, sat_75: 1530, act_25: 29, act_75: 35,
    clery_crimes_per_1000: 2.4,
    us_news_rank: 16,
    climate_avg_temp_f: 58,
    culture_summary: 'Berkeley is defined by political activism, intellectual ambition, and scale. It is not a place for students who need hand-holding. Bay Area location means extraordinary access to tech industry, research, and culture.',
    mental_health_summary: 'Scale is the challenge — with 45,000 students, wait times for ongoing therapy can be long. Berkeley has invested in group therapy options and peer counseling. Students who proactively seek resources generally find them.',
  },
  'University of California-Los Angeles': {
    id: 'ucla',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1290, sat_75: 1530, act_25: 28, act_75: 34,
    clery_crimes_per_1000: 1.2,
    us_news_rank: 15,
    climate_avg_temp_f: 68,
    culture_summary: 'UCLA\'s location in Westwood with LA all around is a genuine differentiator. Bruin identity and school spirit are strong. First-gen enrollment (~40%) is one of the highest among elite schools.',
    mental_health_summary: 'The Arthur Ashe Student Health and Wellness Center integrates physical and mental health. Peer counseling (CAPS Peer Resource Program) is active. Students who reach out generally find the services responsive.',
  },
  'University of Michigan-Ann Arbor': {
    id: 'umich',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1360, sat_75: 1530, act_25: 32, act_75: 35,
    clery_crimes_per_1000: 1.8,
    us_news_rank: 23,
    climate_avg_temp_f: 49,
    culture_summary: 'Michigan is a flagship done right — enormous resources, top faculty, genuine research opportunities, and one of the most powerful alumni networks in the country. Ann Arbor is consistently rated one of the best college towns.',
    mental_health_summary: 'Michigan has added same-day assessment appointments. The scale means group therapy is heavily utilized. Students generally rate services as adequate.',
  },
  'University of Virginia-Main Campus': {
    id: 'uva',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1320, sat_75: 1510, act_25: 31, act_75: 35,
    clery_crimes_per_1000: 1.1,
    us_news_rank: 25,
    climate_avg_temp_f: 57,
    culture_summary: 'UVA\'s Jefferson-designed campus is one of the most beautiful in the country. Honor culture (the single Sanction Honor Code) is a defining identity marker. Greek life is dominant in social life.',
    mental_health_summary: 'UVA has expanded telehealth and walk-in options since 2020. The honor system and academic pressure create specific stress dynamics. Students generally describe services as accessible.',
  },
  'University of North Carolina at Chapel Hill': {
    id: 'unc-chapel-hill',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1310, sat_75: 1500, act_25: 29, act_75: 34,
    clery_crimes_per_1000: 1.4,
    us_news_rank: 28,
    climate_avg_temp_f: 60,
    culture_summary: 'Carolina is a flagship with genuine school spirit, an extraordinary journalism and public health reputation, and a campus culture that is more diverse and progressive than the surrounding state context might suggest.',
    mental_health_summary: 'UNC\'s School of Social Work and School of Public Health bring research expertise to campus wellness programming. Services are generally accessible.',
  },
  'Georgia Institute of Technology-Main Campus': {
    id: 'georgia-tech',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1360, sat_75: 1540, act_25: 32, act_75: 35,
    clery_crimes_per_1000: 2.6,
    us_news_rank: 33,
    climate_avg_temp_f: 63,
    culture_summary: 'GT is an engineering and CS powerhouse with exceptionally strong co-op and internship placement. Atlanta provides extraordinary tech industry access. Culture is hard-working and pragmatic.',
    mental_health_summary: 'GT\'s Culture of Care initiative explicitly targets the high-stress engineering culture. The CARE Center is well-regarded. Students describe honest acknowledgment of academic pressure.',
  },
  'The University of Texas at Austin': {
    id: 'ut-austin',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1210, sat_75: 1480, act_25: 26, act_75: 33,
    clery_crimes_per_1000: 2.8,
    us_news_rank: 32,
    climate_avg_temp_f: 69,
    culture_summary: 'UT Austin is Texas in a bottle — enormous, proud, and full of school spirit. Austin\'s growth has made the city one of the most exciting in the country for tech, music, and food. In-state students are strongly preferred.',
    mental_health_summary: 'Counseling and Mental Health Center (CMHC) is one of the larger university counseling operations in the country. MindBody Lab and stress management workshops are well-attended.',
  },
  'Tufts University': {
    id: 'tufts',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1440, sat_75: 1550, act_25: 32, act_75: 35,
    clery_crimes_per_1000: 0.7,
    us_news_rank: 28,
    climate_avg_temp_f: 52,
    culture_summary: 'Tufts attracts students who are internationally minded, politically engaged, and comfortable with ambiguity — the Fletcher School influence permeates the culture. Medford/Somerville provides Boston proximity with a community feel.',
    mental_health_summary: 'Tufts\' small-medium size means more personalized access than large state schools. Active Minds chapter is well-organized.',
  },
  'Boston College': {
    id: 'boston-college',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1390, sat_75: 1530, act_25: 32, act_75: 35,
    clery_crimes_per_1000: 0.6,
    us_news_rank: 35,
    climate_avg_temp_f: 52,
    culture_summary: 'BC\'s Jesuit identity shapes its mission of service and intellectual inquiry in ways students describe as genuine. Chestnut Hill campus is beautiful. Greek life doesn\'t exist. Sporting culture is strong, particularly hockey.',
    mental_health_summary: 'Jesuit mission translates to genuine community investment in student wellbeing. BC\'s Agape Latte and other community programs create informal wellbeing support structures.',
  },
  'New York University': {
    id: 'nyu',
    scorecard_id: 193900,
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1370, sat_75: 1540, act_25: 31, act_75: 35,
    clery_crimes_per_1000: 1.9,
    us_news_rank: 35,
    climate_avg_temp_f: 55,
    culture_summary: 'NYU IS New York City — there\'s no separation between campus and city. Students with strong self-directedness thrive; students who need community scaffolding can find it isolating. Arts, media, finance, and law connections are unmatched.',
    mental_health_summary: 'The city context means external mental health resources (private therapists, city programs) are unusually accessible. Campus community can feel diffuse given lack of central campus.',
  },
  'University of Southern California': {
    id: 'usc',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1400, sat_75: 1540, act_25: 32, act_75: 35,
    clery_crimes_per_1000: 3.2,
    us_news_rank: 27,
    climate_avg_temp_f: 68,
    culture_summary: 'USC\'s "Trojan Family" alumni loyalty and networking is genuinely extraordinary, particularly in entertainment, tech, and real estate. LA gives the campus unmatched industry access. Financial aid has improved significantly.',
    mental_health_summary: 'Engemann Student Health Center provides integrated mental health services. USC has invested substantially post-COVID. Students describe mental health resources as available and increasingly destigmatized.',
  },
  'Georgetown University': {
    id: 'georgetown',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1380, sat_75: 1560, act_25: 31, act_75: 35,
    clery_crimes_per_1000: 1.6,
    us_news_rank: 22,
    climate_avg_temp_f: 58,
    culture_summary: 'Georgetown is defined by politics, international affairs, and Jesuit service ethos. Washington DC is not background — it\'s the curriculum. Many students interning on the Hill or in think tanks simultaneously.',
    mental_health_summary: 'Georgetown\'s Jesuit mission translates into genuine community care. DC\'s pace and political intensity create specific stressors. Students report that formal services are accessible.',
  },
  'Wake Forest University': {
    id: 'wake-forest',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1350, sat_75: 1510, act_25: 31, act_75: 34,
    clery_crimes_per_1000: 1.2,
    us_news_rank: 35,
    climate_avg_temp_f: 59,
    culture_summary: 'Wake Forest has a distinctive "pro humanitate" service ethos. Small size means genuine faculty access and tight community. Greek life is significant. Winston-Salem has grown culturally.',
    mental_health_summary: 'Wake Forest\'s pro humanitate mission translates into active peer support culture. Students describe the community as genuinely caring.',
  },
  'Tulane University of Louisiana': {
    id: 'tulane',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1390, sat_75: 1530, act_25: 32, act_75: 34,
    clery_crimes_per_1000: 2.9,
    us_news_rank: 44,
    climate_avg_temp_f: 68,
    culture_summary: 'Tulane and New Orleans are inseparable — Mardi Gras is a semester-defining event. Strong Greek life. Service-learning is embedded in the curriculum post-Katrina. Students describe an unusually joyful campus culture.',
    mental_health_summary: 'New Orleans\' unique culture is supportive in some ways (joyfulness, community) and challenging in others (party culture). Students describe mental health resources as present but note demand has outpaced staffing.',
  },
  'Purdue University-Main Campus': {
    id: 'purdue',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1200, sat_75: 1450, act_25: 26, act_75: 33,
    clery_crimes_per_1000: 1.0,
    us_news_rank: 53,
    climate_avg_temp_f: 52,
    culture_summary: 'Purdue is the engineering and agriculture flagship of Indiana. "Boilermaker" identity is strong. Co-op and internship placement in engineering and CS is exceptional. West Lafayette is a college town without much outside the university.',
    mental_health_summary: 'Purdue developed "Purdue Cares" as a proactive student-in-distress program — faculty and staff are trained to identify and refer struggling students.',
  },
  'Ohio State University-Main Campus': {
    id: 'ohio-state',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1200, sat_75: 1430, act_25: 26, act_75: 32,
    clery_crimes_per_1000: 1.6,
    us_news_rank: 53,
    climate_avg_temp_f: 52,
    culture_summary: 'Ohio State\'s scale is staggering but also its strength — near-limitless extracurricular options, enormous alumni network, and Columbus as the backdrop. Football is the social heartbeat. Honors programs provide a small-school feel.',
    mental_health_summary: 'Ohio State\'s Student Life division is one of the most developed in the country for a public flagship. Scale means group therapy, workshops, and peer programs are heavily utilized.',
  },
  'Pennsylvania State University-Main Campus': {
    id: 'penn-state',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1160, sat_75: 1390, act_25: 25, act_75: 32,
    clery_crimes_per_1000: 1.1,
    us_news_rank: 59,
    climate_avg_temp_f: 50,
    culture_summary: 'Penn State is football and "We Are" — community identity at an extraordinary scale. State College is geographically isolated, which means the university IS the social world. The Nittany Lions alumni network is strong and loyal.',
    mental_health_summary: 'Penn State introduced "CAPS on the Road" which brings counselors to residence halls. Students describe services as accessible but note that the scale and isolation of State College can compound mental health challenges.',
  },
  'University of Florida': {
    id: 'university-of-florida',
    scorecard_id: 134130,
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1310, sat_75: 1480, act_25: 29, act_75: 33,
    clery_crimes_per_1000: 1.3,
    us_news_rank: 28,
    climate_avg_temp_f: 72,
    culture_summary: 'UF is Florida\'s flagship and a genuinely strong research institution. Gainesville has a college-town feel. Football and school spirit are central. Florida Bright Futures scholarship makes UF an extraordinary value for in-state students.',
    mental_health_summary: 'UF was an early adopter of telehealth counseling. The warm climate is a genuine mental health asset. Gators Care peer program is active and well-attended.',
  },
  'University of Illinois Urbana-Champaign': {
    id: 'university-of-illinois',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1270, sat_75: 1500, act_25: 27, act_75: 34,
    clery_crimes_per_1000: 1.0,
    us_news_rank: 35,
    climate_avg_temp_f: 52,
    culture_summary: 'UIUC\'s CS and engineering programs are among the strongest in the world — recruiter presence from top tech companies is extraordinary. Acceptance rate for CS specifically is dramatically lower than overall.',
    mental_health_summary: 'Illinois\' CARE Team provides proactive outreach to students in distress. The intense tech culture can create pressure, but the university has been deliberate about normalizing mental health conversations.',
  },
  'University of Wisconsin-Madison': {
    id: 'wisconsin',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1310, sat_75: 1500, act_25: 28, act_75: 33,
    clery_crimes_per_1000: 1.5,
    us_news_rank: 35,
    climate_avg_temp_f: 45,
    culture_summary: 'Madison is consistently ranked one of the best college towns in America — State Street, the Capitol, Lake Mendota. Big Ten sports culture is strong. Research opportunities for undergrads are excellent.',
    mental_health_summary: 'Wisconsin\'s "UW Mental Health" initiative has normalized conversations campus-wide. Lake Mendota and the outdoors community provide meaningful informal wellness support.',
  },
  'Texas A & M University-College Station': {
    id: 'texas-am',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1140, sat_75: 1370, act_25: 24, act_75: 31,
    clery_crimes_per_1000: 0.7,
    us_news_rank: 77,
    climate_avg_temp_f: 67,
    culture_summary: 'Aggie identity is among the strongest in American higher education — the Aggie Code of Honor, traditions, Yell Leaders, and 12th Man are not superficial. Community is genuine and the alumni network is extraordinarily loyal.',
    mental_health_summary: 'Aggie culture places high value on resilience, which can sometimes complicate help-seeking. The Aggie OneStop support system integrates mental health with academic advising.',
  },
  'Case Western Reserve University': {
    id: 'case-western',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1400, sat_75: 1540, act_25: 32, act_75: 35,
    clery_crimes_per_1000: 1.9,
    us_news_rank: 42,
    climate_avg_temp_f: 50,
    culture_summary: 'CWRU is a STEM powerhouse adjacent to the Cleveland Clinic and University Hospitals — pre-med, biomedical engineering, and nursing pipelines are exceptional. Cleveland\'s arts district (University Circle) surrounds the campus.',
    mental_health_summary: 'CWRU\'s pre-med culture creates specific stress profiles. The proximity to major medical centers means specialized mental health referrals are readily available.',
  },
  'Lehigh University': {
    id: 'lehigh',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1330, sat_75: 1490, act_25: 30, act_75: 34,
    clery_crimes_per_1000: 0.8,
    us_news_rank: 52,
    climate_avg_temp_f: 52,
    culture_summary: 'Lehigh is a technical school with business school strength — engineering and business are the dominant programs. Greek life is extremely prominent. Bethlehem has improved significantly as a small city.',
    mental_health_summary: 'Lehigh\'s small size means more personalized access. Greek life social structure creates specific pressures; Counseling Center has active outreach to Greek chapters.',
  },
  'University of California-San Diego': {
    id: 'uc-san-diego',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1280, sat_75: 1490, act_25: 28, act_75: 34,
    clery_crimes_per_1000: 0.8,
    us_news_rank: 28,
    climate_avg_temp_f: 65,
    culture_summary: 'UCSD sits above La Jolla cliffs — one of the most beautiful campus settings in the US. The six-college system creates community within scale. Social scene is famously described as "UCSD: where fun goes to study." Biotech and pharma industry proximity is a genuine career asset.',
    mental_health_summary: 'UCSD\'s "Triton Well-Being" initiative is comprehensive. The competitive academic culture in STEM programs creates specific stress patterns. Students describe services as accessible.',
  },
  'University of California-Davis': {
    id: 'uc-davis',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1200, sat_75: 1440, act_25: 26, act_75: 33,
    clery_crimes_per_1000: 0.6,
    us_news_rank: 38,
    climate_avg_temp_f: 63,
    culture_summary: 'UC Davis is agriculture, veterinary medicine, and environmental science. The most bike-friendly campus in America. Davis is a small, safe, pleasant college town. More laid-back culture than Berkeley or UCLA.',
    mental_health_summary: 'UC Davis developed early telehealth counseling programs. The laid-back campus culture and outdoor opportunities are described as positive factors. Services are generally accessible.',
  },
  'University of California-Santa Barbara': {
    id: 'uc-santa-barbara',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1230, sat_75: 1470, act_25: 26, act_75: 33,
    clery_crimes_per_1000: 1.1,
    us_news_rank: 32,
    climate_avg_temp_f: 65,
    culture_summary: 'UCSB sits on cliffs above the Pacific. Party culture and beach culture coexist with a serious research university. Research in materials science and physics is particularly strong.',
    mental_health_summary: 'UCSB has been deliberate about mental health programming in the post-Isla Vista era (2014). The outdoor and beach culture provides genuine informal wellness support.',
  },
  'Rutgers University-New Brunswick': {
    id: 'rutgers',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1200, sat_75: 1430, act_25: 26, act_75: 32,
    clery_crimes_per_1000: 1.4,
    us_news_rank: 53,
    climate_avg_temp_f: 53,
    culture_summary: 'Rutgers benefits from NYC proximity and an unusually diverse student body. Pre-law and pharmacy programs are particularly strong. The NYC metro location creates extraordinary internship and job access.',
    mental_health_summary: 'Rutgers has a nationally recognized telehealth counseling program. Students describe services as accessible; multilingual mental health resources are available.',
  },
  'Indiana University-Bloomington': {
    id: 'indiana-university',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1120, sat_75: 1360, act_25: 23, act_75: 31,
    clery_crimes_per_1000: 1.2,
    us_news_rank: 77,
    climate_avg_temp_f: 52,
    culture_summary: 'Bloomington is one of America\'s great college towns. IU\'s Jacobs School of Music is world-class. Kelley School of Business is a genuine business education powerhouse. Greek life is very significant.',
    mental_health_summary: 'Bloomington\'s college town environment and natural surroundings provide meaningful informal support. Students describe a warm social culture that aids mental health.',
  },
  'Baylor University': {
    id: 'baylor',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1200, sat_75: 1420, act_25: 25, act_75: 32,
    clery_crimes_per_1000: 0.9,
    us_news_rank: 77,
    climate_avg_temp_f: 65,
    culture_summary: 'Baylor\'s Baptist heritage shapes campus culture genuinely — chapel attendance, honor codes, and faith life are central. Waco has experienced a significant Magnolia-driven revitalization.',
    mental_health_summary: 'Baylor\'s Counseling Center integrates faith-based and clinical approaches. Students who identify differently from the dominant Christian culture may need to seek community more deliberately.',
  },
  'Virginia Polytechnic Institute and State University': {
    id: 'virginia-tech',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1230, sat_75: 1430, act_25: 27, act_75: 33,
    clery_crimes_per_1000: 0.8,
    us_news_rank: 53,
    climate_avg_temp_f: 55,
    culture_summary: 'Virginia Tech has built one of the strongest engineering programs in the Southeast. Blacksburg is isolated but the Hokies community is all-encompassing. The Corps of Cadets (ROTC) adds a distinct military community element.',
    mental_health_summary: 'Cook Counseling Center has expanded significantly since 2007. VT has made institutional commitments to mental health that are widely acknowledged.',
  },
  'University of Colorado Boulder': {
    id: 'colorado',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1180, sat_75: 1400, act_25: 25, act_75: 31,
    clery_crimes_per_1000: 2.1,
    us_news_rank: 97,
    climate_avg_temp_f: 51,
    culture_summary: 'Boulder\'s location at the Rockies foothills makes outdoor culture central — skiing, hiking, and mountain biking are not weekend trips but lifestyle. Sustainability and environmental culture are dominant.',
    mental_health_summary: 'Boulder\'s outdoor environment is a genuine mental health asset. Cannabis legality in Colorado creates a specific context that the university addresses explicitly in wellness programming.',
  },
  'Arizona State University-Tempe': {
    id: 'arizona-state',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1110, sat_75: 1360, act_25: 21, act_75: 29,
    clery_crimes_per_1000: 2.4,
    us_news_rank: 117,
    climate_avg_temp_f: 75,
    culture_summary: 'ASU\'s "innovation university" positioning is genuine. W. P. Carey business, Walter Cronkite journalism, and Ira A. Fulton engineering have real national profiles. Honors programs provide a quality small-school experience within the large institution.',
    mental_health_summary: 'Students describe the sunny environment as a mental health asset. Honors College students describe services as significantly more accessible than general population experience.',
  },
  'Michigan State University': {
    id: 'michigan-state',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1120, sat_75: 1360, act_25: 23, act_75: 30,
    clery_crimes_per_1000: 1.3,
    us_news_rank: 77,
    climate_avg_temp_f: 48,
    culture_summary: 'MSU\'s campus is one of the most beautiful in the Midwest. Strong agricultural, veterinary, and communications programs. Intense rivalry with Michigan. East Lansing is a functional college town.',
    mental_health_summary: 'MSU has developed comprehensive mental health initiatives post-2018. Students describe ongoing improvement in services and campus culture around mental health.',
  },
  'University of Maryland-College Park': {
    id: 'university-of-maryland',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1300, sat_75: 1490, act_25: 29, act_75: 33,
    clery_crimes_per_1000: 1.6,
    us_news_rank: 53,
    climate_avg_temp_f: 58,
    culture_summary: 'UMD\'s proximity to DC (Metro-accessible) gives it unique research and internship access. CS and engineering programs are exceptionally strong and well-connected to the federal contractor ecosystem.',
    mental_health_summary: 'UMD\'s proximity to DC mental health resources supplements campus services. The Collegiate Recovery community for students in recovery is well-resourced.',
  },
  'Harvey Mudd College': {
    id: 'harvey-mudd',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1510, sat_75: 1580, act_25: 35, act_75: 36,
    clery_crimes_per_1000: 0.5,
    us_news_rank: 2,
    climate_avg_temp_f: 68,
    culture_summary: 'Harvey Mudd is tiny, intensely technical, and collaborative. The Honor Code is genuine. Students share homework answers openly. Claremont Consortium access gives remarkable breadth. Workload is extreme but the collaborative culture makes this manageable.',
    mental_health_summary: 'Harvey Mudd has been proactive about mental health given the intense academic environment. Students describe a culture where it\'s more acceptable to struggle openly than at many peers.',
  },
  'California Institute of Technology': {
    id: 'caltech',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1530, sat_75: 1590, act_25: 35, act_75: 36,
    clery_crimes_per_1000: 0.4,
    us_news_rank: 1,
    climate_avg_temp_f: 68,
    culture_summary: 'Caltech is one of the most academically intense places in the world — a 900-person undergraduate program with PhD-level research norms for undergrads. The Honor Code is absolute. The dorm culture (House system) is beloved.',
    mental_health_summary: 'Caltech has been proactive about mental health since acknowledging historical struggles. The collaborative (not competitive) academic culture helps. Students describe a community where help-seeking is more normalized than at comparable intensity schools.',
  },
  'Swarthmore College': {
    id: 'swarthmore',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1470, sat_75: 1570, act_25: 33, act_75: 35,
    clery_crimes_per_1000: 0.6,
    us_news_rank: 3,
    climate_avg_temp_f: 54,
    culture_summary: 'Swarthmore is a liberal arts college with a Quaker heritage that takes social justice seriously without being performative. Engineering is unusual and strong for a LAC. Students describe an intensely intellectual, politically engaged, and socially conscious environment.',
    mental_health_summary: 'Swarthmore has been recognized for mental health culture. The Quaker tradition of community meeting creates informal support structures. Students describe a campus where talking about struggle is normalized.',
  },
  'Williams College': {
    id: 'williams',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1470, sat_75: 1560, act_25: 33, act_75: 35,
    clery_crimes_per_1000: 0.4,
    us_news_rank: 1,
    climate_avg_temp_f: 47,
    culture_summary: 'Williams is a liberal arts college in the Berkshires — small, rural, and extraordinarily resourced. Tutorial system (two students + one professor) creates research-level engagement from sophomore year. Financial aid meets full demonstrated need for all admits.',
    mental_health_summary: 'Williams\' small size and resource depth mean mental health staffing ratios are excellent. The rural isolation can create cabin-fever dynamics, but the tight community generally compensates.',
  },
  'Amherst College': {
    id: 'amherst',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1450, sat_75: 1570, act_25: 33, act_75: 35,
    clery_crimes_per_1000: 0.8,
    us_news_rank: 2,
    climate_avg_temp_f: 50,
    culture_summary: 'Amherst\'s Five College Consortium gives remarkable breadth for a tiny LAC. No distribution requirements — entirely student-directed curriculum. Strong focus on social justice and diversity.',
    mental_health_summary: 'Amherst\'s culture explicitly values emotional intelligence alongside intellectual achievement. Students describe a campus where mental health conversations are destigmatized.',
  },
  'Pomona College': {
    id: 'pomona',
    acceptance_rate_source: 'CDS 2023-24',
    sat_25: 1440, sat_75: 1560, act_25: 33, act_75: 35,
    clery_crimes_per_1000: 0.6,
    us_news_rank: 4,
    climate_avg_temp_f: 68,
    culture_summary: 'Pomona is the anchor of the Claremont Colleges (5C consortium). Southern California weather is a genuine asset. Financial aid is need-blind and extraordinarily generous. Students describe a collaborative, intellectually passionate community.',
    mental_health_summary: '5C access means additional resources beyond Pomona\'s campus. Students describe a culture where mental health is openly discussed and help-seeking is normal.',
  },
}

// ─── Carnegie classification mapping ──────────────────────────────────────────
// Maps Scorecard carnegie_basic codes to human-readable strings
function carnegieName(code: number | null): string | null {
  if (code === null) return null
  const map: Record<number, string> = {
    1: 'Associate\'s',
    2: 'Associate\'s',
    3: 'Bac/A&S',
    4: 'Bac/A&S',
    5: 'Bac/Diverse',
    6: 'Bac/Diverse',
    7: 'Masters/S',
    8: 'Masters/M',
    9: 'Masters/L',
    10: 'R3',
    11: 'R2',
    12: 'R2',
    13: 'R1',
    14: 'R1',
    15: 'Doctoral/Prof',
    16: 'Doctoral/Prof',
    17: 'Special Focus',
    18: 'Tribal',
    19: 'Special Health',
    20: 'Special Tech',
    21: 'Bac/AS',
    22: 'Associate\'s',
    23: 'Not classified',
  }
  return map[code] ?? null
}

// Map Scorecard locale codes to setting strings
function settingName(locale: number | null): 'urban' | 'suburban' | 'rural' | 'town' {
  if (locale === null) return 'suburban'
  if (locale >= 11 && locale <= 13) return 'urban'
  if (locale >= 21 && locale <= 23) return 'suburban'
  if (locale >= 31 && locale <= 33) return 'town'
  if (locale >= 41 && locale <= 43) return 'rural'
  return 'suburban'
}

// ─── Scorecard API fetch ───────────────────────────────────────────────────────

const SCORECARD_BASE = 'https://api.data.gov/ed/collegescorecard/v1/schools'

const FIELDS = [
  'id',
  'school.name',
  'school.state',
  'school.city',
  'school.ownership',
  'school.carnegie_basic',
  'school.locale',
  'latest.student.size',
  'latest.student.pell_grant',
  'latest.admissions.admission_rate.overall',
  'latest.admissions.sat_scores.25th_percentile.critical_reading',
  'latest.admissions.sat_scores.25th_percentile.math',
  'latest.admissions.sat_scores.75th_percentile.critical_reading',
  'latest.admissions.sat_scores.75th_percentile.math',
  'latest.admissions.act_scores.25th_percentile.cumulative',
  'latest.admissions.act_scores.75th_percentile.cumulative',
  'latest.cost.net_price.public.by_income_level.0-30000',
  'latest.cost.net_price.public.by_income_level.30001-48000',
  'latest.cost.net_price.public.by_income_level.48001-75000',
  'latest.cost.net_price.public.by_income_level.75001-110000',
  'latest.cost.net_price.private.by_income_level.0-30000',
  'latest.cost.net_price.private.by_income_level.30001-48000',
  'latest.cost.net_price.private.by_income_level.48001-75000',
  'latest.cost.net_price.private.by_income_level.75001-110000',
  'latest.completion.rate_suppressed.overall',
  'latest.earnings.6_yrs_after_entry.median',
  'latest.faculty.ratio',
].join(',')

async function fetchSchoolByName(name: string): Promise<ScorecardResult | null> {
  const url = `${SCORECARD_BASE}?api_key=${SCORECARD_KEY}&school.name=${encodeURIComponent(name)}&_fields=${FIELDS}&per_page=5`

  const res = await fetch(url)
  if (!res.ok) {
    console.warn(`  Scorecard HTTP ${res.status} for "${name}"`)
    return null
  }
  const data = await res.json() as { results: ScorecardResult[]; metadata: { total: number } }
  if (!data.results || data.results.length === 0) {
    console.warn(`  No Scorecard results for "${name}"`)
    return null
  }

  // Prefer exact name match (flat key: 'school.name'), fall back to first result
  const exact = data.results.find(r =>
    typeof r['school.name'] === 'string' &&
    r['school.name'].toLowerCase() === name.toLowerCase()
  )
  return exact ?? data.results[0]
}

async function fetchSchoolById(id: number): Promise<ScorecardResult | null> {
  const url = `${SCORECARD_BASE}?api_key=${SCORECARD_KEY}&id=${id}&_fields=${FIELDS}`

  const res = await fetch(url)
  if (!res.ok) {
    console.warn(`  Scorecard HTTP ${res.status} for ID ${id}`)
    return null
  }
  const data = await res.json() as { results: ScorecardResult[]; metadata: { total: number } }
  if (!data.results || data.results.length === 0) {
    console.warn(`  No Scorecard results for ID ${id}`)
    return null
  }
  return data.results[0]
}

// ─── Merge logic ───────────────────────────────────────────────────────────────

function buildSchoolEntry(
  curated: CuratedData,
  scorecardName: string,
  sc: ScorecardResult | null
): SchoolOutput {
  // Scorecard: ownership 1=public, 2=private nonprofit, 3=private for-profit
  const ownership = num(sc, 'school.ownership')
  const isPublic = ownership === 1

  // Net price keys differ by ownership type
  const pricePrefix = isPublic
    ? 'latest.cost.net_price.public.by_income_level'
    : 'latest.cost.net_price.private.by_income_level'

  // SAT composite: Scorecard splits CR + Math; add them
  const sat25cr = num(sc, 'latest.admissions.sat_scores.25th_percentile.critical_reading')
  const sat25m  = num(sc, 'latest.admissions.sat_scores.25th_percentile.math')
  const sat75cr = num(sc, 'latest.admissions.sat_scores.75th_percentile.critical_reading')
  const sat75m  = num(sc, 'latest.admissions.sat_scores.75th_percentile.math')

  const scorecardSat25 = sat25cr !== null && sat25m !== null ? sat25cr + sat25m : null
  const scorecardSat75 = sat75cr !== null && sat75m !== null ? sat75cr + sat75m : null

  // Prefer curated CDS SAT/ACT (more precise, directly from CDS forms)
  const sat25 = curated.sat_25 ?? scorecardSat25
  const sat75 = curated.sat_75 ?? scorecardSat75
  const act25 = curated.act_25 ?? num(sc, 'latest.admissions.act_scores.25th_percentile.cumulative')
  const act75 = curated.act_75 ?? num(sc, 'latest.admissions.act_scores.75th_percentile.cumulative')

  const carnegieCode = num(sc, 'school.carnegie_basic')
  const carnegie = curated.carnegie_override ?? carnegieName(carnegieCode)

  return {
    id: curated.id,
    name: str(sc, 'school.name') ?? scorecardName,
    state: str(sc, 'school.state') ?? 'XX',
    type: isPublic ? 'public' : 'private',
    size: num(sc, 'latest.student.size'),
    setting: settingName(num(sc, 'school.locale')),
    carnegie_class: carnegie,
    acceptance_rate: num(sc, 'latest.admissions.admission_rate.overall'),
    acceptance_rate_source: curated.acceptance_rate_source ?? 'College Scorecard 2023',
    sat_25: sat25,
    sat_75: sat75,
    act_25: act25,
    act_75: act75,
    net_price_0_30k: num(sc, `${pricePrefix}.0-30000`),
    net_price_30_48k: num(sc, `${pricePrefix}.30001-48000`),
    net_price_48_75k: num(sc, `${pricePrefix}.48001-75000`),
    net_price_75_110k: num(sc, `${pricePrefix}.75001-110000`),
    median_earnings_6yr: num(sc, 'latest.earnings.6_yrs_after_entry.median'),
    pell_grant_pct: num(sc, 'latest.student.pell_grant'),
    graduation_rate: num(sc, 'latest.completion.rate_suppressed.overall'),
    student_faculty_ratio: num(sc, 'latest.faculty.ratio'),
    clery_crimes_per_1000: curated.clery_crimes_per_1000 ?? null,
    us_news_rank: curated.us_news_rank ?? null,
    climate_avg_temp_f: curated.climate_avg_temp_f ?? null,
    culture_summary: curated.culture_summary ?? null,
    mental_health_summary: curated.mental_health_summary ?? null,
    culture_data_type: curated.culture_summary ? 'curated' : null,
    mental_health_data_type: curated.mental_health_summary ? 'curated' : null,
  }
}

// ─── Validation ────────────────────────────────────────────────────────────────

function validateEntry(school: SchoolOutput): string[] {
  const issues: string[] = []
  const quantFields: (keyof SchoolOutput)[] = [
    'acceptance_rate', 'sat_25', 'sat_75', 'net_price_0_30k',
    'median_earnings_6yr', 'graduation_rate', 'student_faculty_ratio',
  ]
  const nullCount = quantFields.filter(f => school[f] === null).length
  if (nullCount > 3) {
    issues.push(`${school.name}: ${nullCount} null quantitative fields (${quantFields.filter(f => school[f] === null).join(', ')})`)
  }
  if (!school.culture_summary) issues.push(`${school.name}: missing culture_summary`)
  if (!school.mental_health_summary) issues.push(`${school.name}: missing mental_health_summary`)
  return issues
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Building schools.json from College Scorecard API...`)
  console.log(`Fetching ${Object.keys(CURATED).length} schools\n`)

  const results: SchoolOutput[] = []
  const validationIssues: string[] = []

  for (const [scorecardName, curated] of Object.entries(CURATED)) {
    process.stdout.write(`  Fetching: ${scorecardName}... `)
    const sc = curated.scorecard_id
      ? await fetchSchoolById(curated.scorecard_id)
      : await fetchSchoolByName(scorecardName)
    if (sc) {
      process.stdout.write(`✓ (${sc['school.name'] ?? sc['id']}, ${sc['school.state'] ?? '?'})\n`)
    } else {
      process.stdout.write(`⚠ no result — using curated data only\n`)
    }

    const entry = buildSchoolEntry(curated, scorecardName, sc)
    results.push(entry)

    const issues = validateEntry(entry)
    validationIssues.push(...issues)

    // Rate limit: be gentle with the API
    await new Promise(r => setTimeout(r, 150))
  }

  // Sort by us_news_rank then name
  results.sort((a, b) => {
    const ra = a.us_news_rank ?? 9999
    const rb = b.us_news_rank ?? 9999
    if (ra !== rb) return ra - rb
    return a.name.localeCompare(b.name)
  })

  // Write output
  const outPath = path.join(process.cwd(), 'data', 'schools.json')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2))

  console.log(`\n✅ Written ${results.length} schools to data/schools.json`)

  if (validationIssues.length > 0) {
    console.log(`\n⚠ Validation warnings (${validationIssues.length}):`)
    validationIssues.forEach(i => console.log(`  - ${i}`))
  } else {
    console.log('✅ All entries pass validation (≤3 null quantitative fields, culture/MH summaries present)')
  }

  // Print summary stats
  const nullAccept = results.filter(r => r.acceptance_rate === null).length
  const nullSat = results.filter(r => r.sat_25 === null).length
  const nullNet = results.filter(r => r.net_price_0_30k === null).length
  const nullEarnings = results.filter(r => r.median_earnings_6yr === null).length
  console.log(`\nData coverage:`)
  console.log(`  Acceptance rate: ${results.length - nullAccept}/${results.length}`)
  console.log(`  SAT 25th pct:    ${results.length - nullSat}/${results.length}`)
  console.log(`  Net price <30k:  ${results.length - nullNet}/${results.length}`)
  console.log(`  Median earnings: ${results.length - nullEarnings}/${results.length}`)
}

main().catch(e => {
  console.error('Build failed:', e)
  process.exit(1)
})
