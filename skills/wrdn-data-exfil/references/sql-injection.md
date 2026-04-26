# SQL / NoSQL Injection Reference (Exfil Angle)

Load when the diff touches raw query APIs, ORM escape hatches, or operator-valued query fragments: Django `raw()`/`extra()`/`RawSQL`, SQLAlchemy `text()`, Sequelize `literal`/`query`, Prisma `$queryRawUnsafe`/`$executeRawUnsafe`, Mongoose `populate({match})`, Mongo `$where`/`$regex`, or string-concat into cursor `execute()`.

Scope in this skill: injection that produces bulk data exfiltration or write-amplification. Authorization bypass via SQL, such as returning another user's row, is in scope only when injection itself is the enabler. Direct missing-scope queries without injection are out of scope.

## The Core Rule

The first argument to a raw-query API is **not** parameterized. Parameterization happens only where the API accepts a separate values argument (or uses tagged-template interpolation). Anything interpolated into the first argument is attacker-reachable.

## Django ORM

### Unsafe

```python
# Concatenation
Invoice.objects.extra(where=[f"customer_id = {request.GET['cid']}"])
Invoice.objects.extra(where=[f"customer_id = %s" % request.GET['cid']])

# RawSQL with user data in the expression
Invoice.objects.annotate(custom=RawSQL(f"func({user_val})", []))

# Raw SQL with f-string
Invoice.objects.raw(f"SELECT * FROM invoices WHERE name = '{user_val}'")

# Cursor with string interpolation
from django.db import connection
with connection.cursor() as cur:
    cur.execute(f"SELECT * FROM invoices WHERE id = {user_id}")
```

### Safe

```python
# extra with parameters
Invoice.objects.extra(where=["customer_id = %s"], params=[request.GET['cid']])

# Prefer the ORM
Invoice.objects.filter(customer_id=request.GET['cid'])

# raw with parameters
Invoice.objects.raw("SELECT * FROM invoices WHERE name = %s", [user_val])

# Cursor with parameters
cur.execute("SELECT * FROM invoices WHERE id = %s", [user_id])
```

### Notes

- `extra(select=)` with user input in the key is a column-name injection (changes the result shape). Avoid dynamic column names from user input; use an allowlist if needed.
- `order_by(user_input)` is not injection in Django (the ORM validates column names) but leaks information about fields that exist.

## SQLAlchemy

### Unsafe

```python
from sqlalchemy import text

session.execute(text(f"SELECT * FROM users WHERE name = '{name}'"))
session.execute(f"SELECT * FROM users WHERE name = '{name}'")  # Implicit text-wrap; same hole.
```

### Safe

```python
session.execute(text("SELECT * FROM users WHERE name = :name"), {"name": name})
session.query(User).filter_by(name=name).all()
```

Named bind parameters via `:name` are the idiomatic safe form.

## psycopg2 / asyncpg / mysqlclient / sqlite3

### Unsafe

```python
cur.execute(f"SELECT * FROM t WHERE id = {user_id}")
cur.execute("SELECT * FROM t WHERE id = %s" % user_id)
cur.execute("SELECT * FROM t WHERE name = '{}'".format(name))
```

### Safe

```python
cur.execute("SELECT * FROM t WHERE id = %s", (user_id,))
cur.execute("SELECT * FROM t WHERE id = ?", (user_id,))   # sqlite3
```

**Common false positive**: `cur.execute(f"SELECT * FROM {table} WHERE id = %s", (user_id,))` where `table` is a hardcoded constant. The f-string has no user data; the `%s` has the user data via the parameter tuple. Safe.

## Sequelize (Node)

### Unsafe

```ts
await sequelize.query(`SELECT * FROM users WHERE name = '${name}'`);
await User.findAll({ where: { name: Sequelize.literal(`'${name}'`) } });
```

### CVE-2023-25813

```ts
// Using literal() with replacements re-interpolates the literal unescaped.
await sequelize.query(
  Sequelize.literal("soundex(\"firstName\") = soundex(:firstName)"),
  { replacements: { firstName: userInput } }
);
// The :firstName placeholder inside a literal() is NOT the same as a normal
// replacement path. Pre-patch, user input landed unescaped in the SQL.
```

Upgrade Sequelize past the patched version. Avoid `literal()` with user data regardless.

### Safe

```ts
await sequelize.query("SELECT * FROM users WHERE name = :name", {
  replacements: { name },
  type: QueryTypes.SELECT,
});
await User.findAll({ where: { name } });
```

