import { NewRoomResponseSchema } from '@/lib/models/rooms'
import { type Locale, t as translate } from '@/lib/utils/i18n'
import { navigate } from 'astro:transitions/client'
import { useState } from 'preact/hooks'
import { Button } from '../ui/Button'

interface NewRoomProps {
    locale?: Locale
}

export const NewRoom = ({ locale = 'it' }: NewRoomProps) => {
    const [isLoading, setIsLoading] = useState(false)

    const t = (key: string) => translate(key, locale)

    const handleCreateRoom = async () => {
        setIsLoading(true)
        await fetch(`${import.meta.env.PUBLIC_SERVER_URL}/api/rooms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        })
            .then(async res => {
                const data = await res.json()
                const result = NewRoomResponseSchema.safeParse(data)
                if (!result.success) {
                    console.error('Invalid response:', result.error)
                    throw new Error('Invalid response from server')
                }
                const roomId = result.data.roomId
                navigate(`/room?id=${roomId}`)
            })
            .catch(error => {
                console.error('Error creating room:', error)
                alert(t('toasts.roomCreationFailed'))
            })
            .finally(() => {
                setIsLoading(false)
            })
    }

    return (
        <Button
            onClick={handleCreateRoom}
            disabled={isLoading}
            className="w-auto"
        >
            {isLoading ? t('home.creating') : t('home.createRoom')}
        </Button>
    )
}
