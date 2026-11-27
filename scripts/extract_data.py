"""Extract the Value Prism benchmark into the JSON the study app reads.

Usage (from the repo root; needs numpy + statsmodels, e.g. the value-prism env):

    uv run --project /path/to/value-prism python scripts/extract_data.py \
        --repo /path/to/value-prism

Reads (from a clone of github.com/payalchandak/value-prism):
    data/benchmark/cases.csv            50 cases and their tags
    data/human_decisions/*.json         physicians P01-P25, one vote per case
    data/llm_decisions/*.json           12 models, ten runs per case

Writes to src/study/data/:
    cases.json      StudyCase[]  (src/study/types.ts)
    profiles.json   Profile[]    12 models, 25 physicians, 1 pooled physician
    decisions.json  raw choice-1 / trial counts per decision maker per case

Nothing here is hand-entered. Tags come from the CSV, votes and counts from
the decision files, weights from the binomial GLM described below.

Attribution model (value_prism src/valueprism/attribution.py):
    logit p_i = w_A d_iA + w_B d_iB + w_N d_iN + w_J d_iJ     (no intercept)
    d = tag(choice 1) - tag(choice 2), promotes=+1, neutral=0, violates=-1
    p_i = choice-1 share among non-missing runs, n_i = number of such runs
    (REFUSAL / INCOHERENT runs are dropped from both).
    priorities = softmax(w / T) with T = 0.262.
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

import numpy as np
import statsmodels.api as sm
from scipy.special import softmax

T_STAR = 0.262
VALUES = ["A", "B", "N", "J"]
# CSV header stem for each value letter.
CSV_STEM = {"A": "Autonomy", "B": "Beneficence", "N": "Nonmaleficence", "J": "Justice"}
TAG_SCORE = {"promotes": 1, "neutral": 0, "violates": -1}

# Profile metadata for the 12 models. Keys are short slugs; sourceVersion is the
# provider id exactly as it appears in the decision files. displayName drops the
# version number, per src/study/types.ts. family is by provider.
MODELS: dict[str, tuple[str, str, str]] = {
    # source id: (key, displayName, family)
    "openai/gpt-5.2": ("gpt", "GPT", "openai"),
    "anthropic/claude-opus-4.5": ("claude", "Claude", "anthropic"),
    "google/gemini-3-pro-preview": ("gemini", "Gemini", "google"),
    "qwen/qwen3-max": ("qwen", "Qwen", "other"),
    "deepseek/deepseek-chat": ("deepseek", "DeepSeek", "other"),
    "meta-llama/llama-4-maverick": ("llama", "Llama", "other"),
    "mistralai/mistral-large-2512": ("mistral", "Mistral", "other"),
    "moonshotai/kimi-k2-thinking": ("kimi", "Kimi", "other"),
    "x-ai/grok-4": ("grok", "Grok", "other"),
    "perplexity/sonar-pro": ("sonar", "Sonar", "other"),
    "z-ai/glm-4.6": ("glm", "GLM", "other"),
    "baidu/ernie-4.5-vl-424b-a47b": ("ernie", "Ernie", "other"),
}
POOLED_KEY = "physicians"


def load_cases(repo: Path) -> list[dict]:
    """Cases in CSV order, shaped as StudyCase minus the vote fields."""
    cases = []
    with (repo / "data" / "benchmark" / "cases.csv").open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            tags = []
            for c in ("C1", "C2"):
                tags.append({v: TAG_SCORE[row[f"{CSV_STEM[v]} {c}"]] for v in VALUES})
            cases.append(
                {
                    "id": row["Case ID"],
                    "vignette": row["Vignette"],
                    "choices": [row["Choice 1"], row["Choice 2"]],
                    "tags": tags,
                }
            )
    return cases


def parse_choice(parsed: str) -> int | None:
    if parsed == "choice_1":
        return 1
    if parsed == "choice_2":
        return 2
    if parsed in ("REFUSAL", "INCOHERENT"):
        return None
    raise ValueError(f"unexpected parsed_choice: {parsed}")


def load_decisions(repo: Path) -> dict[str, dict[str, dict[str, dict[str, int]]]]:
    """{group: {decision_maker: {case_id: {"choice1": k, "trials": n}}}}.

    `trials` counts non-missing runs only; `choice1` counts runs that picked
    choice 1. Physician ids are P01..P25 (the "human/" prefix is stripped).
    """
    out: dict[str, dict[str, dict[str, dict[str, int]]]] = {"model": {}, "physician": {}}
    for group, folder in (("physician", "human_decisions"), ("model", "llm_decisions")):
        for path in sorted((repo / "data" / folder).glob("*.json")):
            rec = json.loads(path.read_text(encoding="utf-8"))
            case_id = rec["case_id"]
            for maker, data in rec["models"].items():
                name = maker.removeprefix("human/") if group == "physician" else maker
                choices = [parse_choice(r["parsed_choice"]) for r in data["runs"]]
                answered = [c for c in choices if c is not None]
                out[group].setdefault(name, {})[case_id] = {
                    "choice1": sum(1 for c in answered if c == 1),
                    "trials": len(answered),
                }
    return out


def fit_weights(case_ids: list[str], delta: dict[str, list[int]], counts: dict[str, dict[str, int]]):
    """Binomial GLM, logit link, no intercept, freq_weights = trials."""
    ids = [c for c in case_ids if counts.get(c, {}).get("trials", 0) > 0]
    X = np.array([delta[c] for c in ids], dtype=np.float64)
    n = np.array([counts[c]["trials"] for c in ids], dtype=np.float64)
    p = np.array([counts[c]["choice1"] for c in ids], dtype=np.float64) / n
    family = sm.families.Binomial(link=sm.families.links.Logit())
    return np.asarray(sm.GLM(p, X, family=family, freq_weights=n).fit(disp=False).params)


def make_profile(key, kind, display, source_version, family, w) -> dict:
    prof = {"key": key, "kind": kind}
    if family is not None:
        prof["family"] = family
    prof["displayName"] = display
    if source_version is not None:
        prof["sourceVersion"] = source_version
    prof["weights"] = {v: float(w[i]) for i, v in enumerate(VALUES)}
    pri = softmax(w / T_STAR)
    prof["priorities"] = {v: float(pri[i]) for i, v in enumerate(VALUES)}
    return prof


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True, type=Path, help="clone of payalchandak/value-prism")
    ap.add_argument("--out", type=Path, default=Path(__file__).resolve().parents[1] / "src/study/data")
    args = ap.parse_args()
    repo, out = args.repo, args.out
    out.mkdir(parents=True, exist_ok=True)

    cases = load_cases(repo)
    case_ids = [c["id"] for c in cases]
    assert len(cases) == 50 and len(set(case_ids)) == 50
    delta = {c["id"]: [c["tags"][0][v] - c["tags"][1][v] for v in VALUES] for c in cases}

    dec = load_decisions(repo)
    assert len(dec["model"]) == 12 and set(dec["model"]) == set(MODELS), sorted(dec["model"])
    assert len(dec["physician"]) == 25
    for group in dec.values():
        for maker, per_case in group.items():
            assert set(per_case) == set(case_ids), maker

    # Keyed raw counts: profile key -> case id -> {choice1, trials}.
    decisions: dict[str, dict[str, dict[str, int]]] = {}
    profiles: list[dict] = []

    for source, (key, display, family) in MODELS.items():
        decisions[key] = {c: dec["model"][source][c] for c in case_ids}
        w = fit_weights(case_ids, delta, decisions[key])
        profiles.append(make_profile(key, "model", display, source, family, w))

    for pid in sorted(dec["physician"]):
        decisions[pid] = {c: dec["physician"][pid][c] for c in case_ids}
        w = fit_weights(case_ids, delta, decisions[pid])
        profiles.append(make_profile(pid, "physician", pid, None, None, w))

    pooled = {
        c: {
            "choice1": sum(dec["physician"][p][c]["choice1"] for p in dec["physician"]),
            "trials": sum(dec["physician"][p][c]["trials"] for p in dec["physician"]),
        }
        for c in case_ids
    }
    decisions[POOLED_KEY] = pooled
    w = fit_weights(case_ids, delta, pooled)
    profiles.append(make_profile(POOLED_KEY, "pooled-physician", "Pooled Physicians", None, None, w))

    # StudyCase: tags + physician votes + per-model choice-1 counts.
    study_cases = []
    for c in cases:
        cid = c["id"]
        study_cases.append(
            {
                **c,
                "physicianVotesChoice1": pooled[cid]["choice1"],
                "modelChoice1Counts": {k: decisions[k][cid]["choice1"] for _, (k, _, _) in MODELS.items()},
            }
        )

    def dump(name: str, obj) -> None:
        (out / name).write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    dump("cases.json", study_cases)
    dump("profiles.json", profiles)
    dump("decisions.json", decisions)
    print(f"wrote {len(study_cases)} cases, {len(profiles)} profiles, {len(decisions)} decision makers -> {out}")


if __name__ == "__main__":
    main()
