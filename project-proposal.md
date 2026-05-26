PROJECT PROPOSAL:

THE PROBLEM
    Residents struggle to access benefits and other essential local-government services online because those services are fragmented and frequently inaccessible. The people who need benefits are also the people most likely to be digitally excluded. The research lists benefits by name as one of the services from which residents are excluded, alongside permits, voting information, and emergency information.

EVIDENCE
    - Benefits are named as an exclusion risk - ChatGPT's research covers "digital transactions such as permits, taxes, parking, and benefits," with a consequence of failure being exclusion from benefits
    - Accessibility defects are widespread - UK government monitoring found 29,787 accessibility issues across 1,203 public-sector websites and 21 apps between 2022 and 2024. In the US, the DOJ's 2024 Title II rule makes web and mobile accessibility an explicit operational requirement (WCAG 2.1 AA), with compliance dates extended to April 26, 2027 (populations 50,000+) and April 26, 2028 (smaller entities).
    - Residents are rarely involved in design - In ChatGPT's research, Welsh audits consistently found  councils digitizing services without clearly involving service users created documented risk that the results would fail to meet citizens' needs

THE USERS
    - Digitally excluded individuals - people who are older, low-income, or lack a digital presence. These are the same residents the report identifies as most as risk of exclusion from benefits and other essential services.
    - Disabled residents
    - Frontline/digital inclusion teams

THE SOLUTION
    The solution is a conversational web assistant that asks users questions, determines eligibility, explains required documents, and generates action plans. Critically, it pairs with assisted-digital support and an offline/cell phone fallback so that it extends access instead of replacing it.

AI ENHANCEMENT
    AI can be used to summarize dense requirements, answer questions, and extract information from policy PDFs. AI is also able to bridges fragmentation at the citizen level. Rather than waiting for systems to sync up, the AI assistant can simplify these services into a single plain-language platform.

    The assistant is built as a retrieval-augmented generation (RAG) system. It does not answer from the LLM's own general knowledge — every response is grounded in a curated, vetted knowledge base of program policies, application instructions, and authoritative sources, and each answer cites the passages it relied on. This keeps responses verifiable, up to date with current policy, and auditable.

    The report found 56% of local-government practitioners were concerned about public perception and trust in AI, and 69% about AI-generated misinformation affecting public policy. RAG with mandatory citation directly addresses these concerns, and the assistant must communicate clearly about its purpose and limitations.

WHY THIS ONE?
    This idea targest the row from the report's table of challenges with the highest prevalence and impact. The issue grounded in solid evidence, and solving it adds value without requiring full legacy replacement. It also doesn't seek to replace human capacity, simply to reduce redundancies and increase accessibility.