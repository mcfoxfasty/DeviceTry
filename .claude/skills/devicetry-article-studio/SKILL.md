---
name: devicetry-article-studio
description: Create or improve a complete English DeviceTry article from an article name and a GitHub image URL. Research keyword opportunities, analyze ranking competitors, write evidence-backed content, integrate images and bidirectional internal links, cite reliable external sources, implement SEO metadata, and verify the finished preview.
---

# DeviceTry Article Studio

## Objective and inputs

Create articles that compete for relevant organic search traffic and guide visitors toward useful DeviceTry tools and related articles.

The user supplies only:
- Article name or topic.
- GitHub image URL.

Infer reasonable missing details from the existing project and research. Complete research, writing, assets, links, implementation, and available verification autonomously.

Ask only when an essential ambiguity cannot be resolved. Never invent research, metrics, sources, experience, test results, or successful verification. Never guarantee rankings.

Write public article content in English. Keep research notes and implementation reports outside the published article.

## 1. Inspect the project and content strategy

Read project instructions, site configuration, existing articles, article schema, renderer, image components, metadata generation, sitemap, and relevant tool implementations.

Reuse the existing website and article system. Preserve unrelated changes and working functionality. Do not introduce a CMS, dashboard, database, paid service, or new runtime API dependency for article production.

Maintain a concise private content-strategy reference:
- Business goals: relevant organic traffic, useful tool visits, topical trust, and the established monetization plan.
- Audience, problems, technical knowledge, and language.
- Three to six relevant content pillars.
- Suitable article types and topic clusters.
- Existing coverage and priority gaps.

Reuse this strategy across articles. Update it when evidence or project direction changes.

Infer the research market from the strategy. If unspecified, use global English readers with a disclosed US keyword-research baseline.

Check existing coverage. Improve an existing article when the requested topic duplicates its search intent. Preserve established URLs when updating.

## 2. Research keywords before writing

Treat the article name as a topic seed. Discover the wording readers actually search for.

Collect:
- Primary keyword candidates.
- Secondary keywords and natural variations.
- Long-tail searches and questions.
- Platform-specific searches.
- Related topics suitable for separate articles.

Attempt actual research using accessible Ahrefs, Semrush, Ubersuggest, Google Keyword Planner, Google autocomplete, People Also Ask, and other relevant available tools.

Use authorized accounts or supplied exports when available. Respect access limits and continue with accessible alternatives when blocked.

**Record every attempt, including the failures.** For each tool tried, state the outcome: the data obtained, or the specific barrier hit (HTTP status, login wall, rate limit, unreachable host, client-side-only rendering). A report that silently omits the tools that did not work is indistinguishable from a report where the research was never attempted. Where a free tool does work, use it properly and report its output as directional evidence rather than as volume metrics.

Reading an SEO tool's landing page is not keyword-data extraction.

For metrics, record source, country, period/date, and whether they are estimates. Never invent search volume, difficulty, traffic, CPC, or rankings.

Distinguish organic ranking difficulty from advertising competition. Do not treat different providers' difficulty scores as interchangeable.

Choose the target using relevance, intent, demand evidence, traffic potential, competition, site capabilities, and connection to existing tools and guides.

Do not choose solely by volume. Missing metrics do not mean zero demand.

## 3. Analyze ranking competitors

Retrieve the first ten organic Google results for the chosen query and market when accessible.

Record query, search source, country, date, and verified positions. Separate organic results from advertisements and other search features.

If exact Google results are unavailable, identify the actual search or SERP source used. Never label another engine's results as Google positions.

Open the pages. Read the leading three to five in depth and inspect the remaining accessible results.

Create a private competitor matrix:
- URL and verified position when available.
- Intent, audience, content type, format, and angle.
- Title, introduction, headings, and main answer.
- Shared subtopics and questions.
- Steps, examples, tables, screenshots, and diagrams.
- Sources, authorship, and evidence of experience.
- Strengths, omissions, outdated instructions, and confusing advice.
- Available traffic, backlink, and authority indicators.

Identify likely reasons for competitiveness. Separate observed facts from hypotheses about ranking causes.

