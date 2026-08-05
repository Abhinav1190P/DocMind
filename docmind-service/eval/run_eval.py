import json
import time
import requests
import argparse
from pathlib import Path
from typing import Optional

BASE_URL = "http://localhost:8000"
EVAL_SET_PATH = Path(__file__).parent / "eval_set.json"


def load_eval_set():
    with open(EVAL_SET_PATH) as f:
        return json.load(f)


def check_answer_contains(answer: str, expected_phrases: list) -> bool:
    answer_lower = answer.lower()
    return any(phrase.lower() in answer_lower for phrase in expected_phrases)


def check_retrieval_hit(sources: list, expected_file: Optional[str], top_k_check: int = 3) -> bool:
    if expected_file is None:
        return True
    top_sources = sources[:top_k_check]
    return any(s.get("fileName") == expected_file for s in top_sources)


def run_eval(user_id: str, verbose: bool = True, rerank: bool = True):
    eval_set = load_eval_set()
    results = []

    for item in eval_set:
        start = time.time()
        try:
            resp = requests.post(
                f"{BASE_URL}/query",
                params={"rerank": str(rerank).lower()},
                json={"query": item["query"], "userId": user_id, "history": []},
                timeout=60,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            print(f"[ERROR] {item['id']}: {e}")
            results.append({**item, "error": str(e), "passed": False, "latency_sec": 0})
            continue

        latency = time.time() - start
        answer = data.get("answer", "")
        sources = data.get("sources", [])

        answer_correct = check_answer_contains(answer, item["expected_answer_contains"])
        retrieval_hit = check_retrieval_hit(sources, item.get("expected_source_file"))
        passed = answer_correct and retrieval_hit

        top_score = sources[0]["score"] if sources else None

        result = {
            "id": item["id"],
            "query": item["query"],
            "category": item["category"],
            "answer": answer,
            "answer_correct": answer_correct,
            "retrieval_hit": retrieval_hit,
            "passed": passed,
            "latency_sec": round(latency, 2),
            "top_score": round(top_score, 4) if top_score else None,
        }
        results.append(result)

        if verbose:
            status = "PASS" if passed else "FAIL"
            print(f"[{status}] {item['id']} ({item['category']}) — {latency:.2f}s")
            if not passed:
                print(f"       query: {item['query']}")
                print(f"       answer: {answer[:150]}...")
                print(f"       answer_correct={answer_correct} retrieval_hit={retrieval_hit}")

    return results


def summarize(results):
    total = len(results)
    passed = sum(1 for r in results if r.get("passed"))
    answer_correct = sum(1 for r in results if r.get("answer_correct"))
    retrieval_hit = sum(1 for r in results if r.get("retrieval_hit"))
    avg_latency = sum(r.get("latency_sec", 0) for r in results) / total if total else 0

    by_category = {}
    for r in results:
        cat = r.get("category", "unknown")
        by_category.setdefault(cat, {"total": 0, "passed": 0})
        by_category[cat]["total"] += 1
        if r.get("passed"):
            by_category[cat]["passed"] += 1

    print("\n" + "=" * 50)
    print(f"Overall: {passed}/{total} passed ({100*passed/total:.0f}%)")
    print(f"Answer correctness: {answer_correct}/{total} ({100*answer_correct/total:.0f}%)")
    print(f"Retrieval hit rate: {retrieval_hit}/{total} ({100*retrieval_hit/total:.0f}%)")
    print(f"Avg latency: {avg_latency:.2f}s")
    print("\nBy category:")
    for cat, stats in by_category.items():
        print(f"  {cat}: {stats['passed']}/{stats['total']}")
    print("=" * 50)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--user-id", default="abhinav_1", help="userId to run eval against")
    parser.add_argument("--output", default="eval_results.json", help="where to save results")
    parser.add_argument("--no-rerank", action="store_true", help="disable reranker for this run")
    args = parser.parse_args()

    results = run_eval(args.user_id, rerank=not args.no_rerank)
    summarize(results)

    output_path = Path(__file__).parent / args.output
    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nSaved detailed results to {output_path}")
