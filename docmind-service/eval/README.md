# DocMind Eval Harness

Measures retrieval and answer quality against a fixed question set with known
ground truth, so you can quantify whether changes (chunking, re-ranking,
hybrid search) actually help.

## Setup

Your 3 test docs (Transformer paper, Apple 10-K, RAG Wikipedia article) must
already be ingested under a consistent `userId` — the eval set assumes this.

```
pip install -r ../requirements.txt
```

## Run

Make sure the FastAPI service is running (`uvicorn app.main:app --port 8000`), then:

```
python run_eval.py --user-id abhinav_1
```

## What it measures

For each question:
- **retrieval_hit** — did the expected source file appear in the top 3 retrieved chunks?
- **answer_correct** — does the generated answer contain at least one expected keyword/phrase?
- **passed** — both of the above
- **latency_sec** — end-to-end time for that query
- **top_score** — similarity score of the top retrieved chunk

Categories in the eval set:
- `factual_single_doc` — straightforward fact lookup, tests core retrieval + generation
- `hallucination_guardrail` — questions with NO answer in the corpus; should be declined, not fabricated
- `cross_document` — requires pulling from multiple sources

## Interpreting results

- Low **retrieval_hit** but high **answer_correct** → the LLM might be answering
  from its own training knowledge instead of the retrieved context (bad — means
  your guardrails aren't tight enough, or the eval question is too "well-known"
  to test grounding properly)
- High **retrieval_hit** but low **answer_correct** → retrieval is fine, but
  generation/prompting needs work
- Low scores on `hallucination_guardrail` specifically → the system prompt
  needs to be more forceful about admitting "I don't know"

Results are saved to `eval_results.json` (full detail) after each run — diff
two runs to see exactly which questions flipped after a change.

## Extending

Add more questions to `eval_set.json` as you ingest more documents. Aim for
15-30 questions covering: easy facts, numeric lookups, questions requiring
synthesis across a paragraph, and adversarial "not in the docs" questions.
