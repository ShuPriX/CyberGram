import type { ResourceLevel, ResourceType } from "../../lib/constants";
import type { RoadmapStep } from "../schema";

/**
 * Platform-authored reference content created on first boot: the official communities,
 * learning roadmaps and a curated list of free, reputable learning resources.
 * Everything here is real — there are no placeholder members, posts or job listings.
 */

const COMMUNITY_RULES = [
  "Share techniques for authorised testing, defence and education only.",
  "No stolen data, live credentials, or undisclosed vulnerabilities in systems you do not own.",
  "Disclose responsibly: give vendors a chance to fix before publishing details.",
  "No paid-course spam, referral links, or promises of guaranteed jobs.",
  "Be specific, cite sources, and be kind to people who are still learning.",
].join("\n");

export const SEED_COMMUNITIES = [
  { slug: "bug-bounty-hunters", name: "Bug Bounty Hunters", category: "bug-bounty", description: "Methodology, recon, report writing, triage experiences and disclosed findings from people who hunt." },
  { slug: "red-team", name: "Red Team Community", category: "red-teaming", description: "Adversary emulation, initial access, C2, evasion and lessons from authorised offensive operations." },
  { slug: "blue-team-soc", name: "Blue Team & SOC", category: "soc", description: "Detection engineering, alert triage, SIEM content, incident response and life in the SOC." },
  { slug: "cloud-security", name: "Cloud Security", category: "cloud-security", description: "Securing AWS, Azure, GCP and Kubernetes: identity, posture, workload protection and real incidents." },
  { slug: "application-security", name: "Application Security", category: "application-security", description: "Secure design, code review, threat modeling, SAST/DAST and building security into delivery." },
  { slug: "ai-security", name: "AI Security", category: "ai-security", description: "Prompt injection, model abuse, AI red teaming and securing systems that are built on ML." },
  { slug: "digital-forensics", name: "Digital Forensics", category: "digital-forensics", description: "Disk, memory and network forensics, tooling, casework and evidence handling." },
  { slug: "ctf-competitive-hacking", name: "CTF & Competitive Hacking", category: "ctf", description: "Write-ups, team recruiting, challenge design and upcoming competitions." },
  { slug: "cybersecurity-students", name: "Cybersecurity Students", category: "general", description: "Getting started, choosing a direction, projects, internships and honest career advice." },
  { slug: "security-researchers", name: "Security Researchers", category: "general", description: "Original research, CVEs, advisories, conference talks and the craft of finding new things." },
].map((c) => ({ ...c, rules: COMMUNITY_RULES }));

type SeedRoadmap = {
  slug: string;
  title: string;
  description: string;
  category: string;
  level: ResourceLevel;
  steps: RoadmapStep[];
};

