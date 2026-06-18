# Natural-language policy editor

F-040 lets tenants describe a governance policy in plain English and convert it to Mimir's YAML policy format for review and save. Phase 2 adds fuzzy action matching, inline rule explanations, example-driven LLM fallback, and one-click save.

## How it works

1. The user types a description on the `/governance` page in **Natural language** mode.
2. The web app calls `POST /v1/governance/policy/translate`.
3. The backend tries a deterministic heuristic translator first.
   - Action names are fuzzy-matched against the connector registry, so `github.openpr` resolves to `github.openPr`.
4. If the heuristic cannot match the description and a model provider is configured, it falls back to an LLM prompt that includes built-in YAML examples.
5. The returned YAML is validated with `PolicyEngine.parse()` before being returned.
6. The response includes a human-readable explanation for each rule.
7. The UI switches back to YAML mode, shows the explanations, and lets the user review/edit before saving — or save immediately with **Translate & save draft**.

## Supported heuristic patterns

| Description pattern | Generated rule |
|---------------------|----------------|
| `Require approval for github.openPr` | `effect: require_approval` on `github.openPr` |
| `Require approval for github.openpr` | Fuzzy-matched to `github.openPr` |
| `Deny tier 2 actions` | `effect: deny` with `when.tier: 2` |
| `Deny when daily spend is greater than 5.00` | `effect: deny` with `when.dailySpendUsd: '> 5.00'` |
| `Deny all` / `Deny everything` | Catch-all `effect: deny` |
| `Allow everything else` / `Allow all` | Catch-all `effect: allow` |

Multiple sentences separated by periods or newlines are translated into multiple rules.

## API

Requires `governance:write`.

```http
POST /v1/governance/policy/translate
Content-Type: application/json

{
  "description": "Require approval for github.openPr"
}
```

Response:

```json
{
  "data": {
    "source": "rules:\n  - action: \"github.openPr\"\n    effect: require_approval\n    reason: requires human approval\n",
    "explanations": [
      "Require approval for github.openPr."
    ]
  }
}
```

If the description cannot be translated or the result is invalid YAML, the endpoint returns `400 INVALID_POLICY`.

## Source of truth

Translation is a drafting aid only. The tenant's active policy remains the YAML accepted by `PUT /v1/governance/policy`. **Translate & save draft** reuses the same active-policy upsert, so users still review the generated YAML before it becomes enforceable.

## Future work

- Richer NLU for conditionals (`less than`, `between`, `on weekends`).
- User-provided examples to steer the LLM fallback.
- Inline rule explanations with edit suggestions.
