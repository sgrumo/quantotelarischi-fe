import { AlertCircleIcon } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default function AlertDestructive({
    errorMessage,
}: {
    errorMessage: string
}) {
    return (
        <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>Something went wrong!</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
    )
}
