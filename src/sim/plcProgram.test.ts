import { describe, expect, it } from 'vitest';
import { compileProgram, runScan } from './plcProgram';

const bools = (o: Record<string, boolean>): Map<string, boolean> => new Map(Object.entries(o));

describe('compileProgram / runScan', () => {
  it('evaluates AND/OR/NOT with the usual precedence, in words or symbols', () => {
    const p = compileProgram('Q0.0 = I0.0 AND NOT I0.1 OR I0.2; Q0.1 = !(I0.0 | I0.1) ^ I0.2');
    expect(p.error).toBeNull();
    const out = bools({ 'Q0.0': false, 'Q0.1': false });
    expect(runScan(p, bools({ 'I0.0': true, 'I0.1': true, 'I0.2': false }), out).get('Q0.0')).toBe(false);
    expect(runScan(p, bools({ 'I0.0': true, 'I0.1': false, 'I0.2': false }), out).get('Q0.0')).toBe(true);
    expect(runScan(p, bools({ 'I0.0': false, 'I0.1': true, 'I0.2': true }), out).get('Q0.0')).toBe(true);
  });

  it('a self-holding rung keeps its output after the start input drops', () => {
    const p = compileProgram('Q0.0 = (I0.0 | Q0.0) & !I0.1');
    let out = bools({ 'Q0.0': false });
    out = runScan(p, bools({ 'I0.0': true, 'I0.1': false }), out);
    expect(out.get('Q0.0')).toBe(true);
    out = runScan(p, bools({ 'I0.0': false, 'I0.1': false }), out);
    expect(out.get('Q0.0')).toBe(true);
    out = runScan(p, bools({ 'I0.0': false, 'I0.1': true }), out);
    expect(out.get('Q0.0')).toBe(false);
  });

  it('reports a readable error and runs nothing for a bad program', () => {
    expect(compileProgram('Q0.0 = I0.0 &').error).toMatch(/ends unexpectedly/);
    expect(compileProgram('X = 1').error).toMatch(/Q0\.0/);
    expect(compileProgram('Q0.0 = foo').error).toMatch(/Unknown name/);
    expect(compileProgram('Q0.0 = foo').assignments).toEqual([]);
  });
});
