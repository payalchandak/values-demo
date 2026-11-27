"""Build src/study/data/opening.json: the Figure 1 case for the opening chapters.

Usage (from the repo root, after scripts/extract_data.py has run):

    python3 scripts/extract_opening.py --repo /path/to/value-prism

The case is located by vignette text, not by id. Everything else is read from
src/study/data/{cases,decisions}.json and the raw decision file in the
value-prism clone. Nothing is typed in by hand except the excerpt boundaries
below, and the script asserts each excerpt is a verbatim, contiguous slice of
the recorded response and under 60 words.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/study/data"

MODELS = {  # profile key -> id in the raw decision files
    "gpt": "openai/gpt-5.2",
    "claude": "anthropic/claude-opus-4.5",
    "gemini": "google/gemini-3-pro-preview",
}

# Figure 1 identification, from the task.
VIGNETTE_MARKERS = ["55-year-old man", "intentional self-poisoning", "anticoagulant rodenticide"]
CHOICE_1_MARKERS = ["72-hour involuntary psychiatric hold"]
CHOICE_2_MARKERS = ["discharge", "safety plan", "urgent follow-up"]

# Excerpt = contiguous slice of run 0's response text, from `start` through the
# end of `end`. `mark_*` bound the sentence stating the recommendation.
EXCERPTS = {
    "gpt": {
        "start": "**Recommend: Choice 1",
        "end": "based on the overall clinical picture:",
        "mark_start": "**Recommend: Choice 1",
        "mark_end": "for evaluation.**",
    },
    "claude": {
        "start": "## My Recommendation:",
        "end": "for the following reasons:",
        "mark_start": "## My Recommendation:",
        "mark_end": "psychiatric hold**",
    },
    "gemini": {
        "start": "Based on the clinical details provided",
        "end": "rationale for this decision:",
        "mark_start": "Based on the clinical details provided",
        "mark_end": "for evaluation.**",
    },
}
RUN_INDEX = 0
MAX_WORDS = 59  # "under 60 words"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True, type=Path)
    repo = ap.parse_args().repo

    cases = json.loads((DATA / "cases.json").read_text(encoding="utf-8"))
    decisions = json.loads((DATA / "decisions.json").read_text(encoding="utf-8"))

    hits = [
        c
        for c in cases
        if all(m in c["vignette"] for m in VIGNETTE_MARKERS)
        and all(m in c["choices"][0] for m in CHOICE_1_MARKERS)
        and all(m.lower() in c["choices"][1].lower() for m in CHOICE_2_MARKERS)
    ]
    assert len(hits) == 1, f"expected exactly one Figure 1 case, found {len(hits)}"
    case = hits[0]
    cid = case["id"]

    # Physician split, recomputed from the 25 individual votes.
    phys = [k for k in decisions if k.startswith("P")]
    assert len(phys) == 25
    votes1 = sum(decisions[p][cid]["choice1"] for p in phys)
    assert all(decisions[p][cid]["trials"] == 1 for p in phys)
    assert votes1 == case["physicianVotesChoice1"]
    split = {"choice1": votes1, "choice2": 25 - votes1, "total": 25}

    raw = json.loads((repo / "data/llm_decisions" / f"{cid}.json").read_text(encoding="utf-8"))
    assert raw["case"]["vignette"] == case["vignette"]
    assert [raw["case"]["choice_1"]["choice"], raw["case"]["choice_2"]["choice"]] == case["choices"]

    models = {}
    for key, source in MODELS.items():
        runs = raw["models"][source]["runs"]
        assert len(runs) == 10
        order = []
        for r in runs:
            assert r["parsed_choice"] in ("choice_1", "choice_2"), (key, r["parsed_choice"])
            order.append(1 if r["parsed_choice"] == "choice_1" else 2)
        assert order.count(1) == decisions[key][cid]["choice1"] == case["modelChoice1Counts"][key]

        text = runs[RUN_INDEX]["full_response"]["choices"][0]["message"]["content"]
        spec = EXCERPTS[key]
        a = text.index(spec["start"])
        b = text.index(spec["end"], a) + len(spec["end"])
        excerpt = text[a:b]
        assert excerpt == text[a:b] and excerpt in text
        words = len(excerpt.split())
        assert words <= MAX_WORDS, (key, words)
        m0 = excerpt.index(spec["mark_start"])
        m1 = excerpt.index(spec["mark_end"], m0) + len(spec["mark_end"])
        models[key] = {
            "source": source,
            "decisions": order,  # 1 = choice 1, 2 = choice 2, in recorded run order
            "choice1Count": order.count(1),
            "trials": len(order),
            "excerpt": {
                "runIndex": RUN_INDEX,
                "runChoice": order[RUN_INDEX],
                "wordCount": words,
                "text": excerpt,
                "recommendation": {"start": m0, "end": m1, "text": excerpt[m0:m1]},
            },
        }

    out = {
        "caseId": cid,
        "vignette": case["vignette"],
        "choices": case["choices"],
        "tags": case["tags"],
        "physicianSplit": split,
        "models": models,
    }
    (DATA / "opening.json").write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(cid, split, {k: (v["choice1Count"], v["trials"]) for k, v in models.items()})


if __name__ == "__main__":
    main()
