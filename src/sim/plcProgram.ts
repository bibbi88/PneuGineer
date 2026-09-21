/** A tiny PLC "program": a list of `Q0.n = <boolean expression>` assignments, evaluated top to
 * bottom every scan like ladder rungs. Expressions use inputs (I0.n), outputs (Q0.n - the value
 * from earlier in this scan, or the previous scan if not yet assigned, which is what makes a
 * self-holding rung work), the constants 0/1/TRUE/FALSE, parentheses, and NOT/!, AND/&, OR/|,
 * XOR/^ (precedence: NOT, then AND, then XOR, then OR). Assignments are separated by ';' or
 * newlines. */

export type Expr =
  | { kind: 'const'; value: boolean }
  | { kind: 'var'; name: string }
  | { kind: 'not'; arg: Expr }
  | { kind: 'bin'; op: 'and' | 'or' | 'xor'; left: Expr; right: Expr };

export interface Assignment {
  target: string;
  expr: Expr;
}

export interface CompiledProgram {
  assignments: Assignment[];
  error: string | null;
}

const VAR_RE = /^[IQ]\d+\.\d+$/;

function tokenize(src: string): string[] {
  const tokens: string[] = [];
  const re = /\s*([A-Za-z]\w*(?:\.\d+)?|\d+|[()!&|^=])/gy;
  let pos = 0;
  while (pos < src.length) {
    if (/^\s*$/.test(src.slice(pos))) break;
    re.lastIndex = pos;
    const m = re.exec(src);
    if (!m) throw new Error(`Unexpected character "${src.slice(pos).trim()[0]}"`);
    tokens.push(m[1] as string);
    pos = re.lastIndex;
  }
  return tokens;
}

function parseExpression(tokens: string[]): Expr {
  let i = 0;
  const peek = (): string | undefined => tokens[i];
  const upper = (): string | undefined => tokens[i]?.toUpperCase();

  function parseOr(): Expr {
    let left = parseXor();
    while (upper() === 'OR' || peek() === '|') {
      i++;
      left = { kind: 'bin', op: 'or', left, right: parseXor() };
    }
    return left;
  }
  function parseXor(): Expr {
    let left = parseAnd();
    while (upper() === 'XOR' || peek() === '^') {
      i++;
      left = { kind: 'bin', op: 'xor', left, right: parseAnd() };
    }
    return left;
  }
  function parseAnd(): Expr {
    let left = parseNot();
    while (upper() === 'AND' || peek() === '&') {
      i++;
      left = { kind: 'bin', op: 'and', left, right: parseNot() };
    }
    return left;
  }
  function parseNot(): Expr {
    if (upper() === 'NOT' || peek() === '!') {
      i++;
      return { kind: 'not', arg: parseNot() };
    }
    return parseAtom();
  }
  function parseAtom(): Expr {
    const t = peek();
    if (t === undefined) throw new Error('Expression ends unexpectedly');
    i++;
    if (t === '(') {
      const inner = parseOr();
      if (peek() !== ')') throw new Error('Missing ")"');
      i++;
      return inner;
    }
    const u = t.toUpperCase();
    if (u === '1' || u === 'TRUE') return { kind: 'const', value: true };
    if (u === '0' || u === 'FALSE') return { kind: 'const', value: false };
    if (VAR_RE.test(u)) return { kind: 'var', name: u };
    throw new Error(`Unknown name "${t}" (use I0.n or Q0.n)`);
  }

  const expr = parseOr();
  if (i < tokens.length) throw new Error(`Unexpected "${tokens[i]}"`);
  return expr;
}

export function compileProgram(text: string): CompiledProgram {
  const assignments: Assignment[] = [];
  try {
    for (const raw of text.split(/[;\n]/)) {
      if (raw.trim() === '') continue;
      const tokens = tokenize(raw);
      const target = tokens[0]?.toUpperCase() ?? '';
      if (!/^Q\d+\.\d+$/.test(target) || tokens[1] !== '=') {
        throw new Error(`Each line must look like "Q0.0 = ..." (got "${raw.trim()}")`);
      }
      assignments.push({ target, expr: parseExpression(tokens.slice(2)) });
    }
  } catch (e) {
    return { assignments: [], error: e instanceof Error ? e.message : String(e) };
  }
  return { assignments, error: null };
}

export function evaluate(expr: Expr, env: Map<string, boolean>): boolean {
  switch (expr.kind) {
    case 'const':
      return expr.value;
    case 'var':
      return env.get(expr.name) ?? false;
    case 'not':
      return !evaluate(expr.arg, env);
    case 'bin': {
      const l = evaluate(expr.left, env);
      const r = evaluate(expr.right, env);
      return expr.op === 'and' ? l && r : expr.op === 'or' ? l || r : l !== r;
    }
  }
}

/** Runs one scan: `inputs` and the previous `outputs` seed the environment; returns the new
 * output values (every output named in the program; unassigned ones keep their old value). */
export function runScan(
  program: CompiledProgram,
  inputs: Map<string, boolean>,
  outputs: Map<string, boolean>,
): Map<string, boolean> {
  const env = new Map<string, boolean>([...outputs, ...inputs]);
  for (const a of program.assignments) env.set(a.target, evaluate(a.expr, env));
  return new Map([...outputs.keys()].map((k) => [k, env.get(k) ?? false]));
}
