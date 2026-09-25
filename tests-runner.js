/**
 * Mini test runner — sin dependencias, sin build.
 * API: describe(name, fn) / it(name, fn) / expect(value).toBe(...)
 * Se ejecuta automáticamente al cargar la página.
 */
(function () {
  'use strict';

  const suites = [];
  let currentSuite = null;
  const results = [];

  function describe(name, fn) {
    const suite = { name, tests: [] };
    suites.push(suite);
    const prev = currentSuite;
    currentSuite = suite;
    fn();
    currentSuite = prev;
  }

  function it(name, fn) {
    if (!currentSuite) {
      currentSuite = { name: '(sin suite)', tests: [] };
      suites.push(currentSuite);
    }
    currentSuite.tests.push({ name, fn });
  }

  function deepEqual(a, b) {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      return a.every((v, i) => deepEqual(v, b[i]));
    }
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every(k => deepEqual(a[k], b[k]));
  }

  function fmt(v) {
    if (typeof v === 'string') return JSON.stringify(v);
    if (v === null) return 'null';
    if (v === undefined) return 'undefined';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  function expect(received) {
    return {
      toBe(expected) {
        if (!Object.is(received, expected)) {
          throw new Error(`Expected ${fmt(expected)} but got ${fmt(received)}`);
        }
      },
      toEqual(expected) {
        if (!deepEqual(received, expected)) {
          throw new Error(`Expected ${fmt(expected)} but got ${fmt(received)}`);
        }
      },
      toBeCloseTo(expected, precision = 2) {
        const tol = Math.pow(10, -precision) / 2;
        if (Math.abs(received - expected) > tol) {
          throw new Error(`Expected ~${expected} (±${tol}) but got ${received}`);
        }
      },
      toBeTruthy() { if (!received) throw new Error(`Expected truthy but got ${fmt(received)}`); },
      toBeFalsy() { if (received) throw new Error(`Expected falsy but got ${fmt(received)}`); },
      toBeDefined() { if (received === undefined) throw new Error(`Expected defined`); },
      toBeUndefined() { if (received !== undefined) throw new Error(`Expected undefined but got ${fmt(received)}`); },
      toBeNull() { if (received !== null) throw new Error(`Expected null but got ${fmt(received)}`); },
      toBeGreaterThan(n) { if (!(received > n)) throw new Error(`Expected > ${n} but got ${received}`); },
      toBeGreaterThanOrEqual(n) { if (!(received >= n)) throw new Error(`Expected >= ${n} but got ${received}`); },
      toBeLessThan(n) { if (!(received < n)) throw new Error(`Expected < ${n} but got ${received}`); },
      toBeLessThanOrEqual(n) { if (!(received <= n)) throw new Error(`Expected <= ${n} but got ${received}`); },
      toHaveLength(n) {
        const len = received && received.length;
        if (len !== n) throw new Error(`Expected length ${n} but got ${len}`);
      },
      toContain(item) {
        if (typeof received === 'string') {
          if (!received.includes(item)) throw new Error(`Expected "${received}" to contain "${item}"`);
        } else if (Array.isArray(received)) {
          if (!received.some(x => deepEqual(x, item))) throw new Error(`Expected array to contain ${fmt(item)}`);
        } else {
          throw new Error(`Cannot use toContain on ${typeof received}`);
        }
      },
      toThrow(matcher) {
        let threw = false, err = null;
        try { received(); } catch (e) { threw = true; err = e; }
        if (!threw) throw new Error(`Expected function to throw`);
        if (matcher instanceof RegExp) {
          if (!matcher.test(err.message)) throw new Error(`Expected error matching ${matcher}, got "${err.message}"`);
        } else if (typeof matcher === 'string') {
          if (!err.message.includes(matcher)) throw new Error(`Expected error containing "${matcher}", got "${err.message}"`);
        }
      }
    };
  }

  function run() {
    let passed = 0, failed = 0;
    const t0 = performance.now();

    for (const suite of suites) {
      for (const test of suite.tests) {
        const result = { suite: suite.name, name: test.name, pass: true, error: null };
        try {
          test.fn();
        } catch (e) {
          result.pass = false;
          result.error = e;
          failed++;
        }
        if (result.pass) passed++;
        results.push(result);
      }
    }

    const duration = performance.now() - t0;
    renderResults({ passed, failed, duration, results, suites });

    const style = failed === 0
      ? 'color:#22c55e; font-weight:bold; font-size:14px'
      : 'color:#ef4444; font-weight:bold; font-size:14px';
    console.log(`%c${failed === 0 ? '✓' : '✗'} ${passed} pasaron, ${failed} fallaron (${duration.toFixed(1)}ms)`, style);

    if (failed > 0) {
      for (const r of results) {
        if (!r.pass) console.error(`✗ [${r.suite}] ${r.name}\n   → ${r.error.message}`);
      }
    }
  }

  function renderResults({ passed, failed, duration, results, suites }) {
    const root = document.getElementById('results');
    const summary = document.getElementById('summary');
    if (!root || !summary) return;

    let html = '';
    for (const suite of suites) {
      const suiteResults = results.filter(r => r.suite === suite.name);
      const suiteFailed = suiteResults.filter(r => !r.pass).length;
      const suitePassed = suiteResults.length - suiteFailed;

      html += `<div class="suite ${suiteFailed ? 'has-failure' : ''}">`;
      html += `<div class="suite-header">`;
      html += `<span class="suite-name">${escapeHtml(suite.name)}</span>`;
      html += `<span class="suite-stat ${suiteFailed ? 'fail' : 'pass'}">`;
      html += suiteFailed
        ? `${suitePassed}/${suiteResults.length} · ${suiteFailed} fallaron`
        : `${suitePassed}/${suiteResults.length} ✓`;
      html += `</span></div>`;

      for (const r of suiteResults) {
        html += `<div class="test ${r.pass ? 'pass' : 'fail'}">`;
        html += `<span class="test-icon">${r.pass ? '✓' : '✗'}</span>`;
        html += `<span class="test-name">${escapeHtml(r.name)}</span>`;
        if (!r.pass) {
          html += `<pre class="test-error">${escapeHtml(r.error.message)}</pre>`;
        }
        html += `</div>`;
      }
      html += `</div>`;
    }

    summary.className = 'summary ' + (failed === 0 ? 'pass' : 'fail');
    summary.innerHTML = `
      <span class="summary-label">${failed === 0 ? '✓ TODOS PASARON' : '✗ HAY FALLOS'}</span>
      <span class="summary-num">${passed} pasaron · ${failed} fallaron · ${duration.toFixed(1)}ms</span>
    `;

    root.innerHTML = html;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  window.describe = describe;
  window.it = it;
  window.expect = expect;
  window.__runTests = run;
})();