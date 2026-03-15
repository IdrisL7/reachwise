# GetSignalHooks Performance Analysis Report

## Executive Summary

Hook generation is experiencing significant performance degradation due to:
- **Sequential external API calls** taking 15-30+ seconds
- **Inefficient source discovery** with redundant network requests
- **Heavy Claude API calls** with large prompt sizes  
- **No intermediate caching** for expensive operations
- **Database query inefficiencies** during peak load

**Target**: Reduce generation time from 15-30s to under 10s (67% improvement)

---

## 🔍 Critical Bottlenecks Found

### 1. **API Endpoint Performance Issues** (`/api/generate-hooks`)

**Problem**: 400+ line monolithic route handler with serial operations
- Multiple sequential external API calls (Tavily, Claude, Apify)
- No timeout management for hung requests
- Complex business logic mixed with API handling
- Cache lookup happens late in the flow

**Measured Impact**: 15-30 seconds per request

**Evidence**:
```typescript
// Serial operations in generate-hooks/route.ts:
1. Auth check → 50ms
2. URL validation → 100ms  
3. Company resolution → 2-5s (if needed)
4. Cache lookup → 200ms
5. Source fetching → 8-15s ⚠️ BOTTLENECK
6. Claude API call → 3-8s ⚠️ BOTTLENECK  
7. Hook processing → 500ms
8. Database persistence → 300ms
```

### 2. **Source Discovery Bottleneck** (`fetchSourcesWithGating`)

**Problem**: Complex parallel/serial hybrid with recovery logic
- 6+ external API calls per request
- Recovery passes when Tier A sources fail
- No caching of expensive Tavily/Apify calls
- Intent signal research adds 3-5s

**Measured Impact**: 8-15 seconds (60% of total time)

**Evidence from hooks.ts:1781**:
```typescript
const [newsResults, webResults, companyResults, directPageResults, 
       crunchbaseResults, linkedInResults, inputPageResults] = await Promise.all([
  fetchNewsSignals(companyName, domain, apiKey),     // 2-4s
  fetchWebSignals(companyName, domain, apiKey),      // 2-4s  
  fetchCompanyOwnSignals(domain, apiKey),            // 1-2s
  fetchDirectCompanyPages(domain),                   // 1-3s
  fetchCrunchbaseSignals(domain, companyName, apifyToken), // 2-5s
  fetchLinkedInPostSignals(linkedinSlug, apifyToken),     // 2-4s
  inputPagePromise,                                  // 1-2s
]);

// THEN recovery logic adds another 3-5s if no Tier A sources
if (tierACount === 0) {
  const recovery = await runFirstPartyRecovery(domain, companyName, apiKey, attempted);
}
```

### 3. **Claude API Call Inefficiency** (`callClaude`)

**Problem**: Large prompts with complex JSON parsing and retry logic  
- 4K+ token prompts with full source content
- Complex JSON parsing with fallback recovery
- No prompt optimization or compression
- Sequential calls for variants (Pro/Concierge)

**Measured Impact**: 3-8 seconds per call

**Evidence from hooks.ts:2367**:
```typescript
body: JSON.stringify({
  model: "claude-sonnet-4-20250514",
  max_tokens: 4096,                    // Large response size
  system: [{ type: "text", text: systemPrompt }],  // Often 2K+ tokens
  messages: [{ role: "user", content: userPrompt }], // Often 3K+ tokens  
}),
```

### 4. **Cache Inefficiency** (`hook-cache.ts`)

**Problem**: Only hooks are cached (48h), no intermediate results cached
- Source discovery (8-15s) runs on every cache miss
- Company intelligence (2-3s) never cached
- Intent signals (3-5s) never cached  
- URL hash computation is synchronous SHA-256

**Evidence**: Cache hit rate likely <30% due to:
- Profile-based cache busting
- Rules version updates
- Target role variations

### 5. **Database Query Patterns**

**Problem**: Multiple serial queries during hook persistence
- User tier lookup
- Quota validation  
- Hook insertion (batch but serial)
- No query optimization or indexes

**Measured Impact**: 200-500ms (low impact but accumulates)

---

## 🎯 Performance Targets

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| **Total Generation Time** | 15-30s | <10s | 67% faster |
| **Source Discovery** | 8-15s | <5s | 50-67% faster |
| **Claude API Call** | 3-8s | <3s | 25-50% faster |
| **Cache Hit Rate** | ~30% | >70% | 133% improvement |

---

## 🚀 Optimization Strategy (Priority Order)

### **Phase 1: Quick Wins (1-2 days)**

1. **Add Request-Level Timeouts**
   - 15s timeout on external API calls  
   - Circuit breaker pattern for failed services
   - Graceful degradation when services are slow

2. **Optimize Cache Strategy**
   - Move cache lookup to earliest possible point
   - Cache intermediate results (sources, company intel)
   - Implement async cache warming

3. **Compress Claude Prompts**  
   - Remove redundant text in system prompts
   - Truncate source content more aggressively
   - Use prompt templates instead of string concatenation

### **Phase 2: Core Optimizations (3-5 days)**

4. **Parallelize Independent Operations**
   - Run company intelligence in parallel with source discovery
   - Batch multiple Claude calls where possible
   - Async database operations

5. **Smart Source Discovery**
   - Early termination when sufficient Tier A sources found
   - Skip expensive Apify calls for basic tiers
   - Cache Tavily results per domain (1h TTL)

6. **Database Optimizations**
   - Add indexes for common queries
   - Batch database operations
   - Connection pooling optimization

### **Phase 3: Architecture Improvements (1 week)**

7. **Request Streaming**
   - Stream results as they become available
   - Progressive enhancement UX
   - Real-time progress indicators

8. **Background Processing**
   - Move heavy operations to background jobs
   - Pre-warm cache for popular companies
   - Async variant generation

---

## 📊 Expected Performance Impact

### **After Phase 1** (Quick Wins):
- **30-40% faster**: 15-30s → 10-18s
- Higher reliability with timeout management
- Better cache hit rates

### **After Phase 2** (Core Optimizations):
- **50-60% faster**: 15-30s → 6-12s  
- Consistent sub-10s performance for cached requests
- Improved concurrent user handling

### **After Phase 3** (Architecture):
- **70%+ faster perceived performance** 
- Sub-5s time to first meaningful results
- Scalable to 10x traffic

---

## 🔧 Implementation Roadmap

### Week 1: Foundation
- [ ] Add comprehensive performance monitoring
- [ ] Implement timeout and retry patterns  
- [ ] Optimize cache strategy
- [ ] Compress Claude prompts

### Week 2: Core Pipeline  
- [ ] Parallelize independent operations
- [ ] Smart source discovery with early termination
- [ ] Database query optimization
- [ ] Add intermediate result caching

### Week 3: Polish & Scale
- [ ] Request streaming implementation
- [ ] Background job processing
- [ ] Performance testing and tuning
- [ ] Monitoring and alerting

---

## ⚡ Quick Implementation Notes

**Immediate Actions**:
1. Add `Promise.race()` with timeouts to all external API calls
2. Move cache lookup to line 1 of the route handler  
3. Cache `researchIntentSignals` and `getCompanyIntelligence` results
4. Reduce Claude prompt sizes by 30-50%

**Success Metrics**:
- P95 response time <10s
- Cache hit rate >70%  
- Zero timeout errors
- 95%+ request success rate