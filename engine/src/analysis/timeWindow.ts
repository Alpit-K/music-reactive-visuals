/** Values over a trailing time window. Mean and std use running sums; median, min and max scan on demand. */
export class TimeWindow {
  private ts: number[] = [];
  private xs: number[] = [];
  private head = 0;
  private sum = 0;
  private sumSq = 0;

  constructor(private spanS: number) {}

  push(t: number, x: number): void {
    this.ts.push(t);
    this.xs.push(x);
    this.sum += x;
    this.sumSq += x * x;
  }

  prune(t: number): void {
    while (this.head < this.ts.length && this.ts[this.head] < t - this.spanS) {
      const x = this.xs[this.head++];
      this.sum -= x;
      this.sumSq -= x * x;
    }
    if (this.head > 4096 && this.head * 2 > this.ts.length) {
      this.ts = this.ts.slice(this.head);
      this.xs = this.xs.slice(this.head);
      this.head = 0;
    }
  }

  get count(): number {
    return this.ts.length - this.head;
  }

  mean(): number {
    return this.count ? this.sum / this.count : 0;
  }

  std(): number {
    const n = this.count;
    if (!n) return 0;
    const m = this.sum / n;
    return Math.sqrt(Math.max(this.sumSq / n - m * m, 0));
  }

  median(): number {
    const v = this.xs.slice(this.head).sort((a, b) => a - b);
    const n = v.length;
    if (!n) return 0;
    return n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
  }

  min(): number {
    let m = Infinity;
    for (let i = this.head; i < this.xs.length; i++) m = Math.min(m, this.xs[i]);
    return this.count ? m : 0;
  }

  max(): number {
    let m = -Infinity;
    for (let i = this.head; i < this.xs.length; i++) m = Math.max(m, this.xs[i]);
    return this.count ? m : 0;
  }
}
