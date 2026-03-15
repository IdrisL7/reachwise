# GetSignalHooks Performance Optimization Implementation Guide

## 🎯 Implementation Overview

This guide covers implementing the **Phase 1 performance optimizations** that target a **50-67% performance improvement** (from 15-30s to 6-12s average response time).

## 📋 Pre-Implementation Checklist

### Prerequisites
- [ ] Node.js environment with TypeScript support
- [ ] Database schema supports existing `hookCache` table
- [ ] Environment variables set: `TAVILY_API_KEY`, `CLAUDE_API_KEY`, `APIFY_API_TOKEN`
- [ ] Backup current production deployment

### Files Created/Modified
- [ ] **NEW**: `src/lib/performance-utils.ts` - Timeout & circuit breaker utilities
- [ ] **NEW**: `src/lib/enhanced-cache.ts` - Multi-level caching system  
- [ ] **NEW**: `src/lib/optimized-claude.ts` - Compressed prompts & better error handling
- [ ] **NEW**: `src/app/api/generate-hooks-optimized/route.ts` - Optimized API endpoint
- [ ] **NEW**: `scripts/performance-test.js` - Performance testing script

## 🚀 Implementation Steps

### Step 1: Install New Dependencies (if needed)

No additional dependencies required - optimizations use existing Node.js APIs and libraries.

### Step 2: Deploy New Utility Modules

Copy the following files to your project:

```bash
# Performance utilities
cp src/lib/performance-utils.ts /home/idris/reachwise/src/lib/

# Enhanced caching  
cp src/lib/enhanced-cache.ts /home/idris/reachwise/src/lib/

# Optimized Claude integration
cp src/lib/optimized-claude.ts /home/idris/reachwise/src/lib/
```

### Step 3: Deploy Optimized API Endpoint

```bash
# New optimized endpoint (run in parallel with existing)
cp src/app/api/generate-hooks-optimized/route.ts /home/idris/reachwise/src/app/api/generate-hooks-optimized/
```

### Step 4: Test the Optimized Endpoint

```bash
# Make script executable
chmod +x scripts/performance-test.js

# Run performance comparison (requires running dev server)
cd /home/idris/reachwise
npm run dev &
DEV_PID=$!

# Wait for server to start
sleep 5

# Run tests
node scripts/performance-test.js

# Stop dev server
kill $DEV_PID
```

### Step 5: Gradual Migration Strategy

#### Option A: Blue/Green Deployment (Recommended)
1. Deploy optimized endpoint alongside existing one
2. Route 10% of traffic to `/api/generate-hooks-optimized`
3. Monitor performance metrics for 24 hours
4. If successful, route 50% of traffic
5. After 48 hours, route 100% and remove old endpoint

#### Option B: Feature Flag Approach  
1. Add environment variable `USE_OPTIMIZED_HOOKS=true`
2. Modify existing endpoint to conditionally use optimized functions
3. Enable for development/staging first
4. Enable for production after validation

#### Option C: Direct Replacement (Higher Risk)
1. Backup existing `generate-hooks/route.ts`
2. Replace with optimized version
3. Deploy and monitor closely

## 📊 Success Metrics

### Primary Targets
- [ ] **Average Response Time**: <10 seconds (from 15-30s)
- [ ] **P95 Response Time**: <15 seconds
- [ ] **Cache Hit Rate**: >70%
- [ ] **Success Rate**: >95%

### Monitoring Points
- Response time percentiles (P50, P90, P95)
- Cache hit/miss rates  
- External API timeout rates
- Error rates by operation type
- Memory usage of cache system

### Expected Improvements by Component

| Component | Current | Target | Improvement |
|-----------|---------|--------|-------------|
| Source Discovery | 8-15s | 4-8s | 50% faster |
| Claude API Calls | 3-8s | 2-4s | 33% faster |  
| Cache Lookup | 200ms | 50ms | 75% faster |
| Total Pipeline | 15-30s | 6-12s | 60% faster |

## 🔧 Configuration Options

### Timeout Configuration
Adjust timeouts in `performance-utils.ts`:

```typescript
// Conservative (safer)
const TIMEOUTS = {
  TAVILY_API: 12000,     // 12s
  CLAUDE_API: 18000,     // 18s
  APIFY_API: 10000,      // 10s
};

// Aggressive (faster but higher failure rate)
const TIMEOUTS = {
  TAVILY_API: 8000,      // 8s
  CLAUDE_API: 12000,     // 12s  
  APIFY_API: 6000,       // 6s
};
```

### Cache TTL Configuration  
Modify `enhanced-cache.ts`:

