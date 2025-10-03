import { cva, type VariantProps } from 'class-variance-authority'

import * as React from 'preact'

import { cn } from '@/lib/utils'

const alertVariants = cva(
    'rounded-base border-border shadow-shadow relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 border-2 px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current',
    {
        variants: {
            variant: {
                default: 'bg-main text-main-foreground',
                destructive: 'bg-black text-white',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    },
)

function Alert({
    className,
    variant,
    ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
    return (
        <div
            data-slot="alert"
            role="alert"
            className={cn(alertVariants({ variant }), className)}
            {...props}
        />
    )
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="alert-title"
            className={cn(
                'font-heading col-start-2 line-clamp-1 min-h-4 tracking-tight',
                className,
            )}
            {...props}
        />
    )
}

function AlertDescription({
    className,
    ...props
}: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="alert-description"
            className={cn(
                'font-base col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed',
                className,
            )}
            {...props}
        />
    )
}

export { Alert, AlertDescription, AlertTitle }