export const SEED_ROADMAPS: SeedRoadmap[] = [
  {
    slug: "cybersecurity-foundations",
    title: "Cybersecurity Foundations",
    description: "The shared ground every security role stands on. Work through this before specialising — it makes everything after it faster.",
    category: "general",
    level: "beginner",
    steps: [
      {
        title: "Networking fundamentals",
        summary: "Understand how data actually moves: the TCP/IP model, DNS, HTTP, TLS, routing, NAT and common ports.",
        outcomes: ["Explain what happens when you open a URL, hop by hop", "Read a packet capture and identify the handshake, DNS lookup and request", "Subnet a /24 by hand"],
        skills: ["tcp-ip", "wireshark", "network-security"],
      },
      {
        title: "Operating systems and the command line",
        summary: "Get comfortable in Linux and Windows: users, permissions, processes, services, logs and the file system.",
        outcomes: ["Navigate, search and edit entirely from a Linux shell", "Explain file permissions, sudo and how services start", "Find authentication events in Linux and Windows logs"],
        skills: ["linux", "windows-internals", "bash"],
      },
      {
        title: "Scripting for automation",
        summary: "Learn enough Python and shell to automate repetitive work and read other people's tools.",
        outcomes: ["Write a script that parses a log file and summarises it", "Call a REST API and handle its JSON", "Read and modify a small open-source security tool"],
        skills: ["python", "bash", "powershell"],
      },
      {
        title: "Core security concepts",
        summary: "Confidentiality, integrity, availability; authentication vs authorisation; cryptography basics; threat, vulnerability and risk.",
        outcomes: ["Explain symmetric vs asymmetric encryption and where each is used", "Describe how password hashing differs from encryption", "Map a simple system's threats and controls"],
        skills: ["cryptography", "iam", "risk-assessment"],
      },
      {
        title: "Web and application basics",
        summary: "How web applications work and how they break: the OWASP Top 10, sessions, cookies and same-origin policy.",
        outcomes: ["Intercept and modify a request with a proxy", "Reproduce an injection and an access-control flaw in a lab", "Explain how each is prevented"],
        skills: ["owasp-top-10", "burp-suite", "web-app-pentesting"],
      },
      {
        title: "Practise in public and choose a direction",
        summary: "Solve beginner labs and CTF challenges, write up what you learned, then pick a specialisation that matches what you enjoyed.",
        outcomes: ["Publish three write-ups explaining your reasoning, not just the answer", "Build a small home lab", "Pick one specialised roadmap and commit to it"],
        skills: ["ctf"],
      },
    ],
  },
  {
    slug: "soc-analyst",
    title: "SOC Analyst (L1 → L2)",
    description: "From triaging your first alert to investigating incidents end to end and writing detections of your own.",
    category: "soc",
    level: "beginner",
    steps: [
      {
        title: "How a SOC works",
        summary: "Tiers, shifts, runbooks, escalation paths, SLAs and what good triage notes look like.",
        outcomes: ["Describe the lifecycle of an alert from firing to closure", "Write a triage note another analyst can act on without asking you questions"],
        skills: ["alert-triage", "incident-response"],
      },
      {
        title: "Logs and telemetry",
        summary: "Windows event logs, Sysmon, Linux auth logs, proxy, DNS, firewall and cloud audit trails — what each can and cannot tell you.",
        outcomes: ["Name the event IDs for logon, process creation and service install", "Reconstruct a user's session from raw logs"],
        skills: ["log-analysis", "windows-internals", "linux"],
      },
      {
        title: "SIEM querying",
        summary: "Search, filter, aggregate and correlate in at least one SIEM query language.",
        outcomes: ["Write queries that pivot from an IP to a host to a user", "Build a dashboard that answers one real question"],
        skills: ["siem", "splunk", "elastic-security", "microsoft-sentinel"],
      },
      {
        title: "Attacker behaviour",
        summary: "Use MITRE ATT&CK to recognise techniques in telemetry: phishing, credential access, lateral movement, persistence, exfiltration.",
        outcomes: ["Map an incident report to ATT&CK techniques", "Explain which log source would reveal each technique"],
        skills: ["mitre-attack", "threat-hunting"],
      },
      {
        title: "Investigation and response",
        summary: "Scope an incident, contain it, collect evidence and write the report. Practise on public incident datasets.",
        outcomes: ["Investigate a phishing-to-compromise scenario end to end", "Produce a timeline and a short executive summary"],
        skills: ["incident-response", "edr", "digital-forensics"],
      },
      {
        title: "Detection engineering",
        summary: "Turn what you learned into detections: Sigma rules, tuning, false-positive analysis and testing with simulated attacks.",
        outcomes: ["Write and test a Sigma rule for a technique you investigated", "Measure and reduce its false positives"],
        skills: ["detection-engineering", "sigma", "soar"],
      },
    ],
  },
  {
    slug: "web-application-pentesting",
    title: "Web Application Penetration Testing",
    description: "A practical path from understanding HTTP to delivering a professional web assessment and report.",
    category: "vapt",
    level: "intermediate",
    steps: [
      {
        title: "HTTP and the browser security model",
        summary: "Requests, responses, headers, cookies, sessions, CORS, the same-origin policy and how modern front-ends talk to APIs.",
        outcomes: ["Explain SameSite, HttpOnly and Secure and what each prevents", "Describe a CORS misconfiguration and its impact"],
        skills: ["web-app-pentesting", "burp-suite"],
      },
      {
        title: "Recon and mapping",
        summary: "Enumerate content, parameters, roles and trust boundaries before you test anything.",
        outcomes: ["Produce a map of an application's endpoints, roles and data flows", "Identify the highest-value targets and justify the order you will test them in"],
        skills: ["nmap", "osint"],
      },
      {
        title: "Injection and server-side flaws",
        summary: "SQL injection, command injection, SSRF, SSTI, deserialisation, path traversal and file-upload issues.",
        outcomes: ["Exploit each class in a lab and explain the root cause", "Recommend a fix a developer can implement"],
        skills: ["owasp-top-10", "web-exploitation"],
      },
      {
        title: "Access control and business logic",
        summary: "IDOR, privilege escalation, multi-step workflow abuse, race conditions — the flaws scanners do not find.",
        outcomes: ["Test every function as every role", "Find and demonstrate a logic flaw with real business impact"],
        skills: ["api-security-testing", "web-app-pentesting"],
      },
      {
        title: "Client-side and authentication",
        summary: "XSS, CSRF, clickjacking, OAuth and OIDC mistakes, JWT handling, password reset and MFA bypasses.",
        outcomes: ["Chain a client-side flaw into account takeover in a lab", "Review an OAuth flow for common implementation errors"],
        skills: ["oauth-oidc", "web-exploitation"],
      },
      {
        title: "Reporting and retesting",
        summary: "Findings are only useful if they get fixed. Write clear reproduction steps, rate severity honestly, and verify remediation.",
        outcomes: ["Write a finding with impact, reproduction, evidence and remediation", "Score it with CVSS and defend the score", "Retest and confirm the fix"],
        skills: ["secure-code-review", "vulnerability-management"],
      },
    ],
  },
  {
    slug: "cloud-security-engineer",
    title: "Cloud Security Engineer",
    description: "Secure real cloud environments: identity first, then network, data, workloads and detection.",
    category: "cloud-security",
    level: "intermediate",
    steps: [
      {
        title: "Cloud fundamentals and the shared responsibility model",
        summary: "Core compute, storage, network and identity services in one major provider, and exactly where your responsibility begins.",
        outcomes: ["Deploy a small multi-tier application from scratch", "State who is responsible for each layer of it"],
        skills: ["aws-security", "azure-security", "gcp-security"],
      },
      {
        title: "Identity and access management",
        summary: "Most cloud breaches are identity breaches. Roles, policies, federation, least privilege and privilege-escalation paths.",
        outcomes: ["Write a least-privilege policy and prove it with a policy simulator", "Find a privilege-escalation path in a deliberately vulnerable account"],
        skills: ["iam", "zero-trust"],
      },
      {
        title: "Network and data protection",
        summary: "Segmentation, private connectivity, security groups, encryption at rest and in transit, key management and secrets.",
        outcomes: ["Design a network with no public data stores", "Rotate a key and a secret without downtime"],
        skills: ["network-security", "secrets-management", "cryptography"],
      },
      {
        title: "Infrastructure as code and posture management",
        summary: "Define infrastructure in code, scan it before deployment, and continuously detect drift and misconfiguration.",
        outcomes: ["Block a misconfigured resource in CI before it deploys", "Triage CSPM findings by real exploitability"],
        skills: ["terraform", "iac-security", "cspm"],
      },
      {
        title: "Containers and Kubernetes",
        summary: "Image hygiene, runtime security, RBAC, network policy, admission control and secrets in clusters.",
        outcomes: ["Harden a cluster against a known attack path", "Detect a container escape attempt in a lab"],
        skills: ["kubernetes-security", "container-security"],
      },
      {
        title: "Logging, detection and response",
        summary: "Enable the right audit logs, centralise them, detect suspicious activity and practise responding to a compromised credential.",
        outcomes: ["Write detections for three cloud attack techniques", "Run a tabletop for a leaked access key and document the response"],
        skills: ["detection-engineering", "incident-response", "log-analysis"],
      },
    ],
  },
  {
    slug: "application-security-devsecops",
    title: "Application Security & DevSecOps",
    description: "Help engineering teams ship secure software by building security into design, code and the pipeline.",
    category: "application-security",
    level: "intermediate",
    steps: [
      {
        title: "Software engineering fluency",
        summary: "You cannot secure what you cannot read. Be productive in at least one backend language, Git and a typical delivery workflow.",
        outcomes: ["Build and deploy a small service with tests", "Review a pull request and give useful feedback"],
        skills: ["python", "javascript", "go"],
      },
      {
        title: "Threat modeling and secure design",
        summary: "Find design flaws before code exists: data-flow diagrams, trust boundaries, STRIDE and abuse cases.",
        outcomes: ["Run a threat-modeling session for a real feature", "Turn the output into prioritised, trackable requirements"],
        skills: ["threat-modeling", "secure-sdlc"],
      },
      {
        title: "Secure code review",
        summary: "Read code for vulnerability classes: injection, authn/authz, cryptographic misuse, unsafe deserialisation, SSRF.",
        outcomes: ["Find and fix seeded vulnerabilities in an unfamiliar codebase", "Write a custom static-analysis rule for a pattern you found"],
        skills: ["secure-code-review", "sast", "owasp-top-10"],
      },
      {
        title: "Pipeline security",
        summary: "SAST, SCA, secret scanning, IaC scanning and DAST — integrated so that they help developers instead of blocking them.",
        outcomes: ["Add scanning to a CI pipeline with sensible gates", "Cut the noise: tune one tool until its findings are trusted"],
        skills: ["ci-cd-security", "sca", "dast", "secrets-management"],
      },
      {
        title: "Supply chain and dependencies",
        summary: "SBOMs, dependency pinning, provenance, build integrity and responding to a vulnerable or malicious package.",
        outcomes: ["Generate an SBOM and answer “are we affected?” for a new CVE in minutes", "Harden a build against dependency confusion"],
        skills: ["supply-chain-security", "sca"],
      },
      {
        title: "Programme building",
        summary: "Security champions, paved roads, metrics that matter, vulnerability management and working with — not against — engineering.",
        outcomes: ["Define three metrics that reflect real risk reduction", "Ship one paved-road default that removes a whole class of bug"],
        skills: ["vulnerability-management", "secure-sdlc"],
      },
    ],
  },
  {
    slug: "digital-forensics-incident-response",
    title: "Digital Forensics & Incident Response",
    description: "Collect and analyse evidence soundly, reconstruct what an attacker did, and help the organisation recover.",
    category: "digital-forensics",
    level: "intermediate",
    steps: [
      {
        title: "Forensic principles",
        summary: "Order of volatility, chain of custody, write blocking, hashing and documentation that stands up to scrutiny.",
        outcomes: ["Acquire an image and prove its integrity", "Keep contemporaneous notes another examiner could follow"],
        skills: ["digital-forensics"],
      },
      {
        title: "Disk and file-system analysis",
        summary: "NTFS and ext4 internals, timelines, deleted data, and the Windows artefacts that record execution and access.",
        outcomes: ["Build a super-timeline and extract the story from it", "Show evidence of execution from three independent artefacts"],
        skills: ["disk-forensics", "autopsy", "windows-internals"],
      },
      {
        title: "Memory forensics",
        summary: "Acquire memory and find what never touched disk: injected code, credentials, network connections and rootkits.",
        outcomes: ["Identify a malicious process and its injected regions in a memory image", "Recover indicators you can hunt for elsewhere"],
        skills: ["memory-forensics", "volatility"],
      },
      {
        title: "Network and log analysis",
        summary: "Reconstruct sessions from packet captures and correlate host, network and cloud logs into a single timeline.",
        outcomes: ["Extract transferred files and C2 patterns from a capture", "Correlate three log sources into one incident timeline"],
        skills: ["wireshark", "log-analysis"],
      },
      {
        title: "Malware triage",
        summary: "Safely determine what a sample does: static properties, sandbox behaviour, and enough reverse engineering to extract indicators.",
        outcomes: ["Triage an unknown sample and write detection content for it", "Explain its persistence and communication"],
        skills: ["malware-analysis", "sandbox-analysis", "yara"],
      },
      {
        title: "Incident response and reporting",
        summary: "Scoping, containment, eradication, recovery and a report that leadership and engineers can both act on.",
        outcomes: ["Lead a simulated incident from detection to lessons learned", "Write a report with a clear timeline, root cause and recommendations"],
        skills: ["incident-response", "threat-hunting"],
      },
    ],
  },
];