```typescript
const CACHE_DURATIONS = {
  HOOKS: 48 * 60 * 60 * 1000,        // 48h (existing)
  SOURCES: 6 * 60 * 60 * 1000,       // 6h (new)
  COMPANY_INTEL: 24 * 60 * 60 * 1000, // 24h (new) 
  INTENT_SIGNALS: 12 * 60 * 60 * 1000, // 12h (new)
};
```

### Circuit Breaker Configuration
Adjust failure thresholds:

```typescript
export const circuitBreakers = {
  tavily: new CircuitBreaker(3, 30000),   // 3 failures, 30s reset
  claude: new CircuitBreaker(5, 60000),   // 5 failures, 1m reset
  apify: new CircuitBreaker(3, 45000),    // 3 failures, 45s reset
};
```

## 🐛 Troubleshooting

### Common Issues

#### 1. High Cache Miss Rate
**Symptoms**: Cache hit rate <30%
**Causes**: 
- Profile-based cache busting too aggressive
- Rules version bumping too frequently
- Target role variations causing cache fragmentation

**Solutions**:
- Reduce profile update sensitivity
- Group similar target roles
- Implement cache warming for popular companies

#### 2. External API Timeouts
**Symptoms**: Frequent timeout errors
**Causes**:
- Network latency to external APIs  
- API rate limiting
- Circuit breaker too sensitive

**Solutions**:
- Increase timeout values
- Add retry logic with exponential backoff
- Implement graceful degradation

#### 3. Memory Usage Growth
**Symptoms**: Memory usage increases over time
**Causes**:
- In-memory cache not cleaning up properly
- Large objects being cached

**Solutions**:
- Reduce cache TTLs
- Implement more aggressive cleanup
- Add memory usage monitoring

#### 4. Claude API Rate Limits
**Symptoms**: 429 errors from Claude API
**Causes**:
- Too many concurrent requests
- Large token usage

**Solutions**:
- Implement request queuing
- Further compress prompts
- Add request spreading

### Performance Debugging

Enable detailed logging:

```typescript
// Add to environment variables
ENABLE_PERF_LOGGING=true

// View detailed timing logs
console.log('[PERF] operation-name: 1234ms');
```

Monitor cache statistics:

```typescript
const stats = EnhancedCache.getStats();
console.log('Cache stats:', stats);
```

## 🔄 Rollback Plan

If issues occur during deployment:

### Immediate Rollback (< 5 minutes)
```bash
# Revert to original endpoint
git revert <optimization_commit_hash>
npm run build
pm2 restart all
```

### Gradual Rollback
1. Route traffic back to original endpoint  
2. Debug issues in staging environment
3. Fix and re-deploy optimized version

### Emergency Procedures
- Keep backup of original `generate-hooks/route.ts`
- Monitor error rates during deployment
- Have on-call engineer available during migration

## 📈 Phase 2 Planning

After Phase 1 success, consider Phase 2 optimizations:

### Database Optimizations
- [ ] Add indexes for common queries
- [ ] Implement connection pooling
- [ ] Batch database operations

### Advanced Caching
- [ ] Redis cache layer
- [ ] Cache warming strategies  
- [ ] Predictive pre-loading

### Request Streaming
- [ ] Implement Server-Sent Events
- [ ] Progressive hook delivery
- [ ] Real-time progress indicators

### Background Processing
- [ ] Queue expensive operations
- [ ] Pre-generate hooks for popular companies
- [ ] Async variant generation

## 📞 Support

### Key Contacts
- **Implementation Lead**: [Your Name]
- **Database Admin**: [DBA Contact]  
- **DevOps Engineer**: [DevOps Contact]

### Escalation Path
1. Check logs and metrics
2. Review this troubleshooting guide
3. Contact implementation lead
4. Consider rollback if critical

### Monitoring Dashboards
- Application performance metrics
- Database query performance
- External API response times
- Cache hit/miss rates
- Error rates by endpoint

---

## ✅ Post-Implementation Checklist

After deploying optimizations:

### Day 1
- [ ] Monitor response times hourly
- [ ] Check error rates  
- [ ] Verify cache hit rates
- [ ] Test all user flows

### Week 1  
- [ ] Compare week-over-week performance
- [ ] Analyze user satisfaction metrics
- [ ] Document lessons learned
- [ ] Plan Phase 2 if targets met

### Month 1
- [ ] Full performance review
- [ ] Optimize based on real usage patterns
- [ ] Consider additional optimizations
- [ ] Update monitoring and alerts

---

**🎯 Success Criteria**: Phase 1 complete when average response time is consistently <10 seconds with >95% success rate and >70% cache hit rate for 7 consecutive days.