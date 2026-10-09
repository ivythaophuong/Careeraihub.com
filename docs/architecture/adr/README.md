# Architecture Decision Records

An ADR records one significant architecture decision: its context, the options considered, the decision, its consequences and its status.
Not every pull request needs one. Write an ADR when a decision changes a data contract, a module boundary, a trust or security rule,
the AI orchestration, or when a technical reason justifies splitting a service.

Status values: `proposed` · `accepted` · `superseded by ADR-NNNN` · `rejected`. A superseded ADR stays in the folder.

File name: `NNNN-short-title.md`. Template:

```markdown
# ADR-NNNN: <title>

Status: proposed | accepted | superseded by ADR-NNNN | rejected
Date: YYYY-MM-DD
Decided by: <role>

## Context
What problem or constraint forces a decision. Cite evidence (code, test, query, document), and mark anything unverified as UNKNOWN.

## Options considered
1. ...
2. ...

## Decision
What was decided, and what is explicitly not decided.

## Consequences
What changes, what it blocks, what must be tested, rollback.
```

## Index

None written yet. The product owner's decisions D1–D6 (2026-10-09, in `../PLATFORM_ARCHITECTURE.md` Appendix A) are recorded there as
direction. They should become ADRs only after the architecture baseline v1.0 is approved, one ADR per decision, with the wording the
owner confirms.