type SeedResource = {
  title: string;
  url: string;
  description: string;
  type: ResourceType;
  category: string;
  level: ResourceLevel;
};

/** Free, widely trusted references. Paid courses are deliberately not listed here. */
export const SEED_RESOURCES: SeedResource[] = [
  { title: "PortSwigger Web Security Academy", url: "https://portswigger.net/web-security", description: "Free, hands-on labs covering every major web vulnerability class, from apprentice to expert.", type: "lab", category: "vapt", level: "beginner" },
  { title: "OWASP Top 10", url: "https://owasp.org/www-project-top-ten/", description: "The standard awareness document for the most critical web application security risks.", type: "guide", category: "application-security", level: "beginner" },
  { title: "OWASP Web Security Testing Guide", url: "https://owasp.org/www-project-web-security-testing-guide/", description: "A comprehensive methodology for testing web applications, test case by test case.", type: "guide", category: "vapt", level: "intermediate" },
  { title: "OWASP Cheat Sheet Series", url: "https://cheatsheetseries.owasp.org/", description: "Concise, practical guidance on implementing specific security controls correctly.", type: "cheatsheet", category: "application-security", level: "intermediate" },
  { title: "OWASP Application Security Verification Standard", url: "https://owasp.org/www-project-application-security-verification-standard/", description: "A catalogue of security requirements for designing, building and verifying applications.", type: "guide", category: "application-security", level: "advanced" },
  { title: "OWASP Juice Shop", url: "https://owasp.org/www-project-juice-shop/", description: "A deliberately insecure modern web application for practising on your own machine.", type: "lab", category: "application-security", level: "beginner" },
  { title: "MITRE ATT&CK", url: "https://attack.mitre.org/", description: "The knowledge base of adversary tactics and techniques used across detection, hunting and red teaming.", type: "guide", category: "threat-intelligence", level: "intermediate" },
  { title: "MITRE D3FEND", url: "https://d3fend.mitre.org/", description: "A knowledge graph of defensive countermeasures mapped to the techniques they address.", type: "guide", category: "blue-teaming", level: "intermediate" },
  { title: "MITRE ATLAS", url: "https://atlas.mitre.org/", description: "Adversary tactics and case studies for attacks on AI and machine-learning systems.", type: "guide", category: "ai-security", level: "intermediate" },
  { title: "OWASP Top 10 for LLM Applications", url: "https://owasp.org/www-project-top-10-for-large-language-model-applications/", description: "The most critical risks when building applications on large language models.", type: "guide", category: "ai-security", level: "beginner" },
  { title: "NIST Cybersecurity Framework", url: "https://www.nist.gov/cyberframework", description: "A widely adopted framework for organising and communicating cybersecurity risk management.", type: "guide", category: "grc", level: "beginner" },
  { title: "CIS Benchmarks", url: "https://www.cisecurity.org/cis-benchmarks", description: "Consensus-based secure configuration guidelines for operating systems, cloud and software.", type: "guide", category: "grc", level: "intermediate" },
  { title: "CISA Known Exploited Vulnerabilities Catalog", url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog", description: "Vulnerabilities confirmed to be exploited in the wild — a practical input for patch prioritisation.", type: "guide", category: "threat-intelligence", level: "intermediate" },
  { title: "National Vulnerability Database", url: "https://nvd.nist.gov/", description: "The U.S. government repository of CVE records, severity scores and affected products.", type: "tool", category: "general", level: "beginner" },
  { title: "FIRST CVSS", url: "https://www.first.org/cvss/", description: "The specification, calculator and user guide for the Common Vulnerability Scoring System.", type: "guide", category: "general", level: "beginner" },
  { title: "picoCTF", url: "https://picoctf.org/", description: "A free, beginner-friendly CTF platform with year-round practice challenges.", type: "lab", category: "ctf", level: "beginner" },
  { title: "OverTheWire Wargames", url: "https://overthewire.org/wargames/", description: "Classic wargames that teach Linux and security fundamentals one level at a time.", type: "lab", category: "ctf", level: "beginner" },
  { title: "pwn.college", url: "https://pwn.college/", description: "A free, structured curriculum for binary exploitation and systems security.", type: "course", category: "ctf", level: "intermediate" },
  { title: "CryptoHack", url: "https://cryptohack.org/", description: "Learn modern cryptography by breaking it, through interactive challenges.", type: "lab", category: "ctf", level: "intermediate" },
  { title: "CTFtime", url: "https://ctftime.org/", description: "The community calendar, team rankings and write-up archive for CTF competitions worldwide.", type: "tool", category: "ctf", level: "beginner" },
  { title: "Sigma detection rules", url: "https://github.com/SigmaHQ/sigma", description: "The open, vendor-neutral rule format for SIEM detections, with thousands of community rules.", type: "tool", category: "soc", level: "intermediate" },
  { title: "The DFIR Report", url: "https://thedfirreport.com/", description: "Detailed, real-world intrusion case studies with timelines, artefacts and detections.", type: "blog", category: "digital-forensics", level: "intermediate" },
  { title: "Malware Traffic Analysis", url: "https://www.malware-traffic-analysis.net/", description: "Packet captures and exercises for practising network forensics on real malware traffic.", type: "lab", category: "malware-analysis", level: "intermediate" },
  { title: "SANS Internet Storm Center", url: "https://isc.sans.edu/", description: "Daily handler diaries on current threats, scanning activity and incident analysis.", type: "blog", category: "threat-intelligence", level: "intermediate" },
  { title: "GTFOBins", url: "https://gtfobins.github.io/", description: "Unix binaries that can be abused to bypass local security restrictions — and what to watch for.", type: "cheatsheet", category: "red-teaming", level: "intermediate" },
  { title: "LOLBAS", url: "https://lolbas-project.github.io/", description: "Windows binaries, scripts and libraries that attackers use to live off the land.", type: "cheatsheet", category: "red-teaming", level: "intermediate" },
  { title: "PayloadsAllTheThings", url: "https://github.com/swisskyrepo/PayloadsAllTheThings", description: "A reference of payloads and bypass techniques for authorised web security testing.", type: "cheatsheet", category: "vapt", level: "intermediate" },
  { title: "CloudGoat", url: "https://github.com/RhinoSecurityLabs/cloudgoat", description: "A “vulnerable by design” AWS deployment tool for practising cloud attack paths in your own account.", type: "lab", category: "cloud-security", level: "intermediate" },
  { title: "Kubernetes Goat", url: "https://github.com/madhuakula/kubernetes-goat", description: "An intentionally vulnerable cluster environment for learning Kubernetes security.", type: "lab", category: "cloud-security", level: "intermediate" },
  { title: "OSINT Framework", url: "https://osintframework.com/", description: "A categorised directory of free open-source intelligence tools and resources.", type: "tool", category: "osint", level: "beginner" },
  { title: "Nmap Network Scanning", url: "https://nmap.org/book/", description: "The official guide to network discovery and security scanning, free to read online.", type: "book", category: "networking", level: "beginner" },
  { title: "Wireshark sample captures", url: "https://wiki.wireshark.org/SampleCaptures", description: "A large collection of capture files for learning protocols and practising analysis.", type: "lab", category: "networking", level: "beginner" },
];
