# Nayya AI Architecture — Tiered LLM Strategy

## Overview

Nayya uses a tiered AI architecture to balance cost, accuracy, and latency. Each AI-powered feature follows a cascade: try the cheapest option first, escalate to more powerful (expensive) models only when needed.

## Tier Definitions

| Tier | Models | Cost/call | Use Case | Latency |
|------|--------|-----------|----------|---------|
| **Tier 0: Rules** | Regex, algorithms | Free | Known patterns, date math, dedup | <10ms |
| **Tier 1: Cheap LLM** | Amazon Nova Lite, Qwen3 32B | ~$0.0003 | Structured extraction, query rewrite, suggestions | ~700ms |
| **Tier 2: Smart LLM** | Claude Haiku, DeepSeek v3.2 | ~$0.002-0.005 | Complex parsing, ambiguous content, multi-step reasoning | ~1-2s |
| **Tier 3: External APIs** | Google Places, Textract, Weather | $0.015-0.032 | Real-world data (locations, OCR, weather) | ~200ms |

## Escalation Policy

```
Request → Tier 0 (rules)
  ├── Success (confidence > 90%) → Return result
  └── Fail/low confidence → Tier 1 (cheap LLM)
        ├── Success (all fields extracted) → Return result
        └── Fail/missing fields → Tier 2 (smart LLM)
              ├── Success → Return result
              └── Fail → Flag for user manual entry
```

**Configurable:** The escalation behavior (auto-escalate vs. stop at tier N) is set in the admin panel per feature.

## Feature → Tier Mapping

| Feature | Tier 0 | Tier 1 | Tier 2 | Tier 3 |
|---------|--------|--------|--------|--------|
| Email parsing | Regex templates | Nova Lite extraction | Haiku (complex) | — |
| Receipt scanning | — | Nova Lite (post-OCR) | Haiku (ambiguous) | Textract (OCR) |
| AI Search | — | Nova Lite (query rewrite + re-rank) | — | Google Places |
| Gap suggestions | Rule-based detection | Nova Lite (compose suggestion) | — | Google Places |
| Proactive suggestions | Rule-based triggers | Nova Lite (personalize) | — | Weather API |
| Trip auto-naming | — | Nova Lite | — | — |

## Model Configuration (Admin Panel)

```json
{
  "ai_config": {
    "email_parsing": {
      "tier1_model": "amazon.nova-lite-v1:0",
      "tier2_model": "anthropic.claude-3-5-haiku-20241022-v1:0",
      "auto_escalate": true,
      "max_tier": 2,
      "confidence_threshold": 0.9
    },
    "receipt_scanning": {
      "tier1_model": "amazon.nova-lite-v1:0",
      "tier2_model": "anthropic.claude-3-5-haiku-20241022-v1:0",
      "auto_escalate": true,
      "max_tier": 2
    },
    "search_rewrite": {
      "tier1_model": "amazon.nova-lite-v1:0",
      "auto_escalate": false,
      "max_tier": 1
    },
    "gap_suggestions": {
      "tier1_model": "amazon.nova-lite-v1:0",
      "auto_escalate": false,
      "max_tier": 1
    },
    "default_region": "eu-west-1",
    "fallback_region": "us-east-1"
  }
}
```

## Cost Projections

### Per 1,000 Active Users/Month

| Feature | Calls/user/mo | Cost/call | Monthly |
|---------|:---:|---:|---:|
| Email parsing | 30 | $0.001 avg | $30 |
| AI Search | 5 | $0.033 | $165 |
| Gap suggestions | 3 | $0.033 | $99 |
| Proactive suggestions | 10 | $0.001 | $10 |
| Receipt scanning | 5 | $0.017 | $85 |
| Trip naming | 2 | $0.0003 | $0.60 |
| **Total** | | | **~$390/mo** |

### Breakdown by Source

- Google Places API: ~$264/mo (68% of AI costs)
- LLM inference: ~$41/mo (11%)
- Textract: ~$85/mo (22%)

## Google Places Caching Strategy

- Cache key: `poi:{lat_2dp}:{lng_2dp}:{radius}:{category}`
- TTL: 24 hours (compliant with Google ToS — allows up to 30 days)
- Storage: Redis
- Attribution: "Powered by Google" shown on all POI results
- Effect: ~80% cache hit rate → reduces Google Places costs by 80%

**Effective cost with caching:** ~$264 × 0.2 = ~$53/mo for Google Places

## Proactive Suggestions

### Trigger Rules (Tier 0 — free)

| Trigger | Condition | Suggestion Type |
|---------|-----------|-----------------|
| Free time detected | 3+ hours gap between events on same day | Activity recommendations |
| Weather change | Delta >5°C or precip >30pp for trip <7 days away | Indoor alternatives |
| No dining planned | Trip day without restaurant/food booking | Restaurant suggestions |
| Arrival without activity | Flight/car arrives, no subsequent event that day | Welcome activities |
| Long transit | >2 hours between locations | Stop-off suggestions |

### Composition (Tier 1 LLM)

Each suggestion is composed by LLM with user preferences context:
```
System: You are a travel assistant. The user has these preferences: {interests}, {dietary}, {budget_level}
User: Suggest 3 {type} near {location} for {context}. Return as JSON array.
```

## Future Optimizations

1. **Batch inference** — Bedrock offers 50% discount for non-urgent batch processing (overnight email scans)
2. **Model switching** — When Qwen3/DeepSeek arrive in eu-west-1, swap Tier 1 for even lower cost
3. **Fine-tuned model** — After 10K+ parsed emails, fine-tune a small model on our specific extraction task
4. **Embedding cache** — Cache search query embeddings to skip re-computation for similar queries
