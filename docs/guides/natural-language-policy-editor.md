# Natural-language policy editor

F-040 Phase 1 lets tenants describe a governance policy in plain English and convert it to Mimir's YAML policy format for review and save.

## How it works

1. The user types a description on the `/governance` page in **Natural language** mode.
2. The web app calls `POST /v1/governance/policy/translate`.
3. The backend tries a deterministic heuristic translator first.
4. If the heuristic cannot match the description and a model provider is configured, it falls back to an LLM prompt that returns YAML.
5. The returned YAML is validated with `PolicyEngine.parse()` before being returned.
6. The UI switches back to YAML mode, populates the editor, and lets the user review/edit before saving.

## Supported heuristic patterns

| Description pattern | Generated rule |
|---------------------|----------------|
| `Require approval for github.openPr` | `effect: require_approval` on `github.openPr` |
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
    "source": "rules:\n  - action: \"github.openPr\"\n    effect: require_approval\n    reason: requires human approval\n"
  }
}
```

If the description cannot be translated or the result is invalid YAML, the endpoint returns `400 INVALID_POLICY`.

## Source of truth

Translation is a drafting aid only. The tenant's active policy remains the YAML accepted by `PUT /v1/governance/policy`.

## Future work

Phase 2 may add richer NLU, example-driven rule generation, and one-click "save translated draft".
