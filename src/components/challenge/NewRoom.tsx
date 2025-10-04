import { NewRoomResponseSchema } from '@/lib/models/rooms'
import { navigate } from 'astro:transitions/client'
import { useState } from 'preact/hooks'
import { safeParse } from 'zod'
import { Button } from '../ui/Button'

export const NewRoom = () => {
    const [isLoading, setIsLoading] = useState(false)

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
                const result = safeParse(NewRoomResponseSchema, data)
                if (!result.success) {
                    console.error('Invalid response:', result.error)
                    throw new Error('Invalid response from server')
                }
                const roomId = result.data.roomId
                navigate(`/room?id=${roomId}`)
            })
            .catch(error => {
                console.error('Error creating room:', error)
                alert('Failed to create room. Please try again.')
            })
            .finally(() => {
                setIsLoading(false)
            })
    }

    return (
        <Button onClick={handleCreateRoom} disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create New Room'}
        </Button>
    )
}
