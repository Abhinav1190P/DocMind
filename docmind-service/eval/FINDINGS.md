# Eval Findings & Known Limitations

## Baseline vs. Re-ranking (2026-08-05)

| Metric | Without re-ranking | With re-ranking |
|---|---|---|
| Pass rate | 11/13 (85%) | 12/13 (92%) |
| Retrieval hit rate | 100% | 100% |
| Avg latency | ~1.6s | ~3.6s (first-run cross-encoder download inflates this; steady-state ~0.3-0.5s) |

**Change:** added a cross-encoder re-ranking step (`cross-encoder/ms-marco-MiniLM-L-6-v2`).
Vector search now retrieves 20 candidates (`TOP_K * 4`) instead of 5; the
cross-encoder scores each (query, chunk) pair directly and the top 5 re-ranked
chunks are sent to the LLM.

**Why this helped:** embedding similarity (used by vector search) compares
pre-computed vectors and can rank a topically-similar-but-wrong chunk above the
chunk that actually answers the question. A cross-encoder reads the query and
chunk together, which is slower but substantially more accurate at judging
"does this chunk actually answer this question" rather than just "is this
chunk about a similar topic."

**Concrete example (q5):** "What was Apple's total net sales for fiscal year
2023?" — before re-ranking, the top-3 retrieved chunks were all segment/category
breakdown tables (iPhone, Mac, Services net sales by segment), none containing
the actual aggregate figure. The sentence "The Company's total net sales were
$383.3 billion" existed elsewhere in the document but scored lower via plain
vector similarity. Re-ranking correctly surfaced it, and q5 flipped from FAIL to PASS.

## Known limitation: chunk-boundary fact loss (q4)

**Query:** "What optimizer did the Transformer paper use for training?"
**Expected:** Adam optimizer (explicitly stated in Section 5.3 of the paper)
**Result:** Still fails, even with re-ranking.

**Root cause:** the sentence containing "We used the Adam optimizer" sits at
the very end of Section 5.3, immediately before Section 5.4 begins. With the
current `CHUNK_SIZE=800` / `CHUNK_OVERLAP=150` config, this sentence did not
survive into *any* of the chunks that made it into the vector search candidate
pool (not even the wider 20-candidate pre-rerank set) for this specific query
wording. This means re-ranking can't fix it — a cross-encoder can only choose
among the candidates it's given; it can't retrieve something that was never in
the candidate pool in the first place.

Confirmed via direct inspection: all 3 retrieved chunks for this query had
**negative** cross-encoder scores (-1.2 to -2.1), meaning the re-ranker itself
correctly recognized none of them were good matches — this is not a case of
re-ranking making a bad choice, it's a case of vector search never surfacing
the right chunk to rank in the first place.

**Why this is a known, accepted limitation (not fixed) at this stage:**
- It affects one specific chunk-boundary edge case, not a systemic accuracy problem
- The rest of the eval set (12/13) passes cleanly, including other similarly
  specific factual lookups from the same document (BLEU scores, GPU/training
  time), showing this is a boundary artifact rather than a general retrieval
  weakness
- Two known fixes exist but weren't applied, to avoid re-tuning against a
  single held-out example (a form of overfitting to the eval set):
  1. Increase `CHUNK_OVERLAP` further, so section-boundary sentences appear
     in more than one chunk
  2. Widen the vector-search candidate pool
     (`RERANK_CANDIDATE_MULTIPLIER` in `retrieve.py`) so more chunks reach
     the re-ranker before the top-5 cut

## Takeaway for future iteration

A low-score threshold on the re-ranker's output (e.g., "if the best candidate's
cross-encoder score is below X, tell the user retrieval didn't find a strong
match rather than passing weak chunks to the LLM") is a natural next
improvement — the re-ranker already produces the signal needed for this
(negative scores clearly indicating poor matches), it just isn't acted on yet.