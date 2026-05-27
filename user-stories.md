# BRIDGE - User Stories

## Authentication/Profile Stories

### 1 - Anonymous Screening Session
Priority: Must
User Story:
    As a resident, I want to begin a screening session without creating an account so that I can quickly check my eligibility for benefits.
Acceptance Criteria
- User can start a screening session without registration
- User not required to provide a SSN
- System creates a temporary session
- User can begin answering questions upon entering
- Session works on mobile device

### 2 - Save and Resume Screening
Priority: Must
User Story:
    As a resident, I want to save my progress using a magic link or SMS code so that I can continue later without losing information.
Acceptance Criteria:
- User can request a link/code
- System securely generates a temporary token
- User can resume previous sessions
- Links can expire
- User does not need a password

### 3 - Update Language Preference
Priority: Should
User Story:
    As a multilingual user, I want to choose my preferred language so that I can understand the platform better.
Acceptance Criteria:
- User can switch between English and Spanish
- Selected language persists during the session
- Questions also update automatically
- Unsupported languages display fallback messages

### 4 - Optional Account Creation
Priority: Nice
User Story:
    As a resident, I want to optionally create an account so that I can manage multiple applications.
Acceptance Criteria:
- User can register using email or phone
- Existing sessions can be linked to a personal account
- User can log in/log out safely
- Creating an account is optional

## Core Eligibility/Screening
### 5 - Complete Screener
Priority: Must
User Story:
    As a resident, I want to answer simple questions so that I can discover what I qualify for.
Acceptance Criteria:
- Questionnaire with only ~10 plain-language questions
- Only one question per screen
- Progress indicator (percentage bar)
- Questions support branching logic
- Mobile-first design is responsive
- Accessible reading level

### 6 - Multi-Program Screening
Priority: Must
User Story:
    As a resident, I want one questionnaire to screen me for multiple programs so that I do not need to repeat the process.
Acceptance Criteria:
- Single questionnaire evaluates eligibility for multiple programs
- Programs include SNAP, WIC, Medicaid/CHIP, LIHEAP, rental assistance, and childcare subsidies
- Results display all eligible programs
- Eligibility rules are deterministic

### 7 - View Results
Priority: Must
User Story:
    As a resident, I want to see my likely eligible programs so I know which applications to complete.
Acceptance Criteria:
- Results categorize eligibility as: likely eligible, may be eligible, needs for information, and not eligible
- Each result includes descriptions of the program, next steps, and a link to the application
- Result are mobile-friendly

### 8 - Personalised Checklist
Priority: Must
User Story:
    As a resident, I want a personalized checklist of required documents so that I know what to prepare before applying.
Acceptance Criteria:
- Checklist is generated dynamically from screening answers
- Checklist updates when answers change
- Items include descriptions and examples
- Checklist supports multiple programs

### 9 - Upload Supporting Docs
Priority: Should
User Story:
    As a resident, I want to upload documents from my phone so that I can prepare my application materials online.
Acceptance Criteria:
- Accepts JPG, PNG, PDF, and HEIC uploads
- Uploads work on mobile devices
- Uploaded documents are securely stored
- User can delete uploaded documents
- OCR processing doesn't block any uploads

### 10 - Browse by Category
Priority: Should
User Story: 
    As a resident, I want to browse programs by category or life event so that I can discover assistance programs that I may not know about.
Acceptance Criteria:
- User can browse by category
- User can browse by life event
- Programs details include descriptions and links
- Search results support filtering

### 11 - Receive Community Referrals
Priority: Should
User Story:
    As a resident, I want referrals to local organizations so that I can get help beyond government-provided benefits.
Acceptance Criteria:
- Platform displays referral organizations/nonprofits
- Referral includes contact information
- Referrals support categories like housing, food, and legal assistance
- Users can request an in-person professional for help

### 12 - Manage Notifications
User Story:
    As a resident, I want to manage notifications so that I receive updates through my preferred method of communication.
Acceptance Criteria
- User can choose email or SMS
- User can opt in or out
- User can select preferred language
- User can control notification frequency

## AI Features
### 13 - Ask Questions with Chatbot
Priority: Must
User Story:
    As a resident, I want an AI chatbot to answer benefit questions so that I can better understand the process.
Acceptance Criteria:
- User can ask questions in plain language
- Chatbot provides responses with source citations
- Chatbot supports English and Spanish
- Chatbot offers human escalation
- Chatbot nevers makes official decisions about eligibility

### 14 - Smart Program Search
Priority: Should
User Story:
    As a resident, I want to search using natural language so that I can find relevant programs more easily
Acceptance Criteria:
- Seach supports natural language queries
- Search understands synonyms and related concepts
- Results ranked by relevance
- Search returns relevant related programs and services

### 15 - AI Document Classification
Priority: Should
User Story:
    As a resident, I want uploaded documents to be classified for me so I can avoid submitting incorrect files.
Acceptance Criteria:
- OCR extracts document text
- System predicts document type
- Users can correct incorrect classifications
- Classification will update the checklist automatically
- Classification confidence is logged by the AI

### 16 - AI Recommendations
Priority: Should
User Story: 
    As a resident, I want the system to recommend additional programs and resources so that I can maximise available support.
Acceptance Criteria:
- Recommendations are personalized
- Recommednations include related programs
- Recommendations include community resources
- Users can choose to ignore recommendations

### 17 - Anomaly Detection
Priority: Nice
User Story:
    As an administrator, I want the system to detect suspicious or unusual activity so that operational risks can be identified early.
Acceptance Criteria:
- System flags duplicate submissions
- System identifies abnormal upload behavior
- Administrators can review flagged events
- Flagging does not automatically block users

## Admin and Staff
### 18 - Caseworker Dashboard
Priority: Must
User Story:
    As a caseworker, I want to view pending sessions and referrals so that I can assist residents efficiently.
Acceptance Criteria:
- Dashboard displays pending cases
- Cases can be filtered according to status
- Cases can be assigned to staff members
- Dashboard supports mobile and desktop

### 20 - Manage Eligibility Rules
Priority: Should
User Story:
    As an administrator I want to manage and version eligibility rules so that programs policies remain accurate and auditable
Acceptance Criteria:
- Rules are version controlled
- Admin can publish new rule versions
- Previous rule versions remain accessible
- Rule changes are audit logged
- Rule updates do not require the application to be down
