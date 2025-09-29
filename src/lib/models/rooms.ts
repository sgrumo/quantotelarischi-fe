import { z } from 'zod'

export const UserSchema = z.string()
export const ChallengeSchema = z.object({
    challenge_amount: z.number().nullish(),
    challenge_description: z.string().nullish(),
    challenger_bet_amount: z.number().nullish(),
    challenged_bet_amount: z.number().nullish(),
})

export const RoomInfoSchema = ChallengeSchema.extend({
    room_id: z.string(),
    challenger_id: z.string().nullish(),
    challenged_id: z.string().nullish(),
    createdAt: z.string().nullish(),
    betStatus: z.enum(['completed', 'not_completed']).nullish(),
}).transform(data => ({
    roomId: data.room_id,
    challengerId: data.challenger_id,
    challengedId: data.challenged_id,
    challengeAmount: data.challenge_amount,
    challengeDescription: data.challenge_description,
    challengerBetAmount: data.challenger_bet_amount,
    challengedBetAmount: data.challenged_bet_amount,
    createdAt: data.createdAt ? new Date(data.createdAt) : null,
    betStatus: data.betStatus,
}))

export const JoinRoomResponseSchema = z.object({
    roomInfo: RoomInfoSchema,
    userId: UserSchema,
})

export const BetSchema = z.object({
    id: z.string(),
    challenger_id: z.string(),
    challenged_id: z.string(),
    amount: z.number(),
    status: z.enum(['accepted', 'completed', 'forfeited']),
})

export const IncomingActionSchema = z.discriminatedUnion('event', [
    z.object({
        event: z.literal('challenge_received'),
        payload: z.object({
            challenge_description: z.string(),
        }),
    }),
    z.object({
        event: z.literal('challenge_accepted'),
        payload: z.object({
            amount: z.number(),
        }),
    }),
    z.object({
        event: z.literal('challenge_declined'),
        payload: z.object({
            declined_by: z.string(),
        }),
    }),
    z.object({
        event: z.literal('bet_completed'),
        payload: z.object({
            status: z.enum(['completed', 'not_completed']),
            challenger_amount: z.number(),
            challenged_amount: z.number(),
        }),
    }),
    z.object({
        event: z.literal('user_joined'),
        payload: RoomInfoSchema,
    }),
    z.object({
        event: z.literal('user_left'),
        payload: z.object({
            user_id: z.string(),
        }),
    }),
])

export const OutgoingActionSchema = z.discriminatedUnion('event', [
    z.object({
        event: z.literal('send_challenge'),
        payload: z.object({
            challenge_description: z.string(),
        }),
    }),
    z.object({
        event: z.literal('accept_challenge'),
        payload: z.object({
            amount: z.number(),
        }),
    }),
    z.object({
        event: z.literal('decline_challenge'),
        payload: z.object({}),
    }),
    z.object({
        event: z.literal('place_bet'),
        payload: z.object({
            amount: z.number(),
        }),
    }),
    z.object({
        event: z.literal('forfeit_bet'),
        payload: z.object({}),
    }),
    z.object({
        event: z.literal('reset_game'),
        payload: z.object({}),
    }),
])

export type User = z.infer<typeof UserSchema>
export type RoomInfo = z.infer<typeof RoomInfoSchema>
export type Challenge = z.infer<typeof ChallengeSchema>
export type Bet = z.infer<typeof BetSchema>
export type IncomingAction = z.infer<typeof IncomingActionSchema>
export type OutgoingAction = z.infer<typeof OutgoingActionSchema>
export type JoinRoomResponse = z.infer<typeof JoinRoomResponseSchema>

export const RoomStateSchema = z.object({
    connectionStatus: z.enum([
        'disconnected',
        'connecting',
        'connected',
        'error',
    ]),
    roomInfo: RoomInfoSchema.nullish(),
    currentUser: UserSchema.nullish(),
    messages: z.array(IncomingActionSchema),
    error: z.string().nullish(),
})

export type RoomState = z.infer<typeof RoomStateSchema>

export type CompleteRoomState = RoomState & {
    isBettingPhase: boolean
    hasChallengeReceived: boolean
    lastChallengeAmount: number | null
}
