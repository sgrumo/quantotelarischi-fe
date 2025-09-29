import { Channel, Socket } from 'phoenix'
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { match } from 'ts-pattern'
import {
    IncomingActionSchema,
    JoinRoomResponseSchema,
    type IncomingAction,
    type OutgoingAction,
    type RoomInfo,
} from '../../lib/models/rooms'

interface BettingGameProps {
    roomId: string
    playerId?: string
}

const SOCKET_URL = 'ws://localhost:4000/socket'
type GameState =
    | 'Idle'
    | 'ChallengeSent'
    | 'ChallengeReceived'
    | 'ChallengeAccepted'
    | 'ChallengeDeclined'
    | 'BetPlaced'
    | 'BetCompleted'

export default function BettingGame({ roomId }: BettingGameProps) {
    const [isConnected, setIsConnected] = useState(false)
    const [roomInfo, setRoomInfo] = useState<RoomInfo>()
    const [userId, setUserId] = useState<string>()
    const [betAmount, setBetAmount] = useState<number>()
    const [gameState, setGameState] = useState<GameState>('Idle')

    const socketRef = useRef<Socket>()
    const channelRef = useRef<Channel>()

    useEffect(() => {
        const socket = new Socket(SOCKET_URL, {
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

    const handleIncomingMessage = (action: IncomingAction) => {
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
            .with({ event: 'challenge_declined' }, ({ payload }) => {
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
            .with({ event: 'user_left' }, ({ payload }) => {})
            .exhaustive()
    }

    const isChallenger = useMemo(() => {
        return userId === roomInfo?.challengerId
    }, [userId, roomInfo])

    const sendEvent = ({ event, payload }: OutgoingAction) => {
        if (channelRef.current) {
            channelRef.current
                .push(event, payload)
                .receive('ok', resp => {
                    console.log(`${event} sent successfully:`, resp)
                })
                .receive('error', resp => {
                    console.error(`Failed to send ${event}:`, resp)
                })
        }
    }

    const handleSendChallenge = () => {
        sendEvent({
            event: 'send_challenge',
            payload: { challenge_description: 'A new challenge!' },
        })
    }

    const handleAcceptChallenge = () => {
        sendEvent({ event: 'accept_challenge', payload: { amount: 100 } })
    }

    const handleDenyChallenge = () => {
        sendEvent({ event: 'decline_challenge', payload: {} })
    }

    const handlePlaceBet = () => {
        sendEvent({ event: 'place_bet', payload: { amount: 50 } })
    }

    const handleResetGame = () => {
        sendEvent({ event: 'reset_game', payload: {} })
    }

    console.log('Room Info:', roomInfo)

    return (
        <div style={{ padding: '20px', fontFamily: 'monospace' }}>
            <h2>Betting Game - Room: {roomId}</h2>
            <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
            {userId && <p>Your User ID: {userId}</p>}
            {roomInfo && userId && (
                <span>
                    You are the {isChallenger ? 'Challenger' : 'Challenged'}
                </span>
            )}
            {isChallenger && (
                <button
                    onClick={handleSendChallenge}
                    disabled={roomInfo?.challengedId === null}
                >
                    Send challenge
                </button>
            )}
            {!isChallenger && roomInfo?.challengeDescription && (
                <div>
                    <button onClick={handleAcceptChallenge}>Accept</button>
                    <button onClick={handleDenyChallenge}>Deny</button>
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
                    <button onClick={handlePlaceBet}>Place bet</button>
                </div>
            )}
            {gameState === 'BetCompleted' && roomInfo?.betStatus && (
                <div>
                    <h3>Bet Completed!</h3>
                    <p>Bet Status: {roomInfo.betStatus}</p>
                    {isChallenger && (
                        <button onClick={handleResetGame}>Reset Game</button>
                    )}
                </div>
            )}
        </div>
    )
}