**Competitors inform COVERAGE; they do not validate anything.** A page ranking for the query tells you which subtopics readers evidently still have to look for, so use the set to check your own outline for a gap. It does not tell you any of its claims are true, and copying an instruction because four sites agree is a popularity contest, not verification: a wrong step that ranks is still a wrong step, and repeating it makes the new article wrong in the same way. Treat every competitor instruction as a hypothesis to check against primary sources, and note the ones you deliberately reject.

Account for page and site strength when data is available. Do not assume article structure alone explains rankings.

Learn from successful coverage and presentation. Write independently without copying wording or mechanically reproducing competitor outlines.

## 4. Choose the angle and build the outline

Choose the format from observed search intent: tutorial, troubleshooting guide, explanation, checklist, comparison, buying guide, or another justified format.

Preserve the requested subject. Refine the title and angle when research supports a useful, realistic approach.

For a highly competitive broad topic, identify relevant specific searches within that topic and explain the decision.

Define:
- Reader's task and desired outcome.
- Essential coverage.
- Specific improvements over competitors.
- Original value DeviceTry can provide.

Build an evidence-based outline. Give each section a purpose, reader question, supporting evidence, and planned link or visual when appropriate.

Include definitions, steps, examples, common mistakes, resources, and FAQs when they help. Do not force every section type into every article.

Plan useful quotable answers, checklists, comparison tables, or original diagnostic diagrams. Never manufacture statistics or case studies.

Produce a concise research brief, then continue drafting without a routine approval pause.

## 5. Write the complete article

Use clear, practical English and answer the main question early.

The introduction should identify the problem, establish a credible outcome, and naturally include the main query when appropriate.

Use concise paragraphs, descriptive headings, numbered steps, and useful tables. Begin sections with direct answers when suitable.

Use the primary keyword naturally in the title, H1, introduction, and relevant headings. Include related wording without keyword stuffing.

Use one article H1 and logical H2/H3 hierarchy.

Determine length from the task and necessary coverage. Do not enforce a minimum word count or pad to match competitors.

For troubleshooting:
- Start with likely, simple, reversible checks.
- Branch by observable symptoms.
- State expected observations after important steps.
- Explain the next action if a step fails.
- Separate operating-system, browser, and application instructions.
- Provide a useful escalation path.

Verify technical instructions through current official documentation.

**Primary sources validate the instructions themselves.** For any step that tells a reader where to click, which value to enter, or which control exists, read the vendor's own documentation for the version being written about and confirm all three: that the path exists, that the control is conditional on hardware or version, and that the recommended value is the one the vendor states. A step that is merely plausible, or that a competitor publishes, has not been verified. Record the conditions a control depends on, and tell the reader what the absence of that control means rather than leaving them to guess.

**Every diagnostic conclusion must be supported by a source that describes the current product, and the OS/build it applies to must be checked explicitly.** Before asserting how a system behaves, confirm the behaviour in vendor documentation for that specific version. A behaviour that changed between major releases is the single most damaging error this skill can make, because the resulting article reads as authoritative and is wrong for the reader's machine. Where behaviour genuinely differs by version, say so explicitly and attribute each behaviour to its version rather than presenting the older or newer case as the normal one. Where no source supports a conclusion, either soften it to what the source does support or drop it.

Do not infer a cause from a correlation a reader can observe. A visible symptom, an on-screen artefact, and a successful test each have a bounded set of explanations. Say what the check rules out and what it cannot rule in, and avoid categorical fault assignments ("this proves it is X") unless a source states that directly. Avoid unmeasured superlatives such as "the most common cause" unless a measurement is cited.

**An observation guides the diagnosis; it does not prove one cause.** Write the branching so a reader can act on the reading without being told a verdict. State the symptom, the candidate explanations, and the cheapest next check that separates them. When a reader has already noticed something themselves — a fix that survives a restart, a headset that works on a second machine, a fault that began after an update — treat that as a lead that tells you where to look, and say so. Do not convert it into a verdict, and do not let it justify a large or destructive action: a correlation is not a cause, so timing alone is never grounds for undoing an update or reinstalling an operating system. Investigate what changed first, and prefer the smallest reversible step that targets the specific component that changed.

Distinguish measurements, user confirmations, possible causes, and unverified behavior.

