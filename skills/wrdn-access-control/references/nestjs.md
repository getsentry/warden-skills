# NestJS Access-Control Reference

Load when the diff touches NestJS controllers, `@UseGuards`, `APP_GUARD`, `@Public`, `@Roles`, or custom guards.

## Auth Defaults

Depends on setup. NestJS offers three configurations, each with a different default:

1. **No guard anywhere** → allow by default.
2. **Controller or method `@UseGuards(AuthGuard)`** → protects that specific surface only.
3. **Global guard via `APP_GUARD` provider** → deny by default across the whole app, with `@Public()` as the opt-out.

Option 3 is the safe idiom. Most large NestJS codebases use it. Always check `app.module.ts` or the root module for an `APP_GUARD` provider before flagging missing guards.

## How Auth Attaches

| Mechanism | Scope |
|-----------|-------|
| Global guard: `{ provide: APP_GUARD, useClass: AuthGuard }` | Every controller in the app. |
| Controller guard: `@UseGuards(AuthGuard)` on a class | Every method in the controller. |
| Method guard: `@UseGuards(AuthGuard)` on a handler | That method only. |
| `@Public()` (custom decorator) | Marks a method exempt from a global auth guard. |
| `@Roles('admin')` + `RolesGuard` | Authorization layer. Typically runs after `AuthGuard`. |

## Canonical Bug Shapes

### 1. `@Public()` applied too broadly

```ts
@Controller('admin')
export class AdminController {
  @Public()
  @Get('users')
  list() { return this.svc.list(); }
}
```

`@Public()` on an admin endpoint disables the global auth guard. This happens most often by copy-paste from a genuinely-public endpoint (`/health`, `/signup`).

Grep for `@Public()` and inspect every use.

### 2. Global guard registered but not actually loaded

```ts
// The module defines the provider...
@Module({
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AuthModule {}
```

But `AuthModule` is not imported into `AppModule`, or is only imported in a feature module whose scope doesn't include the new controller. The guard silently does nothing.

Verify the import chain from the root module.

### 3. `RolesGuard` that fails open when no `@Roles()` metadata is present

```ts
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.get<string[]>('roles', ctx.getHandler());
    if (!roles) return true;  // No metadata = no restriction. Fail-open.
    const req = ctx.switchToHttp().getRequest();
    return roles.some(r => req.user.roles.includes(r));
  }
}
```

The "no metadata = allow" path is the common fail-open. When the guard is registered globally via `APP_GUARD` and a new controller forgets `@Roles()`, the controller is accessible to any authenticated user.

Either:

- Require a default role (e.g., `'user'`) when metadata is absent, or
- Flip to deny-by-default: `if (!roles) return false;` and require every route to declare.

### 4. Metadata read from `getHandler()` but not `getClass()`

```ts
const roles = this.reflector.get<string[]>('roles', ctx.getHandler());
```

This only reads method-level `@Roles()`. A controller-level `@Roles('admin')` is ignored. Use `getAllAndOverride` or `getAllAndMerge`:

```ts
const roles = this.reflector.getAllAndOverride<string[]>('roles', [
  ctx.getHandler(),
  ctx.getClass(),
]);
```

### 5. `ExecutionContext.switchToHttp()` on non-HTTP transports

```ts
canActivate(ctx: ExecutionContext): boolean {
  const req = ctx.switchToHttp().getRequest();
  return !!req.user;
}
```

This guard is correct for HTTP. For gRPC, WebSocket, or GraphQL contexts, `switchToHttp()` returns objects whose shape does not match, and the `req.user` access becomes either undefined (bypass) or errors (denial of service).

A guard used across transports should inspect `ctx.getType()`:

```ts
if (ctx.getType() === 'http') {
  return !!ctx.switchToHttp().getRequest().user;
}
if (ctx.getType() === 'ws') { ... }
if (ctx.getType<GqlContextType>() === 'graphql') {
  return !!GqlExecutionContext.create(ctx).getContext().req.user;
}
```

### 6. Resolver-level guards missing on GraphQL

NestJS GraphQL resolvers need their own guards. A global HTTP guard does not cover GraphQL unless the guard is GraphQL-aware. See `graphql.md` for nested resolver guidance.

```ts
@Resolver(() => Order)
export class OrderResolver {
  @Query(() => [Order])
  @UseGuards(GqlAuthGuard)
  orders(@CurrentUser() user: User) {
    return this.orderService.findForUser(user.id);
  }

  @ResolveField(() => [Invoice])
  invoices(@Parent() order: Order) {
    // No guard here. If order was loaded via a different entry point
    // (e.g., federation __resolveReference), invoices leak.
    return this.invoiceService.forOrder(order.id);
  }
}
```

### 7. Custom auth guard that doesn't throw on missing token

```ts
canActivate(ctx: ExecutionContext): boolean {
  const req = ctx.switchToHttp().getRequest();
  const token = req.headers.authorization;
  if (!token) return false;
  try {
    req.user = verify(token);
    return true;
  } catch {
    return false;
  }
}
```

This is correct; `return false` causes a 403. But a variant that returns `true` on decode errors (or silently assigns a default user) is a bypass.

## False-Positive Traps

- **`APP_GUARD` provider in the root module.** Covers every controller unless `@Public()` applied. Missing `@UseGuards` on a controller is fine if the global guard handles it.
- **Passport strategies**: `@UseGuards(AuthGuard('jwt'))` with a configured Passport JWT strategy is a full auth check, not just a token presence check.
- **Route in a `@Controller()` with a class-level `@UseGuards`**: the method inherits the class decorator.
- **DTO-based validation** (`class-validator` + `ValidationPipe`): may act as a mass-assignment defense if `whitelist: true` is set globally.

## Diff Heuristics

1. **New `@Public()` usage.** Every one is worth reviewing.
2. **New controller with no `@UseGuards` and no `APP_GUARD` in the import graph.**
3. **`RolesGuard` that returns `true` when metadata is missing.**
4. **Custom guard using `getHandler()` alone, missing `getClass()`.**
5. **GraphQL resolver / resolve-field without its own `@UseGuards`** when the parent has one.
6. **DTO with `whitelist: false` or no `ValidationPipe`** on endpoints that accept user input.
7. **`@UseGuards` placed on a method that accepts a sensitive body without a corresponding `@Roles` check** (e.g., `POST /users/:id/role`).

## Verification Commands

```bash
# Global guards
rg -n 'APP_GUARD' <project>

# @Public usage
rg -n '@Public\(' <project>

# Guards declared on controllers and methods
rg -n '@UseGuards\(' <project>

# Reflector usage in guards
rg -n 'reflector\.(get|getAllAndOverride|getAllAndMerge)' <project>

# Validation pipe configuration
rg -n 'ValidationPipe|whitelist' <project>

# GraphQL resolvers
rg -n '@Resolver|@ResolveField' <project>
```
