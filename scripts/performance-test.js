#!/usr/bin/env node

/**
 * Performance testing script for GetSignalHooks optimization
 * Compares original vs optimized API endpoints
 */

const https = require('https');
const http = require('http');

const TEST_URLS = [
  'https://stripe.com',
  'https://notion.so', 
  'https://figma.com',
  'https://slack.com',
  'https://airtable.com',
];

const TARGET_ROLES = ['VP Sales', 'Marketing', 'General'];

class PerformanceTest {
  constructor() {
    this.results = [];
  }

  async makeRequest(url, payload) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(payload);
      const parsedUrl = new URL(url);
      
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
        timeout: 45000, // 45s timeout
      };

      const req = (parsedUrl.protocol === 'https:' ? https : http).request(options, (res) => {
        let responseData = '';
        res.on('data', chunk => { responseData += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseData);
            resolve({
              status: res.statusCode,
              data: parsed,
              headers: res.headers,
            });
          } catch (e) {
            resolve({
              status: res.statusCode,
              data: responseData,
              headers: res.headers,
            });
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(data);
      req.end();
    });
  }

  async testEndpoint(endpointUrl, testUrl, targetRole = 'General') {
    const payload = {
      url: testUrl,
      targetRole: targetRole,
    };

    console.log(`Testing: ${endpointUrl} with ${testUrl} (${targetRole})`);
    
    const startTime = Date.now();
    try {
      const response = await this.makeRequest(endpointUrl, payload);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const result = {
        endpoint: endpointUrl,
        testUrl,
        targetRole,
        duration,
        status: response.status,
        success: response.status === 200,
        hooks: response.data?.hooks?.length || 0,
        cached: response.data?.cached || false,
        lowSignal: response.data?.lowSignal || false,
        error: response.status !== 200 ? response.data?.error : null,
      };

      console.log(`✓ ${duration}ms - ${result.hooks} hooks - ${result.cached ? 'CACHED' : 'FRESH'} - ${result.lowSignal ? 'LOW_SIGNAL' : 'OK'}`);
      
      return result;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`✗ ${duration}ms - ERROR: ${error.message}`);
      
      return {
        endpoint: endpointUrl,
        testUrl,
        targetRole,
        duration,
        status: 0,
        success: false,
        hooks: 0,
        cached: false,
        lowSignal: false,
        error: error.message,
      };
    }
  }

  async runComparison() {
    console.log('🚀 Starting GetSignalHooks Performance Test');
    console.log('=' .repeat(60));

    const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';
    const originalEndpoint = `${baseUrl}/api/generate-hooks`;
    const optimizedEndpoint = `${baseUrl}/api/generate-hooks-optimized`;

    for (const testUrl of TEST_URLS) {
      console.log(`\n📊 Testing URL: ${testUrl}`);
      console.log('-'.repeat(40));

      for (const role of TARGET_ROLES.slice(0, 2)) { // Test first 2 roles only
        console.log(`\n🎯 Role: ${role}`);
        
        // Test original endpoint
        const originalResult = await this.testEndpoint(originalEndpoint, testUrl, role);
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause

        // Test optimized endpoint  
        const optimizedResult = await this.testEndpoint(optimizedEndpoint, testUrl, role);
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause

        // Calculate improvement
        if (originalResult.success && optimizedResult.success) {
          const improvement = ((originalResult.duration - optimizedResult.duration) / originalResult.duration) * 100;
          console.log(`📈 Improvement: ${improvement.toFixed(1)}% faster (${originalResult.duration}ms → ${optimizedResult.duration}ms)`);
        }

        this.results.push({ original: originalResult, optimized: optimizedResult });
      }
    }

    this.printSummary();
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 PERFORMANCE TEST SUMMARY');
    console.log('='.repeat(60));

    const originalResults = this.results.map(r => r.original).filter(r => r.success);
    const optimizedResults = this.results.map(r => r.optimized).filter(r => r.success);

    if (originalResults.length === 0 || optimizedResults.length === 0) {
      console.log('❌ Not enough successful tests to compare');
      return;
    }

    // Calculate averages
    const avgOriginal = originalResults.reduce((sum, r) => sum + r.duration, 0) / originalResults.length;
    const avgOptimized = optimizedResults.reduce((sum, r) => sum + r.duration, 0) / optimizedResults.length;
    const avgImprovement = ((avgOriginal - avgOptimized) / avgOriginal) * 100;

    // Calculate percentiles
    const originalSorted = [...originalResults].map(r => r.duration).sort((a, b) => a - b);
    const optimizedSorted = [...optimizedResults].map(r => r.duration).sort((a, b) => a - b);

    const p50Original = originalSorted[Math.floor(originalSorted.length * 0.5)];
    const p95Original = originalSorted[Math.floor(originalSorted.length * 0.95)];
    const p50Optimized = optimizedSorted[Math.floor(optimizedSorted.length * 0.5)];
    const p95Optimized = optimizedSorted[Math.floor(optimizedSorted.length * 0.95)];

    console.log(`
🔍 RESULTS:
  
  Original API:
    • Average: ${avgOriginal.toFixed(0)}ms
    • P50: ${p50Original}ms  
    • P95: ${p95Original}ms
    • Success Rate: ${(originalResults.length / this.results.length * 100).toFixed(1)}%
    
  Optimized API:
    • Average: ${avgOptimized.toFixed(0)}ms  
    • P50: ${p50Optimized}ms
    • P95: ${p95Optimized}ms
    • Success Rate: ${(optimizedResults.length / this.results.length * 100).toFixed(1)}%
    
  📈 IMPROVEMENT:
    • Average: ${avgImprovement.toFixed(1)}% faster
    • P50: ${((p50Original - p50Optimized) / p50Original * 100).toFixed(1)}% faster
    • P95: ${((p95Original - p95Optimized) / p95Original * 100).toFixed(1)}% faster
    
  🎯 TARGET ACHIEVED: ${avgOptimized < 10000 ? '✅ YES' : '❌ NO'} (target: <10s)
`);

    // Cache hit rate analysis
    const cacheHits = optimizedResults.filter(r => r.cached).length;
    const cacheHitRate = (cacheHits / optimizedResults.length) * 100;
    console.log(`  💾 Cache Hit Rate: ${cacheHitRate.toFixed(1)}% (target: >70%)`);

    // Error analysis
    const originalErrors = this.results.filter(r => !r.original.success);
    const optimizedErrors = this.results.filter(r => !r.optimized.success);
    
    if (originalErrors.length > 0 || optimizedErrors.length > 0) {
      console.log(`\n❌ ERRORS:`);
      console.log(`  • Original: ${originalErrors.length} failures`);
      console.log(`  • Optimized: ${optimizedErrors.length} failures`);
    }

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    if (avgImprovement < 50) {
      console.log('  • Consider implementing Phase 2 optimizations');
    }
    if (cacheHitRate < 70) {  
      console.log('  • Improve cache warming strategy');
    }
    if (p95Optimized > 15000) {
      console.log('  • Add more aggressive timeouts for slow external APIs');
    }
    if (avgOptimized >= 10000) {
      console.log('  • Target of <10s average not yet achieved - continue optimization');
    } else {
      console.log('  • 🎉 Performance target achieved! Consider Phase 3 for further gains.');
    }
  }
}

// Run the test
if (require.main === module) {
  const tester = new PerformanceTest();
  tester.runComparison().catch(console.error);
}

module.exports = PerformanceTest;