For example, microphone input reaching DeviceTry proves that this page received a signal under its current settings. It does not prove another application is configured correctly or certify the hardware.

Verify tool behavior before making privacy or network claims. Do not claim all DeviceTry tools work offline.

For comparisons and buying guides, verify specifications and explain criteria, tradeoffs, suitable users, and limitations. Never invent hands-on testing.

Use the approved author identity or established site byline. Do not fabricate credentials, reviewers, testimonials, or experience.

Include useful FAQs without duplicating entire sections.

## 6. Add internal links in both directions

Inventory existing routes and read relevant pages before linking.

Add contextual links from the new article to:
- The relevant DeviceTry tool.
- Supporting guides.
- A suitable pillar or category page.
- Helpful next-step content.

Use descriptive, natural anchor text. Each link must help a reader take an action or understand a related issue.

For substantial articles, aim for roughly three to six useful contextual links when enough relevant destinations exist. This is a planning aid, not a quota.

**Related cards are not a substitute for contextual links.** The cards at the foot of an article are a directory of what else exists; they do not put a resource in front of the reader at the point the resource is needed. Add at least one contextual link inside the body of a troubleshooting or how-to article, attached to the specific step that calls for it, with anchor text naming the action it supports. Keep the cards as well.

Every linked destination must serve a reader action the article asks them to take. Remove a related-tool or related-guide entry whose only justification is topical adjacency.

Find existing guides that can naturally reference the new article. Add small contextual links from those pages to it, usually one to three suitable opportunities when available.

Preserve surrounding content and metadata. Avoid unrelated links, repetitive blocks, and site-wide exact-match anchors.

Include the article in the guide directory and existing related-content system. Ensure it is not orphaned.

Verify destinations, anchors, HTTP behavior, and crawlable links. Never invent future URLs. Record future content opportunities separately.

## 7. Add reliable external references

Support important technical claims with trustworthy sources, preferably official documentation.

Read each source and link to the relevant document or section near the associated statement.

**Links belong naturally inside the prose beside the claim they support.** Anchor the descriptive phrase that makes the claim, not a generic "source" or "learn more", and not the domain name. Do not collect citations into a standalone Sources list at the end of a section: a bibliography is read once at most, and a list sitting under a section reads as "these links cover everything above" — the vagueness that lets a claim drift away from its evidence. Extend the schema and renderer for inline links when the content format cannot express them, and add a test that fails the build if a declared link cannot be placed unambiguously, because a link that silently fails to render is worse than no link at all.

Use informative anchor text. Add a concise references section only where a section genuinely lists resources rather than making claims.

Use roughly two to five strong references when appropriate, adjusting to the claims rather than satisfying a quota.

Verify links and identify unverifiable destinations.

Do not automatically nofollow all editorial references. Apply appropriate attributes and disclosure to authorized sponsored, affiliate, or user-generated links.

Follow the site's existing accessible and secure convention for new-tab links.

Never invent affiliate URLs. Keep affiliate recommendations outside diagnostic tool controls.

## 8. Integrate the supplied image and useful visuals

Inspect the supplied GitHub image before using it.

Resolve GitHub file-view links to actual image assets when necessary. Never expose private credentials or access tokens.

Check relevance, dimensions, image quality, embedded text, and suitability for the article.

Use it as the lead image by default when appropriate. Preserve its content and reuse existing asset conventions, preferably a project-local optimized asset when supported.

Do not embed a GitHub HTML page as an image. Avoid fragile asset dependencies and unnecessary runtime image-processing services.

If the image is inaccessible, irrelevant, or misleading, identify the problem honestly.

Provide descriptive filenames, accurate alt text, intrinsic dimensions, responsive sizing, and useful captions. Use empty alt text for decorative images.

Add supporting visuals only where they clarify the task. Use up to three explanatory diagrams when useful; do not force a minimum number of images.

Use deterministic SVG or suitable existing tools for precise diagrams. Verify every label and branch against the article's claims.

**Before drawing any diagram of a system's internal behaviour, verify the exact version of that system the diagram describes, against official documentation for that version.** A diagram is a strong, glanceable claim: a reader who trusts it will not re-read the caveat in the prose. If the mechanism was reorganised between versions, a diagram drawn from the older model is not a simplification but a falsehood, and it will contradict the article's own text. Label version-specific behaviour in the diagram itself, and never depict a legacy interface as the current one.

