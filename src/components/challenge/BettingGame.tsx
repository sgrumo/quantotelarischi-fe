import { Channel, Socket } from 'phoenix'
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { toast } from 'sonner'
import { match } from 'ts-pattern'
import {
    IncomingActionSchema,
    JoinRoomResponseSchema,
    type GameState,
    type IncomingAction,
    type OutgoingAction,
    type RoomInfo,
} from '../../lib/models/rooms'
import '../../styles/globals.css'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '../ui/Card'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'

interface BettingGameProps {
    roomId: string
}

export default function BettingGame() {
    const [isConnected, setIsConnected] = useState(false)
    const [roomInfo, setRoomInfo] = useState<RoomInfo>()
    const [userId, setUserId] = useState<string>()
    const [challengeBetAmount, setChallengeBetAmount] = useState<number>(100)
    const [betAmount, setBetAmount] = useState<number>(1)
    const [challengeDescription, setChallengeDescription] = useState<string>('')
    const [gameState, setGameState] = useState<GameState>('Idle')
    const [copied, setCopied] = useState(false)

    const socketRef = useRef<Socket>()
    const channelRef = useRef<Channel>()

    const showToast = useCallback((message: string) => {
        toast.error(message)
    }, [])

    useEffect(() => {
        const urlSearchParams = new URLSearchParams(window.location.search)
        const params = Object.fromEntries(urlSearchParams.entries())
        const roomId = params.id

        toast.info('Connecting to the game room...')

        if (!roomId) {
            showToast('Room ID is missing in the URL')
            return
        }

        const socket = new Socket(import.meta.env.PUBLIC_WS_URL, {
            logger: (kind, msg, data) => {
                if (process.env.NODE_ENV === 'development') {
                    console.log(`Phoenix ${kind}: ${msg}`, data)
                }
            },
            reconnectAfterMs: tries => {
                return [1000, 2000, 5000, 10000][tries - 1] || 10000
            },
        })

        socket.onOpen(() => {
            console.log('Socket connected')
        })

        socket.onError(error => {
            console.error('Socket error:', error)
            showToast('Connection error occurred')
        })

        socket.onClose(event => {
            console.log('Socket closed:', event)
        })

        socket.connect()
        socketRef.current = socket

        const channel = socket.channel(`room:${roomId}`)
        const joinResult = channel
            .join()
            .receive('ok', resp => {
                const response = JoinRoomResponseSchema.parse(resp)
                setRoomInfo(response.roomInfo)
                setUserId(response.userId)
                setIsConnected(true)
            })
            .receive('error', resp => {
                console.error('Unable to join room:', resp)
                showToast('Failed to join room')
            })
            .receive('timeout', () => {
                console.error('Join timeout')
                showToast('Connection timeout')
            })

        if (joinResult) {
            channelRef.current = channel
            const eventHandlers = [
                'user_joined',
                'challenge_received',
                'challenge_accepted',
                'challenge_declined',
                'bet_completed',
                'user_left',
            ]

            eventHandlers.forEach(eventType => {
                channel.on(eventType, payload => {
                    const action = IncomingActionSchema.parse({
                        event: eventType,
                        payload,
                    })
                    console.log('Received action:', action)
                    handleIncomingMessage(action)
                })
            })
        } else {
            socket.disconnect()
            setIsConnected(false)
        }

        return () => {
            if (channelRef.current) {
                channelRef.current.leave()
                channelRef.current = undefined
            }

            if (socketRef.current) {
                socketRef.current.disconnect()
                socketRef.current = undefined
            }
            setIsConnected(false)
        }
    }, [])

    const handleIncomingMessage = useCallback((action: IncomingAction) => {
        match(action)
            .with({ event: 'user_joined' }, ({ payload }) => {
                setRoomInfo(payload)
            })
            .with({ event: 'challenge_received' }, ({ payload }) => {
                setGameState('ChallengeReceived')
                setRoomInfo(
                    prev =>
                        prev && {
                            ...prev,
                            challengeDescription: payload.challenge_description,
                        },
                )
            })
            .with({ event: 'challenge_accepted' }, ({ payload }) => {
                setGameState('ChallengeAccepted')
                setRoomInfo(
                    prev =>
                        prev && { ...prev, challengeAmount: payload.amount },
                )
            })
            .with({ event: 'challenge_declined' }, () => {
                setGameState('ChallengeDeclined')
            })
            .with({ event: 'bet_completed' }, ({ payload }) => {
                console.log('Bet completed payload:', payload)
                setGameState('BetCompleted')
                setRoomInfo(
                    prev =>
                        prev && {
                            ...prev,
                            betStatus: payload.status,
                        },
                )
            })
            .with({ event: 'user_left' }, () => {
                setGameState('Idle')
                setRoomInfo(undefined)
            })
            .exhaustive()
    }, [])

    const sendEvent = useCallback(
        ({ event, payload }: OutgoingAction) => {
            if (channelRef.current) {
                channelRef.current
                    .push(event, payload)
                    .receive('ok', resp => {
                        console.log(`${event} sent successfully:`, resp)
                    })
                    .receive('error', resp => {
                        console.error(`Failed to send ${event}:`, resp)
                        showToast(`Failed to ${event.replace(/_/g, ' ')}`)
                    })
            }
        },
        [showToast],
    )

    const handleSendChallenge = useCallback(() => {
        if (!challengeDescription || challengeDescription.trim() === '') {
            showToast('Please enter a challenge description')
            return
        }
        sendEvent({
            event: 'send_challenge',
            payload: { challenge_description: challengeDescription },
        })
        setChallengeDescription('')
    }, [sendEvent, challengeDescription, showToast])

    const handleAcceptChallenge = useCallback(() => {
        if (!challengeBetAmount || challengeBetAmount <= 0) {
            showToast('Please enter a valid bet amount')
            return
        }
        sendEvent({
            event: 'accept_challenge',
            payload: { amount: challengeBetAmount },
        })
    }, [sendEvent, challengeBetAmount, showToast])

    const handleDenyChallenge = useCallback(() => {
        sendEvent({ event: 'decline_challenge', payload: {} })
    }, [sendEvent])

    const handlePlaceBet = useCallback(() => {
        if (!betAmount || betAmount <= 0) {
            showToast('Please enter a valid bet amount')
            return
        }
        if (
            roomInfo?.challengeAmount &&
            betAmount >= roomInfo.challengeAmount
        ) {
            showToast(
                `Bet amount must be less than ${roomInfo.challengeAmount}`,
            )
            return
        }
        sendEvent({ event: 'place_bet', payload: { amount: betAmount } })
    }, [sendEvent, betAmount, roomInfo, showToast])

    const handleResetGame = useCallback(() => {
        setGameState('Idle')
        setChallengeDescription('')
        setChallengeBetAmount(100)
        setBetAmount(1)
        sendEvent({ event: 'reset_game', payload: {} })
    }, [sendEvent])

    const isChallenger = useMemo(() => {
        return userId === roomInfo?.challengerId
    }, [userId, roomInfo])

    const copyRoomLink = useCallback(() => {
        const currentUrl = window.location.href
        navigator.clipboard.writeText(currentUrl).then(() => {
            setCopied(true)
            toast.success('Link copied to clipboard!')
            setTimeout(() => setCopied(false), 2000)
        })
    }, [])

    return (
        <div className="bg-background min-h-screen p-6">
            <div className="mx-auto max-w-2xl space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-3xl">
                            🎲 Betting Game
                        </CardTitle>
                        {roomInfo && userId && (
                            <CardDescription className="flex items-center gap-2">
                                <span className="font-heading">Your Role:</span>
                                <Badge>
                                    {isChallenger ? 'CHALLENGER' : 'CHALLENGED'}
                                </Badge>
                            </CardDescription>
                        )}
                    </CardHeader>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Share Room</CardTitle>
                        <CardDescription>
                            Send this link to another person to join the game
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex gap-2">
                            <Input
                                readOnly
                                value={window.location.href}
                                className="flex-1"
                            />
                            <Button
                                onClick={copyRoomLink}
                                variant={copied ? 'neutral' : 'default'}
                                className="min-w-24"
                            >
                                {copied ? '✓ Copied' : 'Copy'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {isChallenger && gameState === 'Idle' && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Send Challenge</CardTitle>
                            <CardDescription>
                                Create a challenge for your opponent
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label htmlFor="challenge-description">
                                    Challenge Description
                                </label>
                                <Textarea
                                    id="challenge-description"
                                    rows={4}
                                    placeholder="Describe your challenge..."
                                    value={challengeDescription}
                                    onChange={e =>
                                        setChallengeDescription(
                                            e.currentTarget.value,
                                        )
                                    }
                                />
                            </div>
                            <Button
                                onClick={handleSendChallenge}
                                disabled={
                                    roomInfo?.challengedId === null ||
                                    !isConnected
                                }
                            >
                                Send Challenge →
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {!isChallenger &&
                    roomInfo?.challengeDescription &&
                    gameState === 'ChallengeReceived' && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Challenge Received!</CardTitle>
                                <CardDescription>
                                    Review the challenge and decide your
                                    response
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Card className="bg-secondary-background">
                                    <CardContent>
                                        <p className="font-base text-lg">
                                            {roomInfo.challengeDescription}
                                        </p>
                                    </CardContent>
                                </Card>
                                <div className="space-y-2">
                                    <label htmlFor="challenge-bet-amount">
                                        Your Bet Amount
                                    </label>
                                    <Input
                                        id="challenge-bet-amount"
                                        type="number"
                                        min={1}
                                        value={challengeBetAmount}
                                        onChange={e =>
                                            setChallengeBetAmount(
                                                parseInt(
                                                    e.currentTarget.value,
                                                ) || 0,
                                            )
                                        }
                                    />
                                </div>
                                <div className="flex gap-4">
                                    <Button
                                        onClick={handleAcceptChallenge}
                                        disabled={!isConnected}
                                        className="flex-1"
                                    >
                                        ✓ Accept
                                    </Button>
                                    <Button
                                        onClick={handleDenyChallenge}
                                        disabled={!isConnected}
                                        variant="neutral"
                                        className="flex-1"
                                    >
                                        ✗ Deny
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                {gameState === 'ChallengeAccepted' &&
                    roomInfo?.challengeAmount && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Challenge Accepted!</CardTitle>
                                <CardDescription>
                                    Place your bet now
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-2 text-lg">
                                    <span className="font-base">
                                        Challenge Amount:
                                    </span>
                                    <Badge className="px-4 py-2 text-2xl">
                                        {roomInfo.challengeAmount}
                                    </Badge>
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="bet-amount">
                                        Place Your Bet (max:{' '}
                                        {roomInfo.challengeAmount - 1})
                                    </label>
                                    <Input
                                        id="bet-amount"
                                        type="number"
                                        min={1}
                                        max={roomInfo.challengeAmount - 1}
                                        value={betAmount}
                                        onChange={e =>
                                            setBetAmount(
                                                parseInt(
                                                    e.currentTarget.value,
                                                ) || 1,
                                            )
                                        }
                                    />
                                </div>
                                <Button
                                    onClick={handlePlaceBet}
                                    disabled={!isConnected}
                                >
                                    Place Bet →
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                {gameState === 'BetCompleted' && roomInfo?.betStatus && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Bet Completed!</CardTitle>
                            <CardDescription>
                                The results are in
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Card className="bg-secondary-background">
                                <CardContent>
                                    <div className="flex items-center gap-2">
                                        <span className="font-heading text-lg">
                                            Status:
                                        </span>
                                        <Badge className="px-4 py-2 text-xl">
                                            {roomInfo.betStatus}
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>
                            {isChallenger && (
                                <Button
                                    onClick={handleResetGame}
                                    disabled={!isConnected}
                                >
                                    ↻ Reset Game
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}
