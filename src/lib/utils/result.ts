import { ZodError, ZodType } from 'zod'

export type Ok<TValue> = { success: true; value: TValue }
export type Err<TError> = { success: false; error: TError }

export type ExtractOk<T extends Result<unknown, unknown>> =
    T extends Result<infer TValue, unknown> ? TValue : never
export type ExtractErr<T extends Result<unknown, unknown>> =
    T extends Result<unknown, infer TError> ? TError : never

export type Result<TValue, TError> = (Ok<TValue> | Err<TError>) & {
    bind: <const TBoundValue, const TBoundError>(
        fn: (value: TValue) => Result<TBoundValue, TBoundError>,
    ) => Result<TBoundValue, TError | TBoundError>
    map: <const TBoundValue>(
        fn: (value: TValue) => TBoundValue,
    ) => Result<TBoundValue, TError>
    unwrapOr: <const TBoundValue>(
        defaultValue: TBoundValue,
    ) => TValue | TBoundValue
    unwrapOrNull: () => TValue | null
}

export const ok = <const TValue, const TError = never>(
    value: TValue,
): Result<TValue, TError> => ({
    success: true,
    value,
    bind: fn => fn(value),
    map: fn => ok(fn(value)),
    unwrapOr: () => value,
    unwrapOrNull: () => value,
})

export const err = <const TError, const TValue = never>(
    error: TError,
): Result<TValue, TError> => ({
    success: false,
    error,
    bind: () => err(error),
    map: () => err(error),
    unwrapOr: defaultValue => defaultValue,
    unwrapOrNull: () => null,
})

export const trySync = <const TValue>(
    fn: () => TValue,
): Result<TValue, unknown> => {
    try {
        return ok(fn())
    } catch (error) {
        return err(error)
    }
}

export const tryAsync = <const TValue>(
    fn: () => Promise<TValue>,
): Promise<Result<TValue, unknown>> => fn().then(ok).catch(err)

export const withTrySync =
    <const TArgs extends unknown[], const TRes>(fn: (...args: TArgs) => TRes) =>
    (...args: TArgs): Result<TRes, unknown> =>
        trySync(() => fn(...args))

export const safeParseResult = <const T>(
    schema: ZodType<T>,
    data: unknown,
): Result<T, ZodError<T>> => {
    const result = schema.safeParse(data)
    return result.success ? ok(result.data) : err(result.error)
}