Do not fabricate screenshots or present generated imagery as testing evidence.

Optimize assets using existing tooling and inspect the converted output. Lazy-load below-the-fold images and handle the lead image according to its loading role.

Check mobile readability, contrast in both themes, clipping, overlapping labels, and excessive empty space.

Never publish internal labels such as "diagram", "image prompt", placeholder instructions, or asset filenames as headings or captions.

## 9. Implement on-page and technical SEO

Use the current article schema and renderer.

Implement:
- Accurate, compelling, unique title.
- Unique meta description.
- Short descriptive slug.
- Correct production canonical from site configuration.
- Open Graph and social metadata.
- Appropriate image metadata.
- Accurate author and date fields.
- Table of contents when useful.
- Guide-directory and sitemap inclusion.
- Appropriate Article/BlogPosting and BreadcrumbList structured data.

Treat approximately 50–60 title characters and 140–160 description characters as editorial targets, not hard Google limits.

Structured data must describe visible, truthful content. Check current official documentation before recommending rich-result features.

Do not promise FAQ, HowTo, featured-snippet, or AI-search placement.

Preserve publication dates when updating. Change modification dates and sitemap lastmod only for meaningful changes.

Verify crawlable rendered content, canonical consistency, accidental noindex, image paths, and duplicate routes.

Reuse existing performance conventions. Reserve image space, avoid unnecessary scripts, and check mobile behavior.

Measure performance when tools are available. Never invent Core Web Vitals results.

## 10. Review and verify the finished page

Perform editorial, factual, SEO, linking, and visual reviews.

Verify:
- Search intent and chosen angle are satisfied.
- Necessary competitive coverage is included.
- The article adds useful original value.
- Important instructions have supporting evidence.
- Conclusions do not exceed what was observed.
- Internal links work in both directions where opportunities exist.
- External sources support nearby statements.
- Metadata and schema match the article.
- Images are relevant, optimized, accessible, and readable.
- Mobile and desktop layouts work in light and dark themes.
- No placeholders, internal notes, overlap, or horizontal overflow remain.

Run project checks appropriate to the changes using the existing package manager.

Inspect the rendered preview using browser tools when available. A successful build does not verify factual accuracy or visual quality.

Fix problems and repeat affected checks.

Report checks as PASS, FAIL, or NOT VERIFIED. Do not use an arbitrary SEO score as proof of readiness or ranking potential.

**An automated check is not a visual inspection.** Geometry, pixel, contrast, overflow, and layout assertions are evidence about structure; they do not establish that a page looks right, that an image depicts what its alt text claims, or that a diagram is comprehensible. Label any review that a human eye did not perform as NOT VERIFIED, and say plainly which checks were mechanical and which were visual. Screenshots produced by a script are artifacts, not a review.

Treat invented evidence, misleading diagrams, unsupported consequential instructions, and broken essential functionality as blockers.

Complete implementation and preview within scope. Follow current user and project authorization for commits, pushes, and deployment.

## 11. Promotion, measurement, and maintenance

Prepare a concise promotion handoff identifying suitable sharing channels, relevant communities, and genuinely link-worthy assets.

Prepare a short share summary when useful. Do not post externally, contact people, or create artificial backlinks without authorization.

Maintain articles using:
- Relevant software and product changes.
- Reader questions and unresolved issues.
- Actual Search Console queries, impressions, clicks, CTR, and positions when available.
- Content overlap and internal-link opportunities.

Suggest reviewing stable articles after three to six months, with earlier reviews for version-sensitive instructions. Do not create reminders unless requested.

Use actual performance data when updating. Never fabricate analytics or refresh dates merely to suggest freshness.

## Completion report

Provide:
1. Article title, route, and working preview.
2. Primary query, chosen angle, and keyword-data sources.
3. Competitor URLs analyzed and concrete improvements delivered.
4. Important factual sources and research limitations.
5. Internal links added, including incoming links.
6. External references and image assets.
7. PASS, FAIL, and NOT VERIFIED check results.
8. Remaining blockers, publication status, and next measurement step.

Keep the detailed research brief and evidence table outside public article content.