## Prisma (Node)

### Unsafe

```ts
await prisma.$queryRawUnsafe(`SELECT * FROM users WHERE name = '${name}'`);
await prisma.$executeRawUnsafe(`DELETE FROM users WHERE id = ${id}`);
```

### Safe (tagged-template form auto-parameterizes)

```ts
await prisma.$queryRaw`SELECT * FROM users WHERE name = ${name}`;
await prisma.$executeRaw`DELETE FROM users WHERE id = ${id}`;
```

Prisma distinguishes `Raw` (tagged template, safe) from `RawUnsafe` (string, unsafe). The naming is explicit.

## Mongo / Mongoose (NoSQL)

### Unsafe

```ts
// Operator injection via unsanitized object from request
app.post('/login', async (req, res) => {
  const user = await User.findOne({ username: req.body.username, password: req.body.password });
});
// Body: {"username":"admin","password":{"$ne":null}} bypasses the password check
// by making the comparison "password not null" rather than equality.
```

```ts
// $where with user input
await User.find({ $where: `this.name == '${name}'` });   // JS eval on Mongo server.
```

```ts
// Mongoose populate match (CVE-2025-23061)
await Order.findById(id).populate({
  path: 'user',
  match: req.body.match,    // Attacker supplies {$where: "..."}
});
```

### Safe

```ts
// Coerce operator-prone fields to strings before use in queries
const username = String(req.body.username);
const password = String(req.body.password);
const user = await User.findOne({ username, password });

// Never pass unsanitized objects as query filters.
// For populate match, use whitelisted keys:
const match = { status: String(req.body.status) };
```

Consider `express-mongo-sanitize` middleware or equivalent; strips `$`/`.` prefixes from body keys.

## Postgres JSON-operator injection

```ts
await pool.query(`SELECT data -> '${userKey}' FROM table`);
```

User controls a JSON key spliced into SQL. Can alter the query's meaning. Parameterize with placeholders or, better, route JSON operator access through a safe wrapper.

## Detection Heuristics

For every raw-query match:

1. **Is the first argument a template string / f-string / concat** with any value from `request.*`, webhook payload, header, or DB field user-written?
2. **Does a `replacements` / `params` / `args` argument exist** and carry the user data separately? If yes, the first argument should not interpolate user data.
3. **Is the API labeled "Unsafe"** (Prisma `$queryRawUnsafe`, Sequelize `literal`)? Each use requires justification.
4. **Is the query an operator-valued object** (Mongo)? Coerce fields to expected primitive types.

## False-Positive Traps

- Tagged-template `$queryRaw` in Prisma is safe.
- ORM filter methods (`filter`, `findBy`, `find({where})`) with user values are safe; the ORM parameterizes.
- f-string interpolating a hardcoded table or column name (not user data) with placeholders for user data is safe.
- SQLAlchemy `where(User.name == name)` expression form is safe.
- `cur.execute(sql, params)` with placeholders in `sql` and values in `params` is safe.

## Diff Heuristics

1. New `.raw(f"...")`, `.raw(concat...)`, `.extra(where=[f"..."])`, `.extra(select={f"...": ...})`.
2. New `cursor.execute(f"...")`, `% user`, `.format(user)`.
3. New `text(f"...")` or `session.execute(f"...")` with user data.
4. New `$queryRawUnsafe` / `$executeRawUnsafe` with user data.
5. New `Sequelize.literal` with user data.
6. New Mongo `$where` / `$regex` with user data, or `populate({match: userObj})`.
7. New query where a request-body field is passed as the whole filter object without type coercion.
8. `order_by(user_input)` — usually safe in ORMs but confirm.

## Verification Commands

```bash
# Django raw SQL
rg -n '\.raw\(|\.extra\(|RawSQL\(|cursor\.execute\(' <file>

# SQLAlchemy
rg -n 'session\.execute\(|\btext\(' <file>

# Low-level drivers
rg -n 'psycopg2|asyncpg|sqlite3|mysqlclient|pymysql' <file>

# Node ORMs
rg -n '\$queryRaw|\$executeRaw|\$queryRawUnsafe|\$executeRawUnsafe|sequelize\.query|Sequelize\.literal' <file>

# Mongo operator shapes
rg -n '\$where|\$regex|\.populate\(\s*\{' <file>

# Sanitizers
rg -n 'express-mongo-sanitize|mongo-sanitize' <file>
```
