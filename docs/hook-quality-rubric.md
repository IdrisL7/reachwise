# Hook Quality Rubric

Use this rubric when reviewing generated hooks after each prompt or scoring change.

## Goal

A strong hook should feel like:
- a sharp SDR/operator noticed something real
- the message understands the buyer's actual pressure
- the hook creates tension, not just article summary

It should not feel like:
- an AI restating an article
- generic business commentary
- a templated sales line with the company name dropped in

## Scoring

Score each hook from `1-5` on each dimension.

### 1. Signal Use

`5`: Uses the signal specifically and naturally.  
`3`: Uses the signal, but in a slightly obvious or summary-like way.  
`1`: Could apply to many companies with minor edits.

### 2. Buyer Tension

`5`: Surfaces a real internal pressure for the target role.  
`3`: Mentions a plausible pain, but it feels generic.  
`1`: Mostly describes the article or company event.

### 3. Role Authenticity

`5`: Sounds like it was written for that role's world and vocabulary.  
`3`: Some role relevance, but broad or interchangeable.  
`1`: Could be sent to any executive.

### 4. Specificity

`5`: Includes concrete operating language, metrics, or workflow pressure.  
`3`: Some specifics, but still padded with abstractions.  
`1`: Mostly abstract filler.

### 5. Novelty

`5`: Feels fresh and sharp.  
`3`: Competent but familiar.  
`1`: Feels like common AI or SDR template phrasing.

### 6. Tension Over Summary

`5`: Leads with consequence, friction, or decision pressure.  
`3`: Mix of summary and tension.  
`1`: Mostly article-summary framing.

### 7. Promise Credibility

`5`: Promise is earned, grounded, and helps the hook.  
`3`: Promise is okay but slightly bolted on.  
`1`: Promise makes the hook feel synthetic or less credible.

## Automatic Fail Patterns

Mark the hook as failing even if some scores are decent when you see:

- `Saw your recent...`
- `Noticed your...`
- `That level of board scrutiny...`
- `Teams at this stage typically...`
- `Happy to show you what that looks like...`
- article-summary language without internal buyer consequence
- a role mismatch like product/fleet metrics being lazily mapped to VP Sales pain

## Review Output Format

Use this format during testing:

```text
Company:
Role:
Signal:

Hook 1:
Signal use:
Buyer tension:
Role authenticity:
Specificity:
Novelty:
Tension over summary:
Promise credibility:
Verdict:

What feels off:
```

## What Good Looks Like

Strong hooks usually do this:

- start from what changed, not from the article itself
- move quickly into operating pressure
- use buyer-native language
- ask a pointed question with real consequences behind it
- avoid sounding impressed by the company

## What To Improve Next

If hooks still sound generic, usually one of these is missing:

- stronger buyer pressure interpretation
- more concrete role vocabulary
- heavier penalties for AI-summary phrasing
- less reliance on generic promise sentences
