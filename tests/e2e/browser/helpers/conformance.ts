import * as fs from 'fs';

export type CheckStatus = 'pass' | 'fail' | 'skip';

export interface ConformanceCheck {
  checkId: string;
  phase: string;
  matrixSections: string[];
  ksIds: string[];
  status: CheckStatus;
  detail: string;
  evidence?: Record<string, unknown>;
}

export interface ConformanceSummary {
  total: number;
  pass: number;
  fail: number;
  skip: number;
}

export class ConformanceRecorder {
  private checks: ConformanceCheck[] = [];

  add(check: ConformanceCheck): void {
    this.checks.push(check);
  }

  pass(
    checkId: string,
    phase: string,
    matrixSections: string[],
    ksIds: string[],
    detail: string,
    evidence?: Record<string, unknown>
  ): void {
    this.add({ checkId, phase, matrixSections, ksIds, status: 'pass', detail, evidence });
  }

  fail(
    checkId: string,
    phase: string,
    matrixSections: string[],
    ksIds: string[],
    detail: string,
    evidence?: Record<string, unknown>
  ): void {
    this.add({ checkId, phase, matrixSections, ksIds, status: 'fail', detail, evidence });
  }

  skip(
    checkId: string,
    phase: string,
    matrixSections: string[],
    ksIds: string[],
    detail: string,
    evidence?: Record<string, unknown>
  ): void {
    this.add({ checkId, phase, matrixSections, ksIds, status: 'skip', detail, evidence });
  }

  summary(): ConformanceSummary {
    const summary: ConformanceSummary = { total: this.checks.length, pass: 0, fail: 0, skip: 0 };
    for (const check of this.checks) {
      summary[check.status] += 1;
    }
    return summary;
  }

  failureCount(): number {
    return this.checks.filter((c) => c.status === 'fail').length;
  }

  toReport(runner: string): Record<string, unknown> {
    return {
      generatedAt: new Date().toISOString(),
      runner,
      summary: this.summary(),
      checks: this.checks,
    };
  }

  writeReport(path: string, runner: string): void {
    const report = this.toReport(runner);
    fs.writeFileSync(path, JSON.stringify(report, null, 2), 'utf8');
  }
}
