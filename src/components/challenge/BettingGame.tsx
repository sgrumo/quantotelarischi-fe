import { Channel, Socket } from 'phoenix'
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
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
import { Button } from '../ui/Button'

interface BettingGameProps {
    roomId: string
}

export default function BettingGame({ roomId }: BettingGameProps) {
    const [isConnected, setIsConnected] = useState(false)
    const [roomInfo, setRoomInfo] = useState<RoomInfo>()
    const [userId, setUserId] = useState<string>()
    const [challengeBetAmount, setChallengeBetAmount] = useState<number>()
    const [betAmount, setBetAmount] = useState<number>()
    const [challengeDescription, setChallengeDescription] = useState<string>()
    const [gameState, setGameState] = useState<GameState>('Idle')
    const [error, setError] = useState<string>()

    const socketRef = useRef<Socket>()
    const channelRef = useRef<Channel>()

    useEffect(() => {
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
            })
            .receive('timeout', () => {
                console.error('Join timeout')
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

    const sendEvent = useCallback(({ event, payload }: OutgoingAction) => {
        if (channelRef.current) {
            channelRef.current
                .push(event, payload)
                .receive('ok', resp => {
                    console.log(`${event} sent successfully:`, resp)
                })
                .receive('error', resp => {
                    console.error(`Failed to send ${event}:`, resp)
                    setError(`Failed to ${event.replace('_', ' ')}`)
                })
        }
    }, [])

    const handleSendChallenge = useCallback(() => {
        if (!challengeDescription || challengeDescription.trim() === '') {
            return
        }
        sendEvent({
            event: 'send_challenge',
            payload: { challenge_description: challengeDescription },
        })
    }, [sendEvent])

    const handleAcceptChallenge = useCallback(() => {
        if (!challengeBetAmount || challengeBetAmount <= 0) {
            return
        }
        sendEvent({
            event: 'accept_challenge',
            payload: { amount: challengeBetAmount },
        })
    }, [sendEvent, challengeBetAmount])

    const handleDenyChallenge = useCallback(() => {
        sendEvent({ event: 'decline_challenge', payload: {} })
    }, [sendEvent])

    const handlePlaceBet = useCallback(() => {
        if (betAmount && betAmount > 0) {
            sendEvent({ event: 'place_bet', payload: { amount: betAmount } })
        }
    }, [sendEvent, betAmount])

    const handleResetGame = useCallback(() => {
        setGameState('Idle')
        sendEvent({ event: 'reset_game', payload: {} })
    }, [sendEvent])

    const isChallenger = useMemo(() => {
        return userId === roomInfo?.challengerId
    }, [userId, roomInfo])

    return (
        <div style={{ padding: '20px', fontFamily: 'monospace' }}>
            <h2>Betting Game - Room: {roomId}</h2>
            {error && <p style={{ color: 'red' }}>Error: {error}</p>}
            <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
            {userId && <p>Your User ID: {userId}</p>}
            {roomInfo && userId && (
                <span>
                    You are the {isChallenger ? 'Challenger' : 'Challenged'}
                </span>
            )}
            {isChallenger && (
                <Button
                    onClick={handleSendChallenge}
                    disabled={roomInfo?.challengedId === null}
                >
                    Send challenge
                </Button>
            )}
            {!isChallenger && roomInfo?.challengeDescription && (
                <div>
                    <Button onClick={handleAcceptChallenge}>Accept</Button>
                    <Button onClick={handleDenyChallenge}>Deny</Button>
                </div>
            )}
            {!isChallenger && roomInfo && roomInfo.challengeDescription && (
                <div>
                    <h3>Current Challenge:</h3>
                    <p>{roomInfo.challengeDescription}</p>
                </div>
            )}
            {gameState === 'ChallengeAccepted' && roomInfo?.challengeAmount && (
                <div>
                    <h3>Challenge Accepted!</h3>
                    <p>Challenge Amount: {roomInfo.challengeAmount}</p>
                    <input
                        type="number"
                        placeholder="Your Bet Amount"
                        min={1}
                        max={roomInfo.challengeAmount - 1}
                        defaultValue={1}
                        onChange={e =>
                            setBetAmount(parseInt(e.currentTarget.value))
                        }
                    />
                    <Button onClick={handlePlaceBet}>Place bet</Button>
                </div>
            )}
            {gameState === 'BetCompleted' && roomInfo?.betStatus && (
                <div>
                    <h3>Bet Completed!</h3>
                    <p>Bet Status: {roomInfo.betStatus}</p>
                    {isChallenger && (
                        <Button onClick={handleResetGame}>Reset Game</Button>
                    )}
                </div>
            )}
        </div>
    )
}
