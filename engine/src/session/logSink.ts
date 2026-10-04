/** Batches JSON rows to the server's /log endpoint; unsent rows survive a failed POST. */
export class LogSink {
  rows = 0;
  lastError = '';
  private buf: string[] = [];

  constructor(private session: string, private name: string) {}

  push(row: object): void {
    this.buf.push(JSON.stringify(row));
  }

  async flush(): Promise<void> {
    if (this.buf.length === 0) return;
    const lines = this.buf;
    this.buf = [];
    try {
      const r = await fetch(`/log?session=${this.session}&name=${this.name}`, { method: 'POST', body: lines.join('\n') + '\n' });
      if (!r.ok) throw new Error(`HTTP ${(r as Response).status}`);
      this.rows += lines.length;
      this.lastError = '';
    } catch (e) {
      this.buf = lines.concat(this.buf);
      this.lastError = String(e);
    }
  }
}
